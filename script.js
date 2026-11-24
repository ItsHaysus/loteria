/* Card Dealer PWA - Lotería Edition
 * Loads WebP card filenames from /Cards/cards.json
 * Controls: Restart (R), Faster(-1s, <), Slower(+1s, >), Pause (Space)
 * Default speed: 5s per card
 * Random deals without repeats while cards remain
 * Dealt cards shown at bottom in order (left→right)
 */

const DEFAULT_DELAY_MS = 5000; // 5s per card
const MIN_DELAY_MS = 1000;     // 1s per card minimum
const DEFAULT_SPEECH_ENABLED = true;
const STORAGE_KEY = 'loteria-preferences';
const AI_API_URL = window.LOTERIA_AI_API_URL || '';
const AI_CLUES_AVAILABLE = window.LOTERIA_ENABLE_AI === true
  || new URLSearchParams(window.location.search).get('ai') === 'dev';
const AI_REQUEST_TIMEOUT_MS = 3500;
const CLUE_DISPLAY_MS = 1800;

const isStandalonePwa = window.matchMedia('(display-mode: standalone)').matches
  || window.navigator.standalone === true;
document.documentElement.classList.toggle('pwa-standalone', isStandalonePwa);

// UI elements
const btnStart   = document.getElementById('btn-start');
const btnRestart = document.getElementById('btn-restart');
const btnFaster  = document.getElementById('btn-faster');
const btnSlower  = document.getElementById('btn-slower');
const btnPause   = document.getElementById('btn-pause');
const btnSpeech  = document.getElementById('btn-speech');
const btnAi      = document.getElementById('btn-ai');
const btnLanguage = document.getElementById('btn-language');
const LANGUAGE_KEY = 'loteria-language';
let language = 'en';
try { language = localStorage.getItem(LANGUAGE_KEY) === 'es' ? 'es' : 'en'; } catch (error) { console.warn('Could not load language preference:', error); }
const TEXT = {
  en: {
    start: 'Start', startTitle: 'Start the game', restart: 'Restart', restartTitle: 'Restart game (R)',
    faster: 'Faster (-1s)', fasterTitle: 'Speed up (< or comma)', slower: 'Slower (+1s)', slowerTitle: 'Slow down (> or period)',
    pause: 'Pause', resume: 'Resume', pauseTitle: 'Pause/Resume (Space)', voiceOn: 'Voice: On', voiceOff: 'Voice: Off', voiceTitle: 'Enable/disable spoken card names',
    aiOn: 'AI clues: On', aiOff: 'AI clues: Off', aiTitle: 'Enable optional AI clues', aiSource: 'AI clue', fallbackSource: 'Built-in clue',
    languageButton: 'Español', languageLabel: 'Switch language to Spanish', speed: 'Speed: {seconds}s / card', speedInitial: 'Speed: 5s / card',
    remaining: 'Remaining: {count}', remainingInitial: 'Remaining: —', cardsPlaceholder: 'Cards will appear here', startPlaceholder: 'Press Start to begin',
    loading: 'Loading deck...', loadingCount: 'Loading {count} cards...', deckError: '❌ Error loading deck list. Check console.',
    noCards: '❌ No cards found in /Cards/cards.json', dealt: 'Dealt (in order):',
    copyCard: 'Current card', dealtCard: 'Dealt card',
  },
  es: {
    start: 'Iniciar', startTitle: 'Iniciar el juego', restart: 'Reiniciar', restartTitle: 'Reiniciar el juego (R)',
    faster: 'Más rápido (-1s)', fasterTitle: 'Acelerar (< o coma)', slower: 'Más lento (+1s)', slowerTitle: 'Ralentizar (> o punto)',
    pause: 'Pausar', resume: 'Continuar', pauseTitle: 'Pausar/continuar (Espacio)', voiceOn: 'Voz: activada', voiceOff: 'Voz: desactivada', voiceTitle: 'Activar/desactivar nombres hablados',
    aiOn: 'Pistas IA: activadas', aiOff: 'Pistas IA: desactivadas', aiTitle: 'Activar pistas opcionales con IA', aiSource: 'Pista IA', fallbackSource: 'Pista incluida',
    languageButton: 'English', languageLabel: 'Cambiar idioma a inglés', speed: 'Velocidad: {seconds}s / carta', speedInitial: 'Velocidad: 5s / carta',
    remaining: 'Restantes: {count}', remainingInitial: 'Restantes: —', cardsPlaceholder: 'Las cartas aparecerán aquí', startPlaceholder: 'Presiona Iniciar para comenzar',
    loading: 'Cargando el mazo...', loadingCount: 'Cargando {count} cartas...', deckError: '❌ Error al cargar la lista. Revisa la consola.',
    noCards: '❌ No se encontraron cartas en /Cards/cards.json', dealt: 'Repartidas (en orden):',
    copyCard: 'Carta actual', dealtCard: 'Carta repartida',
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
  updateAiButton();
}

btnLanguage.addEventListener('click', () => {
  language = language === 'en' ? 'es' : 'en';
  try { localStorage.setItem(LANGUAGE_KEY, language); } catch (error) { console.warn('Could not save language preference:', error); }
  applyLanguage();
});
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
}

window.addEventListener('resize', updateFoldLayout, { passive: true });
window.addEventListener('orientationchange', updateFoldLayout, { passive: true });
window.visualViewport?.addEventListener('resize', updateFoldLayout, { passive: true });
updateFoldLayout();

// State
let fullDeck = [];     // array of image URLs
let remaining = [];    // undealt
let dealt = [];        // dealt history
let delayMs = DEFAULT_DELAY_MS;
let paused = false;
let timerId = null;
let speechEnabled = DEFAULT_SPEECH_ENABLED;
let speechVoice = null;
let voiceUnlocked = false;
let audioPlayer = null;
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
    speechEnabled = DEFAULT_SPEECH_ENABLED;
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

function createCardFrame(src, alt = 'Card'){
  const frame = document.createElement('div');
  frame.className = 'card-frame';

  const img = new Image();
  img.alt = alt;
  img.src = src;

  frame.appendChild(img);

  return frame;
}

function showPlaceholder(key, values = {}){
  const countAttribute = values.count === undefined ? '' : ` data-count="${values.count}"`;
  currentCardEl.innerHTML = `<div class="placeholder" data-language-key="${key}"${countAttribute}>${t(key, values)}</div>`;
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
  currentCardEl.replaceChildren(wrapper);
}

// Show card
function showCurrentCard(src){
  currentCardEl.innerHTML = '';
  currentCardEl.appendChild(createCardFrame(src, t('copyCard')));
  playCardAudio(src);
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
  return normalizeCardName(getFileNameFromSrc(src));
}

function supportsSpeech(){
  return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

function pickSpeechVoice(){
  if (!supportsSpeech()) return null;
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(voice => /^es-MX$/i.test(voice.lang))
    || voices.find(voice => /^es(-|$)/i.test(voice.lang));
  return preferred || null;
}

function updateSpeechButton(){
  if (!btnSpeech) return;
  const isActive = speechEnabled && supportsSpeech();
  btnSpeech.textContent = isActive ? t('voiceOn') : t('voiceOff');
  btnSpeech.classList.toggle('is-active', isActive);
  btnSpeech.setAttribute('aria-pressed', String(isActive));
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

function titleCaseAudioName(name){
  return name.replace(/\b[a-záéíóúñ]/gi, letter => letter.toUpperCase());
}

function getAudioNameCandidates(name){
  const normalized = normalizeCardName(name);
  const titleCaseName = titleCaseAudioName(normalized);
  return [...new Set([normalized, titleCaseName])];
}

async function playAudioName(name){
  if (!audioPlayer) {
    audioPlayer = new Audio();
    audioPlayer.preload = 'auto';
  }

  audioPlayer.pause();
  audioPlayer.volume = 1;
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
  if (paused || remaining.length === 0 || cluePending) return;
  if (aiCluesEnabled) {
    timerId = window.setTimeout(() => {
      timerId = null;
      dealOne();
    }, delayMs);
  } else {
    timerId = setInterval(dealOne, delayMs);
  }
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
  showCurrentCard(card);
  cluePending = false;
  clueController = null;
  updateAiButton();
  if (!paused && remaining.length > 0) startTicker();
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
  if (paused || remaining.length === 0 || cluePending) return;
  const idx = Math.floor(Math.random() * remaining.length);
  const [card] = remaining.splice(idx, 1);
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
      if (remaining.length > 0) startTicker();
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

  if (remaining.length === 0 || aiCluesEnabled) {
    stopTicker();
  }
}

// Reset game
function resetGame(){
  stopTicker();
  cancelPendingClue();
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
  await loadCardMetadata();
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
  updateAiButton();
})();
