/* Card Dealer PWA - Lotería Edition
 * Loads cards from /cards/cards.json (JPG filenames)
 * Controls: Restart, Faster(-1s), Slower(+1s, min 1s), Pause (toggle)
 * Default speed: 5s per card
 * Random deals without repeats while cards remain
 * Dealt cards shown at bottom in order (left→right)
 */

const DEFAULT_DELAY_MS = 3000; // 5s per card
const MIN_DELAY_MS = 1000;     // 1s per card minimum

// UI elements
const btnRestart = document.getElementById('btn-restart');
const btnFaster  = document.getElementById('btn-faster');
const btnSlower  = document.getElementById('btn-slower');
const btnPause   = document.getElementById('btn-pause');

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

// Labels
function updateLabels(){
  speedLabel.textContent = `Speed: ${Math.round(delayMs/1000)}s / card`;
  remainingLabel.textContent = `Remaining: ${remaining.length}`;
}

// Show card
function showCurrentCard(src){
  currentCardEl.innerHTML = '';
  const img = new Image();
  img.alt = 'Current card';
  img.src = src;
  currentCardEl.appendChild(img);
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
  startTicker();
});

btnSlower.addEventListener('click', () => {
  delayMs += 1000;
  updateLabels();
  startTicker();
});

btnPause.addEventListener('click', () => {
  paused = !paused;
  btnPause.textContent = paused ? 'Resume' : 'Pause';
  if (paused) stopTicker();
  else startTicker();
});

// Load cards.json
async function loadDeckList(){
  try {
    const res = await fetch('./Cards/cards.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('cards.json not found');
    const files = await res.json();
    if (!Array.isArray(files)) throw new Error('cards.json must be an array');
    return files.map(name => `./Cards/${name}`);
  } catch (err) {
    console.error('[cards] Error loading deck list:', err);
    return [];
  }
}

// Verify images exist
function filterExistingImages(urls){
  return Promise.all(urls.map(src => new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(src);
    img.onerror = () => resolve(null);
    img.src = src + `?cb=${Date.now()}`;
  }))).then(results => results.filter(Boolean));
}

// Init
(async function init(){
  delayMs = DEFAULT_DELAY_MS;
  fullDeck = await loadDeckList();
  fullDeck = await filterExistingImages(fullDeck);

  if (fullDeck.length === 0) {
    currentCardEl.innerHTML = '<div class="placeholder">No cards found in /cards/cards.json</div>';
    updateLabels();
    return;
  }
  remaining = [...fullDeck];
  updateLabels();
  startTicker();
})();
