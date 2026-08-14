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

// State
let fullDeck = [];     // array of image URLs
let remaining = [];    // undealt
let dealt = [];        // dealt history
let delayMs = DEFAULT_DELAY_MS;
let paused = false;
let timerId = null;
let speechEnabled = false;
let voiceUnlocked = false;
let started = false;
let currentAudio = null;

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
  if (!supportsAudio()) {
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
    }
  } catch (e) {
    console.warn('Could not restore audio preference:', e);
    speechEnabled = false;
    updateSpeechButton();
  }
}

// Show card
function showCurrentCard(src){
  currentCardEl.innerHTML = '';
  const img = new Image();
  img.alt = 'Current card';
  img.src = src;
  currentCardEl.appendChild(img);
  playCardAudio(src);
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

function normalizeCardNameForAudio(cardName){
  // Normalize: capitalize first letter after "El " or "La "
  // This handles case sensitivity and matches audio filenames exactly
  if (!cardName) return cardName;
  
  // Match "El " or "La " at the start (case-insensitive)
  const match = cardName.match(/^(El|La)\s+(.+)$/i);
  if (match) {
    const prefix = match[1];
    const rest = match[2];
    // Capitalize first letter of the rest, keep accents intact
    const capitalized = rest.charAt(0).toUpperCase() + rest.slice(1);
    return `${prefix} ${capitalized}`;
  }
  
  return cardName;
}

function removeAccents(str){
  // Remove diacritical marks for fallback matching
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function supportsAudio(){
  // More robust check for Audio API support
  try {
    new Audio();
    return true;
  } catch (e) {
    return false;
  }
}

function updateSpeechButton(){
  if (!btnSpeech) return;
  try {
    const isActive = speechEnabled && supportsAudio();
    btnSpeech.textContent = isActive ? 'Voice: On' : 'Voice: Off';
    btnSpeech.classList.toggle('is-active', isActive);
    btnSpeech.setAttribute('aria-pressed', String(isActive));
  } catch (e) {
    console.warn('Error updating speech button:', e);
  }
}

function stopCurrentAudio(){
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
}

function playStartAudio(){
  if (!supportsAudio()) return;

  stopCurrentAudio();
  currentAudio = new Audio('./audio/start.mp3');
  currentAudio.volume = 1;
  currentAudio.play().catch(err => {
    console.warn('Could not play start audio:', err);
  });
}

function playTestAudio(){
  if (!speechEnabled || !supportsAudio()) return;

  stopCurrentAudio();
  currentAudio = new Audio('./audio/Prueba.mp3');
  currentAudio.volume = 1;
  currentAudio.play().catch(err => {
    console.warn('Could not play test audio:', err);
  });
}

function playCardAudio(src){
  if (!speechEnabled || !supportsAudio()) return;

  let cardName = getCardNameFromSrc(src);
  if (!cardName) return;

  // Normalize to match audio filename format
  cardName = normalizeCardNameForAudio(cardName);

  stopCurrentAudio();
  
  // Try to play with accents first
  const audioPath = `./audio/${cardName}.mp3`;
  currentAudio = new Audio(audioPath);
  currentAudio.volume = 1;
  
  currentAudio.addEventListener('error', () => {
    // Fallback: try without accents if file not found
    console.warn(`Audio not found at ${audioPath}, trying without accents...`);
    const cardNameNoAccents = removeAccents(cardName);
    const audioPathNoAccents = `./audio/${cardNameNoAccents}.mp3`;
    
    stopCurrentAudio();
    currentAudio = new Audio(audioPathNoAccents);
    currentAudio.volume = 1;
    currentAudio.play().catch(err => {
      console.warn(`Could not play audio for ${cardName} or ${cardNameNoAccents}:`, err);
    });
  }, { once: true });
  
  currentAudio.play().catch(err => {
    console.warn(`Could not play audio for ${cardName}:`, err);
  });
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

function beginGame(){
  if (started) {
    return;
  }

  started = true;
  if (speechEnabled && supportsAudio()) {
    playStartAudio();
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
  btnPause.setAttribute('aria-pressed', 'false');

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
  btnPause.setAttribute('aria-pressed', String(paused));
  if (paused) stopTicker();
  else startTicker();
});

if (btnSpeech) {
  btnSpeech.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!supportsAudio()) {
      speechEnabled = false;
      updateSpeechButton();
      savePreferences();
      return;
    }

    speechEnabled = !speechEnabled;
    if (speechEnabled) {
      playTestAudio();
    } else {
      stopCurrentAudio();
    }

    updateSpeechButton();
    savePreferences();
  });
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
