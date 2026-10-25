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

const speedLabel     = document.getElementById('speed-label');
const remainingLabel = document.getElementById('remaining-label');
const currentCardEl  = document.getElementById('current-card');
const dealtStrip     = document.getElementById('dealt-strip');
const foldInnerLandscape = window.matchMedia(
  '(min-width: 800px) and (max-width: 1100px) and (min-height: 550px) and (max-height: 800px) and (orientation: landscape) and (min-aspect-ratio: 27/20) and (max-aspect-ratio: 8/5)'
);

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
  speedLabel.textContent = `Speed: ${speedSec}s / card`;
  remainingLabel.textContent = `Remaining: ${remaining.length}`;
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
    badge.textContent = 'Art created by NRD';
    frame.appendChild(badge);
  }

  return frame;
}

// Show card
function showCurrentCard(src){
  currentCardEl.innerHTML = '';
  currentCardEl.appendChild(createCardFrame(src, 'Current card', true));
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
  btnSpeech.textContent = isActive ? 'Voice: On' : 'Voice: Off';
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
  const frame = createCardFrame(src, 'Dealt card', false);
  frame.dataset.dealtIndex = String(dealt.length - 1);
  dealtStrip.appendChild(frame);
  orderDealtCards();
}

function orderDealtCards(){
  const frames = Array.from(dealtStrip.children);
  frames.sort((a, b) => Number(a.dataset.dealtIndex) - Number(b.dataset.dealtIndex));
  if (foldInnerLandscape.matches) {
    frames.reverse();
  }
  dealtStrip.replaceChildren(...frames);
  if (foldInnerLandscape.matches) {
    dealtStrip.scrollTop = 0;
    dealtStrip.scrollLeft = 0;
  } else {
    dealtStrip.scrollLeft = dealtStrip.scrollWidth;
  }
}

if (typeof foldInnerLandscape.addEventListener === 'function') {
  foldInnerLandscape.addEventListener('change', orderDealtCards);
} else {
  foldInnerLandscape.addListener(orderDealtCards);
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
  currentCardEl.innerHTML = '<div class="placeholder">Cards will appear here</div>';
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
  btnPause.textContent = 'Pause';
  btnPause.setAttribute('aria-pressed', false);

  remaining = [...fullDeck];
  dealt = [];
  currentCardEl.innerHTML = '<div class="placeholder">Cards will appear here</div>';
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
  currentCardEl.innerHTML = '<div class="placeholder">Press Start to begin</div>';
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
  btnPause.textContent = paused ? 'Resume' : 'Pause';
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
function showLoading(message = 'Loading deck...') {
  currentCardEl.innerHTML = `<div class="placeholder">${message}</div>`;
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
    showLoading('❌ Error loading deck list. Check console.');
    return [];
  }
}

// Verify images exist
function filterExistingImages(urls){
  showLoading(`Loading ${urls.length} cards...`);
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
    currentCardEl.innerHTML = '<div class="placeholder">❌ No cards found in /Cards/cards.json</div>';
    updateLabels();
    return;
  }
  remaining = [...fullDeck];
  dealt = [];
  updateLabels();
  currentCardEl.innerHTML = '<div class="placeholder">Press Start to begin</div>';
  dealtStrip.innerHTML = '';
  started = false;
  updateSpeechButton();
})();
