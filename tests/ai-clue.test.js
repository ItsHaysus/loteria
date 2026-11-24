import '../ai-clue.js';

const { requestClue, validateClue } = globalThis.LoteriaAi;

function response(body, ok = true) {
  return { ok, status: ok ? 200 : 503, json: async () => body };
}

Deno.test('accepts a valid model clue', async () => {
  const result = await requestClue({
    cardId: 10,
    cardName: 'El Árbol',
    fallbackClue: 'Tiene raíces.',
    fetchImpl: async () => response({ clue: 'Da sombra con sus grandes ramas.', source: 'model', latencyMs: 4 }),
  });
  if (result.source !== 'model') throw new Error('Expected model source');
});

Deno.test('rejects card-name leaks across case and accents', () => {
  const result = validateClue('Mira EL ARBOL junto al camino.', 'El Árbol');
  if (result.valid || result.reason !== 'name_revealed') throw new Error('Expected name leak');
});

Deno.test('uses fallback when the API is unavailable', async () => {
  const result = await requestClue({
    cardId: 10,
    cardName: 'El Árbol',
    fallbackClue: 'Tiene raíces.',
    fetchImpl: async () => { throw new TypeError('connection refused'); },
  });
  if (result.source !== 'fallback' || result.reason !== 'api_unavailable') {
    throw new Error('Expected unavailable fallback');
  }
});

Deno.test('uses fallback on a client timeout', async () => {
  const result = await requestClue({
    cardId: 10,
    cardName: 'El Árbol',
    fallbackClue: 'Tiene raíces.',
    timeoutMs: 5,
    fetchImpl: (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }),
  });
  if (result.source !== 'fallback' || result.reason !== 'client_timeout') {
    throw new Error('Expected timeout fallback');
  }
});

Deno.test('caller cancellation does not produce a late fallback', async () => {
  const controller = new AbortController();
  const pending = requestClue({
    cardId: 10,
    cardName: 'El Árbol',
    fallbackClue: 'Tiene raíces.',
    signal: controller.signal,
    fetchImpl: (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }),
  });
  controller.abort('new draw');
  try {
    await pending;
    throw new Error('Expected cancellation');
  } catch (error) {
    if (error.message === 'Expected cancellation') throw error;
  }
});
