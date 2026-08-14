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
const btnRestart = document.getElementById('btn-restart');
const btnFaster  = document.getElementById('btn-faster');
const btnSlower  = document.getElementById('btn-slower');
const btnPause   = document.getElementById('btn-pause');
const btnSpeech  = document.getElementById('btn-speech');

const speedLabel     = document.getElementById('speed-label');
const remainingLabel = document.getElementById('remaining-label');
const currentCardEl  = document.getElementById('current-card');
const dealtStrip     = document.getElementById('dealt-strip');

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

// Labels
function updateLabels(){
  const speedSec = (delayMs/1000).toFixed(1);
  speedLabel.textContent = `Speed: ${speedSec}s / card`;
  remainingLabel.textContent = `Remaining: ${remaining.length}`;
}

// Save preferences to localStorage
function savePreferences(){
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ delayMs }));
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
      if (savedDelay >= MIN_DELAY_MS) {
        delayMs = savedDelay;
      }
    }
  } catch (e) {
    console.warn('Could not load preferences:', e);
  }
}

// Show card
function showCurrentCard(src){
  currentCardEl.innerHTML = '';
  const img = new Image();
  img.alt = 'Current card';
  img.src = src;
  currentCardEl.appendChild(img);
  speakCardName(src);
}

function getCardNameFromSrc(src){
  try {
    const url = new URL(src, window.location.href);
    const fileName = url.pathname.split('/').pop() || '';
    return decodeURIComponent(fileName.replace(/\.[^/.]+$/, ''));
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

function unlockVoiceForSafari(){
  if (!supportsSpeech()) return;

  const utterance = new SpeechSynthesisUtterance('');
  utterance.lang = 'es-MX';
  utterance.volume = 0;
  utterance.rate = 1;
  utterance.pitch = 1;

  window.speechSynthesis.cancel();
  window.speechSynthesis.resume();
  window.speechSynthesis.speak(utterance);
  voiceUnlocked = true;
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
  const img = new Image();
  img.alt = 'Dealt card';
  img.src = src;
  dealtStrip.appendChild(img);
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

  startTicker();
}

// Controls
btnRestart.addEventListener('click', resetGame);

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
    return;
  }

  speechEnabled = !speechEnabled;
  if (speechEnabled) {
    if (typeof window.speechSynthesis.resume === 'function') {
      window.speechSynthesis.resume();
    }
    speechVoice = pickSpeechVoice();
    unlockVoiceForSafari();
    if (fullDeck.length > 0 && remaining.length > 0) {
      const current = remaining[0] || fullDeck[0];
      if (current) {
        speakCardName(current);
      }
    }
  } else {
    window.speechSynthesis.cancel();
    voiceUnlocked = false;
  }

  updateSpeechButton();
});

if (supportsSpeech()) {
  window.speechSynthesis.onvoiceschanged = () => {
    speechVoice = pickSpeechVoice();
  };
  speechVoice = pickSpeechVoice();
}

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
  fullDeck = await loadDeckList();
  fullDeck = await filterExistingImages(fullDeck);

  if (fullDeck.length === 0) {
    currentCardEl.innerHTML = '<div class="placeholder">❌ No cards found in /Cards/cards.json</div>';
    updateLabels();
    return;
  }
  remaining = [...fullDeck];
  updateLabels();
  currentCardEl.innerHTML = '<div class="placeholder">Cards will appear here</div>';
  startTicker();
})();
