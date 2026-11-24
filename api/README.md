# Optional AI clue API

The static game keeps its original mode by default. This API accepts a known numeric card ID, looks up the card metadata on the server, and returns either a validated Spanish model clue or the built-in fallback clue. It listens on loopback and calls Ollama only at 127.0.0.1.

## Start with the repeatable fake model

Run these commands from the repository root.

~~~sh
export PATH="$HOME/.dotnet:$PATH"
ASPNETCORE_URLS=http://127.0.0.1:5050 \
  ClueModel__Provider=Fake \
  dotnet run --project api/Loteria.ClueApi
~~~

In a second terminal, build and run the static Nginx image.

~~~sh
podman build -t localhost/loteria:ticket3 .
podman run --rm -p 127.0.0.1:8080:80 localhost/loteria:ticket3
~~~

Open http://127.0.0.1:8080/?ai=dev to expose the developer-only AI control. The normal PWA URL keeps AI hidden and inactive.

## Connect to local Ollama

Keep Ollama and the clue API in separate terminals. Use a model already shown by ollama list.

~~~sh
ollama serve
~~~

~~~sh
export PATH="$HOME/.dotnet:$PATH"
ASPNETCORE_URLS=http://127.0.0.1:5050 \
  ClueModel__Provider=Ollama \
  ClueModel__Model=qwen3:8b \
  ClueModel__TimeoutMilliseconds=15000 \
  ClueModel__OllamaBaseUrl=http://127.0.0.1:11434 \
  dotnet run --project api/Loteria.ClueApi
~~~

Configuration uses standard ASP.NET Core keys.

| Setting | Default | Purpose |
| --- | --- | --- |
| ClueModel__Provider | Fake | Fake or Ollama |
| ClueModel__Model | llama3.2:3b | Local Ollama model name |
| ClueModel__TimeoutMilliseconds | 2500 | Model deadline from 100 to 30000 ms |
| ClueModel__OllamaBaseUrl | http://127.0.0.1:11434 | HTTP loopback Ollama address |
| ClueModel__FakeBehavior | Valid | Valid, Leak, Empty, Oversized, Timeout, or Error |

The API rejects a non-loopback Ollama URL during startup.

## Tests

~~~sh
dotnet run --project api/Loteria.ClueApi.Tests
deno test tests/ai-clue.test.js
~~~

The server tests cover valid model output, case- and accent-insensitive card-name leaks, empty output, oversized output, and model timeout. The browser-policy tests cover valid output, name leakage, API unavailability, client timeout, and caller cancellation.

Check the HTTP endpoint directly.

~~~sh
curl http://127.0.0.1:5050/health
curl http://127.0.0.1:5050/api/clues/10
~~~

## Browser demo

PWA mode:

1. Open the normal URL without the developer query parameter. The AI control is hidden and inactive.
2. Click **Start**. Cards reveal on the original schedule and the existing voice setting controls recorded calls.

Developer-only model mode:

1. Start either the fake or Ollama API on port 5050.
2. Open the game with `?ai=dev`, then click **AI clues: Off** once so it reads **AI clues: On**.
3. Click **Start**. A Spanish clue appears first, followed by the card reveal and existing recorded call.
4. Stop the API and leave AI clues enabled. The next draw shows the built-in clue and continues instead of stopping.
5. Click **Restart** during a pending clue to verify that its late response does not reveal a card.

## Real Ollama sample

The following results were observed with the existing local qwen3:8b model and a 15-second API timeout. These are separate from the fake-model tests.

| Card ID | Returned clue | API latency | Source |
| --- | --- | ---: | --- |
| 1 | Ave, canto al amanecer, símbolo de prosperidad. | 9956 ms | model |
| 10 | Creciente en la tierra, raíces en el tiempo. | 175 ms | model |
| 23 | Sombra que ilumina la noche. | 123 ms | model |
| 28 | Rosa, fruta dulce, colorido y fresco. | 171 ms | model |
| 42 | Risas que callan el tiempo. | 106 ms | model |

Five model clues were accepted and zero fell back. The first request included model warm-up. The browser has its own 3500 ms deadline, so a similarly cold first request displays the built-in clue while the API sample can still complete under its configured 15-second server deadline.
