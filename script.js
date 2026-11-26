/* Card Dealer PWA - Lotería Edition
 * Loads card filenames from /Cards/cards.json
 * Controls: Restart (R), Faster(-1s, <), Slower(+1s, >), Pause (Space)
 * Default speed: 5s per card
 * Random deals without repeats while cards remain
 * Dealt cards shown at bottom in order (left→right)
 */

const DEFAULT_DELAY_MS = 5000; // 5s per card
const MIN_DELAY_MS = 1000;     // 1s per card minimum
const STORAGE_KEY = 'loteria-preferences';
const AI_API_URL = window.LOTERIA_AI_API_URL || '';
const AI_CLUES_AVAILABLE = window.LOTERIA_ENABLE_AI === true
  || new URLSearchParams(window.location.search).get('ai') === 'dev';
const AI_REQUEST_TIMEOUT_MS = 3500;
const CLUE_DISPLAY_MS = 1800;
const CALLER_STALL_TIMEOUT_MS = 5000;
const SPOKEN_CALL_TIMEOUT_MS = 8000;
const ASSET_PRELOAD_CONCURRENCY = 4;
const UPCOMING_CARD_COUNT = 3;
const INTRO_CALL = 'Corre y se va con';

const THEME_STORAGE_KEY = 'loteria-theme';
const colorPreference = window.matchMedia('(prefers-color-scheme: dark)');
const themeSelect = document.getElementById('theme-select');
const themeColor = document.querySelector('meta[name="theme-color"]');

function applyTheme(){
  const dark = themeSelect.value === 'dark' || (themeSelect.value === 'system' && colorPreference.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  themeColor.content = dark ? '#112a21' : '#f7edda';
}

try {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  if (savedTheme === 'light' || savedTheme === 'dark') themeSelect.value = savedTheme;
} catch (error) {
  console.warn('Could not load theme preference:', error);
}
themeSelect.addEventListener('change', () => {
  applyTheme();
  try {
    localStorage.setItem(THEME_STORAGE_KEY, themeSelect.value);
  } catch (error) {
    console.warn('Could not save theme preference:', error);
  }
});
colorPreference.addEventListener('change', applyTheme);
applyTheme();

// UI elements
const btnStart   = document.getElementById('btn-start');
const btnRestart = document.getElementById('btn-restart');
const btnFaster  = document.getElementById('btn-faster');
const btnSlower  = document.getElementById('btn-slower');
const btnAi      = document.getElementById('btn-ai');
const TEXT = {
  start: 'Iniciar', pause: 'Pausar', resume: 'Continuar',
  paused: 'Pausado', finished: 'Mazo terminado',
  aiOn: 'Pistas de IA: activadas', aiOff: 'Pistas de IA: desactivadas',
  aiSource: 'Pista de IA', fallbackSource: 'Pista incluida',
  speed: '{seconds} s / carta', remaining: 'Restantes: {count}',
  cardsPlaceholder: 'Las cartas aparecerán aquí', startPlaceholder: 'Presiona Iniciar para comenzar',
  loading: 'Cargando el mazo...',
  deckError: 'Error al cargar la lista de cartas.', noCards: 'No se encontraron cartas.',
  copyCard: 'Carta actual', dealtCard: 'Carta repartida',
};

function t(key, values = {}) {
  let text = TEXT[key] || key;
  for (const [name, value] of Object.entries(values)) text = text.replaceAll(`{${name}}`, value);
  return text;
}

const speedLabel     = document.getElementById('speed-label');
const remainingLabel = document.getElementById('remaining-label');
const cardContent    = document.getElementById('card-content');
const gameStatus     = document.getElementById('game-status');
const dealtStrip     = document.getElementById('dealt-strip');

// State
let fullDeck = [];     // array of image URLs
let remaining = [];    // undealt
let dealt = [];        // dealt history
let delayMs = DEFAULT_DELAY_MS;
let paused = false;
let timerId = null;
let nextDealAt = 0;
let speechVoice = null;
let audioPlayer = null;
let callerController = null;
const assetPreloads = new Map();
let started = false;
let cardMetadataByFile = new Map();
let aiCluesEnabled = false;
let cluePending = false;
let clueRequestId = 0;
let clueController = null;

function normalizeCardName(name){
  const raw = String(name || '').trim();
  if (!raw) return '';

  const withoutExtension = raw.replace(/\.[^/.]+$/, '');
  return withoutExtension;
}

// Labels
function updateLabels(){
  const speedSec = (delayMs / 1000).toLocaleString('es', { maximumFractionDigits: 1 });
  speedLabel.textContent = t('speed', { seconds: speedSec });
  remainingLabel.textContent = t('remaining', { count: remaining.length });
}

// Save preferences to localStorage
function savePreferences(){
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      delayMs,
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
      const { delayMs: savedDelay } = JSON.parse(saved);
      if (Number.isFinite(savedDelay) && savedDelay >= MIN_DELAY_MS) {
        delayMs = savedDelay;
      }
    }
  } catch (e) {
    console.warn('Could not load preferences:', e);
  }
}

function createCardFrame(src, alt = 'Carta'){
  const frame = document.createElement('div');
  frame.className = 'card-frame';

  const img = new Image();
  img.alt = alt;
  img.src = src;

  frame.appendChild(img);

  return frame;
}

function showPlaceholder(key, values = {}){
  cardContent.innerHTML = `<div class="placeholder">${t(key, values)}</div>`;
}

function showClue(clue, source){
  const wrapper = document.createElement('div');
  wrapper.className = 'clue-card';
  const text = document.createElement('p');
  text.className = 'clue-text';
  text.textContent = clue;
  const label = document.createElement('span');
  label.className = 'clue-source';
  label.textContent = source === 'model' ? t('aiSource') : t('fallbackSource');
  wrapper.append(text, label);
  cardContent.replaceChildren(wrapper);
}

// Show card
function showCurrentCard(src){
  cardContent.innerHTML = '';
  cardContent.appendChild(createCardFrame(src, t('copyCard')));
  const cardName = getCardNameFromSrc(src);
  if (cardName) announce(cardName);
  startDealDelay();
}

function getFileNameFromSrc(src){
  try {
    const url = new URL(src, window.location.href);
    return decodeURIComponent(url.pathname.split('/').pop() || '');
  } catch (error) {
    return '';
  }
}

function getCardNameFromSrc(src){
  const fileName = getFileNameFromSrc(src);
  const metadata = cardMetadataByFile.get(fileName);
  return normalizeCardName(metadata?.name || fileName);
}

function supportsSpeech(){
  return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

function pickSpeechVoice(){
  const spanishVoices = window.speechSynthesis.getVoices().filter(voice => /^es([-_]|$)/i.test(voice.lang));
  const mexicanVoices = spanishVoices.filter(voice => /^es[-_]MX$/i.test(voice.lang));
  const isPremium = voice => /\b(premium|enhanced|natural|neural)\b/i.test(voice.name);
  return mexicanVoices.find(isPremium) || mexicanVoices[0]
    || spanishVoices.find(isPremium) || spanishVoices[0] || null;
}

function updateAiButton(){
  if (!btnAi) return;
  btnAi.hidden = !AI_CLUES_AVAILABLE;
  if (!AI_CLUES_AVAILABLE) {
    aiCluesEnabled = false;
    btnAi.disabled = true;
    btnAi.setAttribute('aria-pressed', 'false');
    return;
  }
  btnAi.textContent = aiCluesEnabled ? t('aiOn') : t('aiOff');
  btnAi.classList.toggle('is-active', aiCluesEnabled);
  btnAi.setAttribute('aria-pressed', String(aiCluesEnabled));
  btnAi.disabled = cluePending;
}

function getAudioUrl(name){
  return `./audio/${encodeURIComponent(name)}.mp3`;
}

function preloadAsset(url, priority = 'low'){
  if (!assetPreloads.has(url)) {
    const request = fetch(url, { cache: 'force-cache', priority })
      .then(async response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        await response.arrayBuffer();
      })
      .catch(error => {
        assetPreloads.delete(url);
        console.warn(`[assets] Could not preload ${url}:`, error);
      });
    assetPreloads.set(url, request);
  }
  return assetPreloads.get(url);
}

function getCardAssets(card){
  return [card, getAudioUrl(getCardNameFromSrc(card))];
}

function preloadUpcomingCards(){
  for (const card of remaining.slice(0, UPCOMING_CARD_COUNT)) {
    for (const url of getCardAssets(card)) void preloadAsset(url, 'high');
  }
}

async function preloadDeck(){
  const urls = fullDeck.flatMap(getCardAssets);
  let nextIndex = 0;

  async function worker(){
    while (nextIndex < urls.length) {
      await preloadAsset(urls[nextIndex++]);
    }
  }

  await Promise.all(Array.from({ length: ASSET_PRELOAD_CONCURRENCY }, worker));
}

function shuffleDeck(){
  const cards = [...fullDeck];
  for (let i = cards.length - 1; i > 0; i -= 1) {
    const index = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[index]] = [cards[index], cards[i]];
  }
  return cards;
}

function getCallerRate(){
  return Math.max(0.85, 1 + (DEFAULT_DELAY_MS - delayMs) / 10000);
}

function updateCallerRate(){
  if (!audioPlayer) return;
  const rate = getCallerRate();
  audioPlayer.defaultPlaybackRate = rate;
  audioPlayer.playbackRate = rate;
}

function playRecordedCall(name, signal){
  if (!audioPlayer) {
    audioPlayer = new Audio();
    audioPlayer.preservesPitch = true;
  }
  const player = audioPlayer;
  player.src = getAudioUrl(name);
  updateCallerRate();

  return new Promise(resolve => {
    let settled = false;
    let retried = false;
    let lastPosition = 0;
    const finished = () => finish(true);
    const failed = () => finish(false);
    let timeoutId = window.setTimeout(failed, CALLER_STALL_TIMEOUT_MS);

    function resetTimeout(){
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(failed, CALLER_STALL_TIMEOUT_MS);
    }

    function trackProgress(){
      if (player.currentTime === lastPosition) return;
      lastPosition = player.currentTime;
      resetTimeout();
    }

    function recoverPause(){
      // A natural ending can also fire pause. Let ended finish that call.
      if (!player.paused || player.ended) return;
      if (retried) {
        failed();
        return;
      }
      retried = true;
      resetTimeout();
      player.play().catch(failed);
    }

    function finish(played){
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      player.removeEventListener('ended', finished);
      player.removeEventListener('error', failed);
      player.removeEventListener('pause', recoverPause);
      player.removeEventListener('timeupdate', trackProgress);
      signal.removeEventListener('abort', failed);
      if (!played) player.pause();
      resolve(played);
    }

    player.addEventListener('ended', finished);
    player.addEventListener('error', failed);
    player.addEventListener('pause', recoverPause);
    player.addEventListener('timeupdate', trackProgress);
    signal.addEventListener('abort', failed);
    // Call play directly from the Start gesture so Safari enables this player for later cards.
    player.play().catch(failed);
  });
}

function unlockVoiceForSafari(){
  if (!supportsSpeech()) return;

  const unlockUtterance = new SpeechSynthesisUtterance('');
  unlockUtterance.lang = 'es-MX';
  unlockUtterance.volume = 0;
  window.speechSynthesis.resume();
  window.speechSynthesis.speak(unlockUtterance);
}

function speakCall(text, signal){
  if (!supportsSpeech()) return Promise.resolve();

  const synthesis = window.speechSynthesis;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = speechVoice?.lang || 'es-MX';
  utterance.rate = getCallerRate();
  if (speechVoice) utterance.voice = speechVoice;

  return new Promise(resolve => {
    let timeoutId = window.setTimeout(cancel, CALLER_STALL_TIMEOUT_MS);

    function finish(){
      window.clearTimeout(timeoutId);
      signal.removeEventListener('abort', cancel);
      utterance.onstart = utterance.onend = utterance.onerror = null;
      resolve();
    }

    function cancel(){
      finish();
      synthesis.cancel();
    }

    utterance.onstart = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(cancel, SPOKEN_CALL_TIMEOUT_MS);
    };
    utterance.onend = finish;
    utterance.onerror = finish;
    signal.addEventListener('abort', cancel);
    synthesis.speak(utterance);
  });
}

function announce(name, spokenText = name){
  if (callerController) return;

  const controller = new AbortController();
  const { signal } = controller;
  callerController = controller;
  stopTicker();
  playRecordedCall(name, signal)
    .then(played => {
      if (!played && !signal.aborted) return speakCall(spokenText, signal);
    })
    .catch(error => console.warn('[audio] Could not announce call:', error))
    .finally(() => {
      if (callerController !== controller) return;
      callerController = null;
      startTicker();
    });
}

function stopCaller(){
  const controller = callerController;
  callerController = null;
  controller?.abort();
}

// Add to dealt strip
function appendDealt(src){
  dealtStrip.prepend(createCardFrame(src, t('dealtCard')));
  resetDealtScroll();
}

function resetDealtScroll(){
  dealtStrip.scrollTop = 0;
  dealtStrip.scrollLeft = 0;
}

// Stop ticker
function stopTicker(){
  window.clearTimeout(timerId);
  timerId = null;
}

// The configured interval is the minimum time between deals, including the call.
function startTicker(){
  stopTicker();
  if (!started || cluePending || callerController) return;
  if (remaining.length === 0) {
    started = false;
    paused = false;
    updatePlayButton();
    return;
  }
  if (paused) return;
  timerId = window.setTimeout(() => {
    timerId = null;
    dealOne();
  }, Math.max(0, nextDealAt - performance.now()));
}

function startDealDelay(){
  nextDealAt = performance.now() + delayMs;
  startTicker();
}

function cancelPendingClue(){
  clueRequestId += 1;
  clueController?.abort();
  clueController = null;
  cluePending = false;
  updateAiButton();
}

function completeAiDraw(requestId, card){
  if (requestId !== clueRequestId || !started) return;
  cluePending = false;
  clueController = null;
  updateAiButton();
  showCurrentCard(card);
}

function beginGame(){
  if (started || fullDeck.length === 0) return;

  started = true;
  if (remaining.length !== fullDeck.length) remaining = shuffleDeck();
  dealt = [];
  showPlaceholder('cardsPlaceholder');
  dealtStrip.innerHTML = '';
  updateLabels();
  updatePlayButton();
  unlockVoiceForSafari();
  announce('start', INTRO_CALL);
  preloadUpcomingCards();
  startDealDelay();
}

// Deal card
function dealOne(){
  if (!started || paused || remaining.length === 0 || cluePending || callerController) return;
  const card = remaining.shift();
  preloadUpcomingCards();
  if (dealt.length > 0) {
    appendDealt(dealt[dealt.length - 1]);
  }
  dealt.push(card);

  updateLabels();

  if (!aiCluesEnabled) {
    showCurrentCard(card);
  } else {
    const metadata = cardMetadataByFile.get(getFileNameFromSrc(card));
    if (!metadata || !window.LoteriaAi) {
      aiCluesEnabled = false;
      updateAiButton();
      showCurrentCard(card);
    } else {
      cluePending = true;
      updateAiButton();
      const requestId = ++clueRequestId;
      clueController?.abort();
      clueController = new AbortController();
      window.LoteriaAi.requestClue({
        cardId: metadata.id,
        cardName: metadata.name,
        fallbackClue: metadata.builtInClue,
        apiUrl: AI_API_URL,
        timeoutMs: AI_REQUEST_TIMEOUT_MS,
        signal: clueController.signal,
      }).then(result => {
        if (requestId !== clueRequestId || !started) return;
        showClue(result.clue, result.source);
        window.setTimeout(() => completeAiDraw(requestId, card), CLUE_DISPLAY_MS);
      }).catch(error => {
        if (requestId === clueRequestId && !clueController?.signal.aborted) {
          console.warn('[ai-clue] Unexpected request failure:', error);
          showClue(metadata.builtInClue, 'fallback');
          window.setTimeout(() => completeAiDraw(requestId, card), CLUE_DISPLAY_MS);
        }
      });
    }
  }
}

function updatePlayButton(){
  const label = started ? (paused ? 'resume' : 'pause') : 'start';
  btnStart.textContent = t(label);
  const status = paused ? t('paused') : !started && dealt.length > 0 ? t('finished') : '';
  if (gameStatus.textContent !== status) gameStatus.textContent = status;
}

function restartGame(){
  if (fullDeck.length === 0) return;
  stopTicker();
  stopCaller();
  cancelPendingClue();
  remaining = shuffleDeck();
  started = false;
  paused = false;
  beginGame();
}

// Controls
btnStart.addEventListener('click', () => {
  if (!started) {
    beginGame();
    return;
  }
  paused = !paused;
  updatePlayButton();
  if (paused) stopTicker();
  else startDealDelay();
});

btnRestart.addEventListener('click', restartGame);

btnFaster.addEventListener('click', () => {
  delayMs = Math.max(MIN_DELAY_MS, delayMs - 1000);
  updateLabels();
  savePreferences();
  updateCallerRate();
  startDealDelay();
});

btnSlower.addEventListener('click', () => {
  delayMs += 1000;
  updateLabels();
  savePreferences();
  updateCallerRate();
  startDealDelay();
});

btnAi?.addEventListener('click', () => {
  if (!AI_CLUES_AVAILABLE) return;
  aiCluesEnabled = !aiCluesEnabled;
  updateAiButton();
  if (started) startTicker();
});

if (supportsSpeech()) {
  window.speechSynthesis.onvoiceschanged = () => {
    speechVoice = pickSpeechVoice();
  };
  speechVoice = pickSpeechVoice();
}

updateAiButton();

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.target.matches?.('input, select, textarea, [contenteditable]')) return;
  switch (e.key.toLowerCase()) {
    case 'r':
      e.preventDefault();
      restartGame();
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
      if (e.target.tagName === 'BUTTON') return;
      e.preventDefault();
      btnStart.click();
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
    return files.map(name => `./Cards/${encodeURIComponent(name)}`);
  } catch (err) {
    console.error('[cards] Error loading deck list:', err);
    return null;
  }
}

async function loadCardMetadata(){
  if (!AI_CLUES_AVAILABLE) {
    cardMetadataByFile = new Map();
    return;
  }

  try {
    const response = await fetch('./Cards/card-metadata.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}: card-metadata.json not found`);
    const cards = await response.json();
    if (!Array.isArray(cards)) throw new Error('card-metadata.json must be an array');
    cardMetadataByFile = new Map(cards.map(card => [card.file, card]));
  } catch (error) {
    console.error('[ai-clue] Could not load fallback clues:', error);
    cardMetadataByFile = new Map();
    aiCluesEnabled = false;
    btnAi.disabled = true;
  }
}

// Init
(async function init(){
  btnStart.disabled = true;
  btnRestart.disabled = true;
  loadPreferences();
  showLoading();
  const cards = await loadDeckList();
  if (!cards) {
    showPlaceholder('deckError');
    return;
  }
  fullDeck = cards;

  if (fullDeck.length === 0) {
    showPlaceholder('noCards');
    updateLabels();
    return;
  }
  await loadCardMetadata();
  remaining = shuffleDeck();
  // The service worker reloads the page on first activation. Warm its cache on that load.
  if (!navigator.serviceWorker || navigator.serviceWorker.controller) {
    void preloadAsset(getAudioUrl('start'), 'high');
    preloadUpcomingCards();
    void preloadDeck();
  }
  dealt = [];
  updateLabels();
  showPlaceholder('startPlaceholder');
  dealtStrip.innerHTML = '';
  btnStart.disabled = false;
  btnRestart.disabled = false;
  updateAiButton();
})();
