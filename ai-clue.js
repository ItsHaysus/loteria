(function (global) {
  const MAX_CLUE_LENGTH = 120;

  function normalizeText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('es')
      .replace(/[^a-z0-9ñ]+/g, ' ')
      .trim();
  }

  function revealsCardName(clue, cardName) {
    const normalizedClue = ` ${normalizeText(clue)} `;
    const normalizedName = normalizeText(cardName);
    const coreName = normalizedName.replace(/^(el|la|los|las)\s+/, '');
    return [normalizedName, coreName]
      .filter(Boolean)
      .some(name => normalizedClue.includes(` ${name} `));
  }

  function validateClue(clue, cardName) {
    const cleaned = String(clue || '').replace(/\s+/g, ' ').trim();
    if (!cleaned) return { valid: false, reason: 'empty' };
    if (cleaned.length > MAX_CLUE_LENGTH) return { valid: false, reason: 'oversized' };
    if (revealsCardName(cleaned, cardName)) return { valid: false, reason: 'name_revealed' };
    return { valid: true, clue: cleaned };
  }

  async function requestClue({
    cardId,
    cardName,
    fallbackClue,
    apiUrl = '',
    timeoutMs = 3500,
    fetchImpl = global.fetch.bind(global),
    signal,
  }) {
    const controller = new AbortController();
    let externallyAborted = false;
    const abortFromCaller = () => {
      externallyAborted = true;
      controller.abort(signal?.reason);
    };
    signal?.addEventListener('abort', abortFromCaller, { once: true });
    if (signal?.aborted) abortFromCaller();
    const timeoutId = global.setTimeout(() => controller.abort('timeout'), timeoutMs);

    try {
      const response = await fetchImpl(`${apiUrl}/api/clues/${cardId}`, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const validation = validateClue(payload.clue, cardName);
      if (!validation.valid) {
        return { clue: fallbackClue, source: 'fallback', reason: validation.reason };
      }
      return {
        clue: validation.clue,
        source: payload.source === 'model' ? 'model' : 'fallback',
        reason: payload.reason || null,
        latencyMs: payload.latencyMs,
      };
    } catch (error) {
      if (externallyAborted) throw error;
      const reason = controller.signal.aborted ? 'client_timeout' : 'api_unavailable';
      return { clue: fallbackClue, source: 'fallback', reason };
    } finally {
      global.clearTimeout(timeoutId);
      signal?.removeEventListener('abort', abortFromCaller);
    }
  }

  global.LoteriaAi = {
    MAX_CLUE_LENGTH,
    normalizeText,
    revealsCardName,
    requestClue,
    validateClue,
  };
})(globalThis);
