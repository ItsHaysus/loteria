/* Card Dealer PWA - Lotería Edition
 * Loads cards from /cards/cards.json (JPG filenames)
 * Controls: Restart (R), Faster(-1s, <), Slower(+1s, >), Pause (Space)
 * Default speed: 5s per card
 * Random deals without repeats while cards remain
 * Dealt cards shown at bottom in order (left→right)
 */

const DEFAULT_DELAY_MS = 5000; // 5s per card
const MIN_DELAY_MS = 1000;     // 1s per card minimum
const STORAGE_KEY = 'loteria-preferences';

// UI elements
const btnStart   = document.getElementById('btn-start');
const btnRestart = document.getElementById('btn-restart');
const btnFaster  = document.getElementById('btn-faster');
const btnSlower  = document.getElementById('btn-slower');
const btnPause   = document.getElementById('btn-pause');
const btnSpeech  = document.getElementById('btn-speech');
const btnLanguage = document.getElementById('btn-language');
const LANGUAGE_KEY = 'loteria-language';
let language = 'en';
try { language = localStorage.getItem(LANGUAGE_KEY) === 'es' ? 'es' : 'en'; } catch (error) { console.warn('Could not load language preference:', error); }
const TEXT = {
  en: {
    start: 'Start', startTitle: 'Start the game', restart: 'Restart', restartTitle: 'Restart game (R)',
    faster: 'Faster (-1s)', fasterTitle: 'Speed up (< or comma)', slower: 'Slower (+1s)', slowerTitle: 'Slow down (> or period)',
    pause: 'Pause', resume: 'Resume', pauseTitle: 'Pause/Resume (Space)', voiceOn: 'Voice: On', voiceOff: 'Voice: Off', voiceTitle: 'Enable/disable spoken card names',
    languageButton: 'Español', languageLabel: 'Switch language to Spanish', speed: 'Speed: {seconds}s / card', speedInitial: 'Speed: 5s / card',
    remaining: 'Remaining: {count}', remainingInitial: 'Remaining: —', cardsPlaceholder: 'Cards will appear here', startPlaceholder: 'Press Start to begin',
    loading: 'Loading deck...', loadingCount: 'Loading {count} cards...', deckError: '❌ Error loading deck list. Check console.',
    noCards: '❌ No cards found in /Cards/cards.json', dealt: 'Dealt (in order):', debug: 'Debug', debugTitle: 'Viewport diagnostics',
    debugSubtitle: 'Live device and layout measurements', closeDebug: 'Close diagnostics', debugStatus: 'Updates on resize and orientation changes.',
    copyDebug: 'Copy diagnostics', copied: 'Diagnostics copied to clipboard.', copyUnavailable: 'Clipboard unavailable; select the text above to copy.',
    version: 'Version', captured: 'Captured', displayMode: 'Display mode', standalone: 'standalone PWA', browser: 'browser/tab',
    orientation: 'Orientation', windowScreen: 'WINDOW / SCREEN', inner: 'inner', outer: 'outer', screen: 'screen', avail: 'avail',
    cssViewport: 'CSS media-query viewport', pixelRatio: 'devicePixelRatio', docClient: 'documentElement client', scroll: 'scroll',
    visualViewport: 'VISUAL VIEWPORT', unavailable: 'not available', safeArea: 'safe-area insets', layout: 'LAYOUT', activeClasses: 'active root classes',
    outerWidth: 'fold-outer device width', outerActive: 'outer-display layout active', outerInactive: 'outer-display layout inactive',
    portraitRange: 'portrait, 450–500px range', innerLayout: 'fold-inner-landscape', active: 'active', inactive: 'inactive',
    landscapeRange: 'landscape viewport width {width}px; target range 800–1100px', topbar: 'topbar', main: 'main',
    currentCard: 'current card', mainComputed: 'main computed', breakpoints: 'BREAKPOINTS', yes: 'YES', no: 'no',
    copyCard: 'Current card', dealtCard: 'Dealt card', artBy: 'Art created by NRD',
  },
  es: {
    start: 'Iniciar', startTitle: 'Iniciar el juego', restart: 'Reiniciar', restartTitle: 'Reiniciar el juego (R)',
    faster: 'Más rápido (-1s)', fasterTitle: 'Acelerar (< o coma)', slower: 'Más lento (+1s)', slowerTitle: 'Ralentizar (> o punto)',
    pause: 'Pausar', resume: 'Continuar', pauseTitle: 'Pausar/continuar (Espacio)', voiceOn: 'Voz: activada', voiceOff: 'Voz: desactivada', voiceTitle: 'Activar/desactivar nombres hablados',
    languageButton: 'English', languageLabel: 'Cambiar idioma a inglés', speed: 'Velocidad: {seconds}s / carta', speedInitial: 'Velocidad: 5s / carta',
    remaining: 'Restantes: {count}', remainingInitial: 'Restantes: —', cardsPlaceholder: 'Las cartas aparecerán aquí', startPlaceholder: 'Presiona Iniciar para comenzar',
    loading: 'Cargando el mazo...', loadingCount: 'Cargando {count} cartas...', deckError: '❌ Error al cargar la lista. Revisa la consola.',
    noCards: '❌ No se encontraron cartas en /Cards/cards.json', dealt: 'Repartidas (en orden):', debug: 'Depuración', debugTitle: 'Diagnóstico de pantalla',
    debugSubtitle: 'Medidas actuales del dispositivo y diseño', closeDebug: 'Cerrar diagnóstico', debugStatus: 'Se actualiza al cambiar tamaño u orientación.',
    copyDebug: 'Copiar diagnóstico', copied: 'Diagnóstico copiado.', copyUnavailable: 'Portapapeles no disponible; selecciona el texto para copiar.',
    version: 'Versión', captured: 'Capturado', displayMode: 'Modo de visualización', standalone: 'PWA independiente', browser: 'navegador/pestaña',
    orientation: 'Orientación', windowScreen: 'VENTANA / PANTALLA', inner: 'interior', outer: 'exterior', screen: 'pantalla', avail: 'disponible',
    cssViewport: 'Ventana gráfica CSS', pixelRatio: 'Relación de píxeles', docClient: 'Área visible del documento', scroll: 'desplazamiento',
    visualViewport: 'VENTANA GRÁFICA VISUAL', unavailable: 'no disponible', safeArea: 'márgenes seguros', layout: 'DISEÑO', activeClasses: 'Clases activas',
    outerWidth: 'Ancho de pantalla exterior', outerActive: 'diseño de pantalla exterior activo', outerInactive: 'diseño de pantalla exterior inactivo',
    portraitRange: 'vertical, rango 450–500px', innerLayout: 'Pantalla interior horizontal', active: 'activo', inactive: 'inactivo',
    landscapeRange: 'ancho horizontal {width}px; rango objetivo 800–1100px', topbar: 'barra superior', main: 'área principal',
    currentCard: 'carta actual', mainComputed: 'estilo calculado del área principal', breakpoints: 'PUNTOS DE CORTE', yes: 'SÍ', no: 'no',
    copyCard: 'Carta actual', dealtCard: 'Carta repartida', artBy: 'Arte creado por NRD',
  },
};

function t(key, values = {}) {
  let text = TEXT[language][key] || TEXT.en[key] || key;
  for (const [name, value] of Object.entries(values)) text = text.replaceAll(`{${name}}`, value);
  return text;
}

function applyLanguage() {
  document.documentElement.lang = language;
  document.querySelectorAll('[data-i18n]').forEach(element => {
    element.textContent = t(element.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(element => {
    element.title = t(element.dataset.i18nTitle);
  });
  document.querySelectorAll('[data-i18n-aria-label]').forEach(element => {
    element.setAttribute('aria-label', t(element.dataset.i18nAriaLabel));
  });
  document.querySelectorAll('[data-language-key]').forEach(element => {
    element.textContent = t(element.dataset.languageKey, { count: element.dataset.count || '' });
  });
  btnLanguage.textContent = t('languageButton');
  btnLanguage.setAttribute('aria-label', t('languageLabel'));
  btnPause.textContent = paused ? t('resume') : t('pause');
  updateLabels();
  updateSpeechButton();
  if (debugOutput) refreshDebugView();
}

btnLanguage.addEventListener('click', () => {
  language = language === 'en' ? 'es' : 'en';
  try { localStorage.setItem(LANGUAGE_KEY, language); } catch (error) { console.warn('Could not save language preference:', error); }
  applyLanguage();
});
const debugToggle = document.getElementById('debug-toggle');
const debugPanel = document.getElementById('debug-panel');
const debugClose = document.getElementById('debug-close');
const debugOutput = document.getElementById('debug-output');
const debugCopy = document.getElementById('debug-copy');
const debugStatus = document.getElementById('debug-status');

const speedLabel     = document.getElementById('speed-label');
const remainingLabel = document.getElementById('remaining-label');
const currentCardEl  = document.getElementById('current-card');
const dealtStrip     = document.getElementById('dealt-strip');
const foldInnerLandscape = { get matches(){
  return document.documentElement.classList.contains('fold-inner-landscape');
} };

function updateFoldLayout(){
  const root = document.documentElement;
  const screenWidth = Number(window.screen?.width) || 0;
  const viewportWidth = Number(window.innerWidth) || 0;
  const viewportHeight = Number(window.innerHeight) || 0;
  const landscape = viewportWidth > viewportHeight;
  // iOS standalone can report a 373px layout viewport while the foldable outer display is 457px wide.
  // Use physical screen width to identify that device mode; its CSS is applied by the root class.
  const outerDisplayWidth = Math.max(screenWidth, viewportWidth);
  const isFoldOuter = !landscape && outerDisplayWidth >= 450 && outerDisplayWidth <= 500;
  const width = viewportWidth;

  root.classList.toggle('fold-outer', isFoldOuter);
  root.classList.toggle(
    'fold-inner-landscape',
    landscape && width >= 800 && width <= 1100
  );
  root.classList.toggle(
    'fold-inner-portrait',
    !landscape && width >= 600 && width <= 680
  );
  orderDealtCards();
  refreshDebugView();
}

window.addEventListener('resize', updateFoldLayout, { passive: true });
window.addEventListener('orientationchange', updateFoldLayout, { passive: true });
window.visualViewport?.addEventListener('resize', updateFoldLayout, { passive: true });
updateFoldLayout();

function getElementMetrics(element){
  if (!element) return 'not found';
  const rect = element.getBoundingClientRect();
  return `${Math.round(rect.width)}×${Math.round(rect.height)} at (${Math.round(rect.left)}, ${Math.round(rect.top)})`;
}

function getSafeAreaInsets(){
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  document.body.appendChild(probe);
  const styles = getComputedStyle(probe);
  const insets = `top ${styles.paddingTop}, right ${styles.paddingRight}, bottom ${styles.paddingBottom}, left ${styles.paddingLeft}`;
  probe.remove();
  return insets;
}

function refreshDebugView(){
  if (!debugOutput) return;
  const viewport = window.visualViewport;
  const root = document.documentElement;
  const main = document.querySelector('.main');
  const topbar = document.querySelector('.topbar');
  const currentCard = document.getElementById('current-card');
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const orientation = screen.orientation?.type || (window.innerWidth >= window.innerHeight ? 'landscape' : 'portrait');
  const rootClasses = root.className || '(none)';
  const mediaQueries = [
    '(max-width: 480px)',
    '(min-width: 450px) and (max-width: 500px) and (orientation: portrait)',
    '(min-width: 600px) and (max-width: 680px) and (orientation: portrait)',
    '(min-width: 800px) and (max-width: 1100px) and (orientation: landscape)',
  ];
  const breakpointResults = mediaQueries.map(query => `${window.matchMedia(query).matches ? t('yes') : t('no')} ${query}`).join('\n');

  debugOutput.textContent = [
    `${t('version')}: ${document.getElementById('version-counter')?.textContent.trim() || 'unknown'}`,
    `${t('captured')}: ${new Date().toISOString()}`,
    `${t('displayMode')}: ${standalone ? t('standalone') : t('browser')}`,
    `${t('orientation')}: ${orientation}`,
    `User agent: ${navigator.userAgent}`,
    '',
    t('windowScreen'),
    `${t('inner')}: ${window.innerWidth}×${window.innerHeight}`,
    `${t('outer')}: ${window.outerWidth}×${window.outerHeight}`,
    `${t('screen')}: ${screen.width}×${screen.height} (${t('avail')} ${screen.availWidth}×${screen.availHeight})` ,
    `${t('cssViewport')}: ${window.innerWidth}×${window.innerHeight} CSS px`,
    `${t('pixelRatio')}: ${window.devicePixelRatio}`,
    `${t('docClient')}: ${root.clientWidth}×${root.clientHeight}`,
    `${t('scroll')}: ${window.scrollX}, ${window.scrollY}`,
    '',
    t('visualViewport'),
    viewport
      ? `size: ${viewport.width.toFixed(1)}×${viewport.height.toFixed(1)}; offset: ${viewport.offsetLeft.toFixed(1)}, ${viewport.offsetTop.toFixed(1)}; page: ${viewport.pageLeft.toFixed(1)}, ${viewport.pageTop.toFixed(1)}; scale: ${viewport.scale}`
      : t('unavailable'),
    `${t('safeArea')}: ${getSafeAreaInsets()}`,
    '',
    t('layout'),
    `${t('activeClasses')}: ${rootClasses}`,
    `${t('outerWidth')}: max(${t('screen')} ${screen.width}px, viewport ${window.innerWidth}px) = ${Math.max(screen.width, window.innerWidth)}px; ${root.classList.contains('fold-outer') ? t('outerActive') : t('outerInactive')} (${t('portraitRange')})`,
    `${t('innerLayout')}: ${root.classList.contains('fold-inner-landscape') ? t('active') : t('inactive')} (${t('landscapeRange', { width: window.innerWidth })})`,
    `${t('topbar')}: ${getElementMetrics(topbar)}`,
    `${t('main')}: ${getElementMetrics(main)}`,
    `${t('currentCard')}: ${getElementMetrics(currentCard)}`,
    `${t('mainComputed')}: display ${main ? getComputedStyle(main).display : 'n/a'}; height ${main ? getComputedStyle(main).height : 'n/a'}`,
    '',
    t('breakpoints'),
    breakpointResults,
  ].join('\n');
}

function setDebugOpen(open){
  debugPanel.hidden = !open;
  debugToggle.setAttribute('aria-expanded', String(open));
  if (open) {
    refreshDebugView();
    debugClose.focus();
  } else {
    debugToggle.focus();
  }
}

debugToggle.addEventListener('click', () => setDebugOpen(true));
debugClose.addEventListener('click', () => setDebugOpen(false));
debugPanel.addEventListener('click', event => {
  if (event.target === debugPanel) setDebugOpen(false);
});
debugCopy.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(debugOutput.textContent);
    debugStatus.textContent = t('copied');
  } catch (error) {
    debugStatus.textContent = t('copyUnavailable');
  }
});
window.addEventListener('resize', refreshDebugView, { passive: true });
window.addEventListener('orientationchange', refreshDebugView, { passive: true });
window.addEventListener('pageshow', refreshDebugView, { passive: true });
window.visualViewport?.addEventListener('resize', refreshDebugView, { passive: true });
window.visualViewport?.addEventListener('scroll', refreshDebugView, { passive: true });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !debugPanel.hidden) setDebugOpen(false);
  if (event.key.toLowerCase() === 'd' && !['INPUT', 'TEXTAREA'].includes(event.target.tagName)) {
    setDebugOpen(debugPanel.hidden);
  }
});

// State
let fullDeck = [];     // array of image URLs
let remaining = [];    // undealt
let dealt = [];        // dealt history
let delayMs = DEFAULT_DELAY_MS;
let paused = false;
let timerId = null;
let speechEnabled = false;
let speechVoice = null;
let voiceUnlocked = false;
let audioPlayer = null;
let started = false;

const CARD_NAME_ALIASES = {
  'El Alacran': 'El Alacrán',
  'El Arbol': 'El Árbol',
  'El Bandolon': 'El Bandolón',
  'El Barril': 'El Barril',
  'El Camaron': 'El Camarón',
  'El Cantarito': 'El Cantarito',
  'El Catrin': 'El Catrín',
  'El Corazon': 'El Corazón',
  'El Cotorro': 'El Cotorro',
  'El Diablo': 'El Diablito',
  'El Gorrito': 'El Gorrito',
  'El Melon': 'El Melón',
  'El Musico': 'El Músico',
  'El Pajaro': 'El Pájaro',
  'El Pescado': 'El Pescado',
  'El Valiente': 'El Valiente',
  'El Violoncello': 'El Violoncello',
  'La Arana': 'La Araña',
  'La Bandera': 'La Bandera',
  'La Bota': 'La Bota',
  'La Botella': 'La Botella',
  'La Escalera': 'La Escalera',
  'La Garza': 'La Garza',
  'La Mano': 'La Mano',
  'La Muerte': 'La Muerte',
  'La Pera': 'La Pera',
  'La Sandia': 'La Sandía',
  'La Sirena': 'La Sirena',
};

function normalizeCardName(name){
  const raw = String(name || '').trim();
  if (!raw) return '';

  const withoutExtension = raw.replace(/\.[^/.]+$/, '');
  const withoutDuplicateSuffix = withoutExtension.replace(/\s+\(\d+\)$/, '');
  return CARD_NAME_ALIASES[withoutDuplicateSuffix] || withoutDuplicateSuffix;
}

// Labels
function updateLabels(){
  const speedSec = (delayMs/1000).toFixed(1);
  speedLabel.textContent = t('speed', { seconds: speedSec });
  remainingLabel.textContent = t('remaining', { count: remaining.length });
}

// Save preferences to localStorage
function savePreferences(){
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      delayMs,
      speechEnabled,
    }));
  } catch (e) {
    console.warn('Could not save preferences:', e);
  }
}

// Load preferences from localStorage
function loadPreferences(){
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const { delayMs: savedDelay, speechEnabled: savedSpeech } = JSON.parse(saved);
      if (savedDelay >= MIN_DELAY_MS) {
        delayMs = savedDelay;
      }
      if (typeof savedSpeech === 'boolean') {
        speechEnabled = savedSpeech;
      }
    }
  } catch (e) {
    console.warn('Could not load preferences:', e);
  }

  updateSpeechButton();
}

function restoreSavedVoicePreference(){
  if (!supportsSpeech()) {
    speechEnabled = false;
    updateSpeechButton();
    return;
  }

  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    speechEnabled = false;
    updateSpeechButton();
    return;
  }

  try {
    const parsed = JSON.parse(saved);
    if (typeof parsed.speechEnabled === 'boolean') {
      speechEnabled = parsed.speechEnabled;
      updateSpeechButton();
      if (speechEnabled) {
        speechVoice = pickSpeechVoice();
      }
    }
  } catch (e) {
    console.warn('Could not restore speech preference:', e);
    speechEnabled = false;
    updateSpeechButton();
  }
}

function createCardFrame(src, alt = 'Card', showBadge = false){
  const frame = document.createElement('div');
  frame.className = 'card-frame';

  const img = new Image();
  img.alt = alt;
  img.src = src;

  frame.appendChild(img);

  if (showBadge) {
    const badge = document.createElement('span');
    badge.className = 'card-badge';
    badge.textContent = t('artBy');
    frame.appendChild(badge);
  }

  return frame;
}

function showPlaceholder(key, values = {}){
  const countAttribute = values.count === undefined ? '' : ` data-count="${values.count}"`;
  currentCardEl.innerHTML = `<div class="placeholder" data-language-key="${key}"${countAttribute}>${t(key, values)}</div>`;
}

// Show card
function showCurrentCard(src){
  currentCardEl.innerHTML = '';
  currentCardEl.appendChild(createCardFrame(src, t('copyCard'), true));
  playCardAudio(src);
}

function getCardNameFromSrc(src){
  try {
    const url = new URL(src, window.location.href);
    const fileName = url.pathname.split('/').pop() || '';
    const decodedName = decodeURIComponent(fileName);
    return normalizeCardName(decodedName);
  } catch (error) {
    return '';
  }
}

function supportsSpeech(){
  return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

function pickSpeechVoice(){
  if (!supportsSpeech()) return null;
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(voice => /es|spanish/i.test(voice.lang))
    || voices.find(voice => /en|english/i.test(voice.lang))
    || voices[0];
  return preferred || null;
}

function updateSpeechButton(){
  if (!btnSpeech) return;
  const isActive = speechEnabled && supportsSpeech();
  btnSpeech.textContent = isActive ? t('voiceOn') : t('voiceOff');
  btnSpeech.classList.toggle('is-active', isActive);
  btnSpeech.setAttribute('aria-pressed', String(isActive));
}

function titleCaseAudioName(name){
  return name.replace(/\b[a-záéíóúñ]/gi, letter => letter.toUpperCase());
}

function getAudioNameCandidates(name){
  const normalized = normalizeCardName(name);
  const directMatch = CARD_NAME_ALIASES[normalized] || normalized;
  const titleCaseName = titleCaseAudioName(normalized);
  const titleCaseDirect = titleCaseAudioName(directMatch);
  return [...new Set([normalized, directMatch, titleCaseName, titleCaseDirect])];
}

async function playAudioName(name){
  if (!audioPlayer) {
    audioPlayer = new Audio();
    audioPlayer.preload = 'auto';
  }

  const candidates = getAudioNameCandidates(name);
  for (const candidate of candidates) {
    try {
      audioPlayer.src = `./audio/${encodeURIComponent(candidate)}.opus`;
      audioPlayer.currentTime = 0;
      await audioPlayer.play();
      return true;
    } catch (error) {
      audioPlayer.pause();
    }
  }

  return false;
}

function playCardAudio(src){
  if (!speechEnabled) return;

  const cardName = getCardNameFromSrc(src);
  if (!cardName) return;

  playAudioName(cardName).then(audioPlayed => {
    if (!audioPlayed) {
      speakCardName(src);
    }
  });
}

function unlockVoiceForSafari(){
  if (!supportsSpeech()) return;

  const unlockUtterance = new SpeechSynthesisUtterance('');
  unlockUtterance.lang = 'es-MX';
  unlockUtterance.volume = 0;
  unlockUtterance.rate = 1;
  unlockUtterance.pitch = 1;

  window.speechSynthesis.cancel();
  window.speechSynthesis.resume();
  window.speechSynthesis.speak(unlockUtterance);
  voiceUnlocked = true;
}

function speakIntroPhrase(){
  if (!supportsSpeech()) return;

  const introUtterance = new SpeechSynthesisUtterance('Corre y se va con');
  introUtterance.lang = 'es-MX';
  introUtterance.rate = 0.9;
  introUtterance.pitch = 1;
  introUtterance.volume = 1;

  if (speechVoice) {
    introUtterance.voice = speechVoice;
    introUtterance.lang = speechVoice.lang;
  }

  window.speechSynthesis.cancel();
  window.speechSynthesis.resume();
  window.setTimeout(() => {
    window.speechSynthesis.speak(introUtterance);
  }, 80);
}

function speakTestPhrase(){
  if (!speechEnabled || !supportsSpeech()) return;

  const testUtterance = new SpeechSynthesisUtterance('Prueba');
  testUtterance.lang = 'es-MX';
  testUtterance.rate = 0.9;
  testUtterance.pitch = 1;
  testUtterance.volume = 1;

  if (speechVoice) {
    testUtterance.voice = speechVoice;
    testUtterance.lang = speechVoice.lang;
  }

  window.speechSynthesis.cancel();
  window.speechSynthesis.resume();
  window.setTimeout(() => {
    if (speechEnabled) {
      window.speechSynthesis.speak(testUtterance);
    }
  }, 60);
}

function speakCardName(src){
  if (!speechEnabled || !supportsSpeech()) return;

  if (!voiceUnlocked) {
    unlockVoiceForSafari();
  }

  const spokenText = getCardNameFromSrc(src);
  if (!spokenText) return;

  const utterance = new SpeechSynthesisUtterance(spokenText);
  utterance.lang = 'es-MX';
  utterance.rate = 0.9;
  utterance.pitch = 1;
  utterance.volume = 1;

  if (!speechVoice) {
    speechVoice = pickSpeechVoice();
  }

  if (speechVoice) {
    utterance.voice = speechVoice;
    utterance.lang = speechVoice.lang;
  }

  window.speechSynthesis.cancel();
  window.speechSynthesis.resume();
  window.setTimeout(() => {
    if (speechEnabled) {
      window.speechSynthesis.speak(utterance);
    }
  }, 80);
}

// Add to dealt strip
function appendDealt(src){
  const frame = createCardFrame(src, t('dealtCard'), false);
  frame.dataset.dealtIndex = String(dealt.length - 1);
  dealtStrip.appendChild(frame);
  orderDealtCards();
}

function orderDealtCards(){
  const frames = Array.from(dealtStrip.children);
  frames.sort((a, b) => Number(b.dataset.dealtIndex) - Number(a.dataset.dealtIndex));
  dealtStrip.replaceChildren(...frames);
  if (foldInnerLandscape.matches) {
    dealtStrip.scrollTop = 0;
  }
  dealtStrip.scrollLeft = 0;
}

// Stop ticker
function stopTicker(){
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
}

// Start ticker
function startTicker(){
  stopTicker();
  if (!paused && remaining.length > 0) {
    timerId = setInterval(dealOne, delayMs);
  }
}

function beginGame(){
  if (started) {
    return;
  }

  started = true;
  if (speechEnabled && supportsSpeech()) {
    if (typeof window.speechSynthesis.resume === 'function') {
      window.speechSynthesis.resume();
    }
    speechVoice = pickSpeechVoice();
    unlockVoiceForSafari();
  }
  if (speechEnabled) {
    playAudioName('start').then(audioPlayed => {
      if (!audioPlayed && supportsSpeech()) speakIntroPhrase();
    });
  }

  remaining = [...fullDeck];
  dealt = [];
  showPlaceholder('cardsPlaceholder');
  dealtStrip.innerHTML = '';
  updateLabels();
  startTicker();
}

// Deal card
function dealOne(){
  if (paused || remaining.length === 0) return;
  const idx = Math.floor(Math.random() * remaining.length);
  const [card] = remaining.splice(idx, 1);
  dealt.push(card);

  showCurrentCard(card);
  appendDealt(card);
  updateLabels();

  if (remaining.length === 0) {
    stopTicker();
  }
}

// Reset game
function resetGame(){
  stopTicker();
  paused = false;
  btnPause.textContent = t('pause');
  btnPause.setAttribute('aria-pressed', false);

  remaining = [...fullDeck];
  dealt = [];
  showPlaceholder('cardsPlaceholder');
  dealtStrip.innerHTML = '';
  updateLabels();
}

// Controls
btnStart.addEventListener('click', () => {
  beginGame();
});

btnRestart.addEventListener('click', () => {
  started = false;
  resetGame();
  showPlaceholder('startPlaceholder');
  remaining = [...fullDeck];
  dealt = [];
  dealtStrip.innerHTML = '';
  updateLabels();
  stopTicker();
});

btnFaster.addEventListener('click', () => {
  delayMs = Math.max(MIN_DELAY_MS, delayMs - 1000);
  updateLabels();
  savePreferences();
  startTicker();
});

btnSlower.addEventListener('click', () => {
  delayMs += 1000;
  updateLabels();
  savePreferences();
  startTicker();
});

btnPause.addEventListener('click', () => {
  paused = !paused;
  btnPause.textContent = paused ? t('resume') : t('pause');
  btnPause.setAttribute('aria-pressed', paused);
  if (paused) stopTicker();
  else startTicker();
});

btnSpeech.addEventListener('click', () => {
  if (!supportsSpeech()) {
    speechEnabled = false;
    updateSpeechButton();
    savePreferences();
    return;
  }

  speechEnabled = !speechEnabled;
  if (speechEnabled) {
    if (typeof window.speechSynthesis.resume === 'function') {
      window.speechSynthesis.resume();
    }
    speechVoice = pickSpeechVoice();
    unlockVoiceForSafari();
    playAudioName('start').then(audioPlayed => {
      if (!audioPlayed) speakTestPhrase();
    });
  } else {
    if (audioPlayer) {
      audioPlayer.pause();
      audioPlayer.currentTime = 0;
    }
    window.speechSynthesis.cancel();
    voiceUnlocked = false;
  }

  updateSpeechButton();
  savePreferences();
});

if (supportsSpeech()) {
  window.speechSynthesis.onvoiceschanged = () => {
    speechVoice = pickSpeechVoice();
  };
  speechVoice = pickSpeechVoice();
}

restoreSavedVoicePreference();
btnStart.disabled = false;
applyLanguage();

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  switch (e.key.toLowerCase()) {
    case 'r':
      e.preventDefault();
      resetGame();
      break;
    case '<':
    case ',':
      e.preventDefault();
      btnFaster.click();
      break;
    case '>':
    case '.':
      e.preventDefault();
      btnSlower.click();
      break;
    case ' ':
      e.preventDefault();
      btnPause.click();
      break;
  }
});

// Show loading indicator
function showLoading(key = 'loading', values = {}) {
  showPlaceholder(key, values);
}

// Load cards.json
async function loadDeckList(){
  try {
    const res = await fetch('./Cards/cards.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}: cards.json not found`);
    const files = await res.json();
    if (!Array.isArray(files)) throw new Error('cards.json must be an array');
    return files.map(name => `./Cards/${name}`);
  } catch (err) {
    console.error('[cards] Error loading deck list:', err);
    showLoading('deckError');
    return [];
  }
}

// Verify images exist
function filterExistingImages(urls){
  showLoading('loadingCount', { count: urls.length });
  return Promise.all(urls.map((src, idx) => new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(src);
    img.onerror = () => {
      console.warn(`[cards] Failed to load: ${src}`);
      resolve(null);
    };
    img.src = src + `?cb=${Date.now()}`;
  }))).then(results => results.filter(Boolean));
}

// Init
(async function init(){
  loadPreferences();
  restoreSavedVoicePreference();
  fullDeck = await loadDeckList();
  fullDeck = await filterExistingImages(fullDeck);

  if (fullDeck.length === 0) {
    showPlaceholder('noCards');
    updateLabels();
    return;
  }
  remaining = [...fullDeck];
  dealt = [];
  updateLabels();
  showPlaceholder('startPlaceholder');
  dealtStrip.innerHTML = '';
  started = false;
  updateSpeechButton();
})();
