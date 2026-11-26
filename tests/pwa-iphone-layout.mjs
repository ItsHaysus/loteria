// Visual smoke test for installed-PWA layouts. Requires a local static server
// on port 8000 and geckodriver on port 4444.
const webdriver = 'http://127.0.0.1:4444';
const appUrl = 'http://127.0.0.1:8000/';

const devices = [
  { name: 'iphone-se', width: 375, height: 667, dpr: 2, safeTop: 20, safeBottom: 0 },
  { name: 'iphone-13-mini', width: 375, height: 812, dpr: 3, safeTop: 47, safeBottom: 34 },
  { name: 'iphone-15', width: 390, height: 844, dpr: 3, safeTop: 59, safeBottom: 34 },
  { name: 'iphone-18-pro', width: 402, height: 874, dpr: 3, safeTop: 62, safeBottom: 34 },
  { name: 'iphone-air', width: 420, height: 912, dpr: 3, safeTop: 62, safeBottom: 34 },
  { name: 'iphone-18-pro-max', width: 440, height: 956, dpr: 3, safeTop: 62, safeBottom: 34 },
  { name: 'iphone-duo-outer', width: 466, height: 678, dpr: 3, safeTop: 20, safeBottom: 21, fold: 'fold-outer' },
  { name: 'iphone-duo-inner-portrait', width: 626, height: 890, dpr: 3, safeTop: 24, safeBottom: 21, fold: 'fold-inner-portrait' },
  { name: 'iphone-18-pro-landscape', width: 874, height: 402, dpr: 3, safeTop: 0, safeBottom: 21, safeLeft: 62, safeRight: 62 },
  { name: 'iphone-18-pro-max-landscape', width: 956, height: 440, dpr: 3, safeTop: 0, safeBottom: 21, safeLeft: 62, safeRight: 62 },
  { name: 'iphone-duo-inner-landscape', width: 890, height: 626, dpr: 3, safeTop: 24, safeBottom: 21, fold: 'fold-inner-landscape' },
];

async function request(path, init = {}) {
  const response = await fetch(`${webdriver}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...init.headers },
  });
  const payload = await response.json();
  if (!response.ok || payload.value?.error) throw new Error(JSON.stringify(payload));
  return payload.value;
}

const created = await request('/session', {
  method: 'POST',
  body: JSON.stringify({
    capabilities: { alwaysMatch: {
      browserName: 'firefox',
      webSocketUrl: true,
      'moz:firefoxOptions': { args: ['-headless'] },
    } },
  }),
});
const sessionId = created.sessionId;
const socket = new WebSocket(created.capabilities.webSocketUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let commandId = 0;
function bidi(method, params) {
  return new Promise((resolve, reject) => {
    const id = ++commandId;
    const receive = event => {
      const message = JSON.parse(event.data);
      if (message.id !== id) return;
      socket.removeEventListener('message', receive);
      if (message.type === 'error') reject(new Error(JSON.stringify(message)));
      else resolve(message.result);
    };
    socket.addEventListener('message', receive);
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function execute(script) {
  return await request(`/session/${sessionId}/execute/sync`, {
    method: 'POST',
    body: JSON.stringify({
      script: `return window.eval(${JSON.stringify(`(() => {\n${script}\n})()`)})`,
      args: [],
    }),
  });
}

const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function waitFor(condition, message) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await execute(`return ${condition}`)) return;
    await sleep(50);
  }
  throw new Error(message);
}

async function verifyCallerPlayback() {
  await request(`/session/${sessionId}/url`, {
    method: 'POST', body: JSON.stringify({ url: appUrl }),
  });
  await waitFor(`navigator.serviceWorker.controller &&
    performance.getEntriesByType('navigation')[0]?.type === 'reload' &&
    document.getElementById('btn-start')?.disabled === false`, 'PWA did not initialize after service worker activation');
  const rangeServed = await execute(`
    return fetch('./audio/start.mp3', { headers: { Range: 'bytes=0-1' } }).then(async response => {
      return response.status === 206 && response.headers.get('Content-Range')?.startsWith('bytes 0-1/') &&
        (await response.arrayBuffer()).byteLength === 2;
    });
  `);
  if (!rangeServed) throw new Error('The service worker did not support the audio range request');
  await execute(`
    for (let i = 0; i < 3; i += 1) document.getElementById('btn-faster').click();
  `);
  const start = await request(`/session/${sessionId}/element`, {
    method: 'POST', body: JSON.stringify({ using: 'css selector', value: '#btn-start' }),
  });
  const elementId = start['element-6066-11e4-a52e-4f735466cecf'];
  await request(`/session/${sessionId}/element/${elementId}/click`, { method: 'POST', body: '{}' });
  await waitFor('typeof audioPlayer !== "undefined" && audioPlayer?.currentTime > 0', 'The recorded opener did not play');
  const introRates = await execute(`
    const originalRate = audioPlayer.playbackRate;
    document.getElementById('btn-faster').click();
    const fasterRate = audioPlayer.playbackRate;
    // Stretch both clips past the one-second deal interval to exercise the playback gate.
    audioPlayer.playbackRate = 0.25;
    audioPlayer.addEventListener('ended', () => {
      window.cardsLeftAtIntroEnd = remaining.length;
      audioPlayer.addEventListener('playing', () => {
        window.firstCardRate = audioPlayer.playbackRate;
        audioPlayer.playbackRate = 0.25;
      }, { once: true });
    }, { once: true });
    return { originalRate, fasterRate, preservesPitch: audioPlayer.preservesPitch };
  `);
  if (introRates.originalRate !== 1.3 || introRates.fasterRate !== 1.4 || !introRates.preservesPitch) {
    throw new Error(`Unexpected opener playback rates ${JSON.stringify(introRates)}`);
  }
  await sleep(1100);
  if (await execute('return remaining.length') !== 54) throw new Error('A card was dealt during the opener');
  await execute('audioPlayer.playbackRate = 2');
  await waitFor('window.firstCardRate && remaining.length === 53', 'The first recorded card call did not play');
  if (!await execute('return cardsLeftAtIntroEnd === 54 && firstCardRate === 1.4')) {
    throw new Error('The first card started before the opener ended or used the wrong rate');
  }
  await sleep(1100);
  if (await execute('return remaining.length') !== 53) throw new Error('A card was dealt over the previous call');
  await execute('audioPlayer.playbackRate = 2');
  await waitFor('remaining.length === 52', 'Dealing did not resume after the card call ended');
  await execute("document.getElementById('btn-restart').click(); localStorage.removeItem('loteria-preferences')");
  console.log('Caller playback passed');
}

const tree = await bidi('browsingContext.getTree', {});
const context = tree.contexts[0].context;
const outputDir = '/tmp/loteria-iphone-layouts';
await Deno.mkdir(outputDir, { recursive: true });
const results = [];

try {
  await verifyCallerPlayback();
  for (const device of devices) {
    await bidi('browsingContext.setViewport', {
      context,
      viewport: { width: device.width, height: device.height },
      devicePixelRatio: device.dpr,
    });
    await bidi('browsingContext.navigate', { context, url: appUrl, wait: 'complete' });
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const ready = await execute(`return document.getElementById('remaining-label')?.textContent.includes('54')`);
      if (ready) break;
      await sleep(100);
    }
    await execute(`
      document.documentElement.classList.add('pwa-standalone');
      document.documentElement.classList.remove('fold-outer', 'fold-inner-portrait', 'fold-inner-landscape');
      ${device.fold ? `document.documentElement.classList.add('${device.fold}');` : ''}
      document.documentElement.style.setProperty('--safe-top', '${device.safeTop || 0}px');
      document.documentElement.style.setProperty('--safe-bottom', '${device.safeBottom || 0}px');
      document.documentElement.style.setProperty('--safe-left', '${device.safeLeft || 0}px');
      document.documentElement.style.setProperty('--safe-right', '${device.safeRight || 0}px');
      const voiceButton = document.getElementById('btn-speech');
      if (voiceButton.getAttribute('aria-pressed') === 'true') voiceButton.click();
      document.getElementById('btn-start').click();
      dealOne();
      dealOne();
      document.getElementById('btn-pause').click();
    `);
    await sleep(200);
    await execute(`
      document.documentElement.classList.add('pwa-standalone');
      ${device.fold ? `document.documentElement.classList.add('${device.fold}');` : ''}
    `);
    const metrics = await execute(`
      const visible = element => !element.hidden && getComputedStyle(element).display !== 'none';
      const rect = element => {
        const value = element.getBoundingClientRect();
        return { x: value.x, y: value.y, width: value.width, height: value.height, bottom: value.bottom, right: value.right };
      };
      const buttons = [...document.querySelectorAll('.controls .btn')].filter(visible);
      const image = document.querySelector('#current-card img');
      return {
        viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
        document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
        classes: document.documentElement.className,
        currentCard: rect(document.getElementById('current-card')),
        dealt: rect(document.querySelector('.dealt-section')),
        dealtCards: [...document.querySelectorAll('.dealt-strip .card-frame')].map(rect),
        buttons: buttons.map(button => ({ id: button.id, ...rect(button) })),
        smallTargets: buttons.filter(button => {
          const box = button.getBoundingClientRect();
          return box.width < 44 || box.height < 44;
        }).map(button => button.id),
        aiVisible: visible(document.getElementById('btn-ai')),
        imageLoaded: Boolean(image && image.complete && image.naturalWidth),
        remaining: document.getElementById('remaining-label').textContent,
      };
    `);
    const screenshot = await request(`/session/${sessionId}/screenshot`);
    await Deno.writeFile(`${outputDir}/${device.name}.png`, Uint8Array.from(atob(screenshot), character => character.charCodeAt(0)));
    const overflow = metrics.document.width > device.width || metrics.document.height > device.height;
    const bounds = metrics.currentCard.bottom > device.height + 0.5 || metrics.dealt.bottom > device.height + 0.5;
    const pass = !overflow && !bounds && metrics.smallTargets.length === 0 &&
      !metrics.aiVisible && metrics.imageLoaded && metrics.remaining.includes('52') &&
      (device.width > 440 || metrics.dealtCards.every(card => card.width < 100));
    results.push({ device: device.name, pass, overflow, bounds, ...metrics });
  }
} finally {
  socket.close();
  await request(`/session/${sessionId}`, { method: 'DELETE' });
}

console.log(JSON.stringify(results, null, 2));
if (results.some(result => !result.pass)) Deno.exit(1);
