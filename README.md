# Lotería PWA

The normal application is an installable PWA. Docker, Kubernetes, and AI are retained as developer tooling and are inactive at the normal app URL.

## Production hosting on Cloudflare

Production is a Cloudflare Worker named `loteria` serving static assets. Cloudflare should connect to the `ItsHaysus/loteria` GitHub repository with `master` as its production branch. There is no build step; the deploy command is `npx wrangler deploy` from the repository root.

`wrangler.jsonc` defines the Worker, and `.assetsignore` restricts uploads to the PWA shell, card art, recorded audio, backgrounds, and icons. Docker, Kubernetes, tests, and API source remain in the repository but are not published as web assets.

For a one-time manual deployment from a development machine with Node.js installed:

```sh
npx wrangler login
node tests/check-deck.mjs
npx wrangler deploy
```

## Build a sideloadable Android APK

The Android app bundles the same static game files, so it does not depend on the hosted site to launch or load cards and recorded calls. Building requires Node.js 22+, JDK 21, and Android SDK Platform 36. The Gradle wrapper downloads Gradle and the required Build Tools on the first build.

From the repository root, install the JavaScript dependencies and build the debug APK:

```sh
npm ci
npm run android:build
```

The installable APK is created at `android/app/build/outputs/apk/debug/app-debug.apk`. It is debug-signed for sideloading; Android may ask the recipient to allow installation from the app used to open the file. The generated APK can be shared directly. Keep the build machine's debug signing key if you need to create updates that install over this debug build.

`npm run android:build` stages only the game and its runtime assets in an ignored directory before syncing Capacitor. Update the app's Android icon from `icons/loteria-icon.svg`; it is regenerated during the build. No Google Play account or publishing setup is needed.

## Install on iPhone

Serve the checkout over HTTPS (or use localhost for desktop development), open it in Safari, then choose **Share → Add to Home Screen → Add**. Launch Lotería from its Home Screen icon so it runs in standalone mode. Check portrait and landscape, draw several cards, scroll the dealt-card strip, and confirm recorded calls play when you start the game.

The smoke test checks caller playback and covers exact CSS viewports for iPhone SE, 13 mini, 15, 18 Pro, Air, 18 Pro Max, and iPhone Duo outer/inner displays. It checks safe-area layout, 44px touch targets, overflow, card rendering, and that the normal PWA keeps AI hidden. With a static server on port 8000 and geckodriver on port 4444:

```sh
deno run \
  --allow-net=127.0.0.1:4444,127.0.0.1:8000,127.0.0.1:9222 \
  --allow-write=/tmp/loteria-iphone-layouts \
  tests/pwa-iphone-layout.mjs
```

Use a physical iPhone to verify Mobile Safari and Home Screen playback.

## Run locally with Docker

From the repository root, build the image and run it with Docker running.

```sh
docker build -t loteria:local .
docker run --rm -p 127.0.0.1:8080:80 loteria:local
```

Open `http://localhost:8080/`. Press Ctrl+C in the terminal to stop the container.

From a second terminal, check that the page, card list, and one recorded call are served.

```sh
curl -fsS -o /dev/null http://localhost:8080/
curl -fsS http://localhost:8080/Cards/cards.json
curl -fsS -o /dev/null http://localhost:8080/audio/El%20%C3%81rbol.mp3
```

In the browser, click Iniciar and check that the cards appear and recorded calls play. Try pausing, resuming, changing speed, and restarting.

The bundled MP3 calls use an original synthetic Mexican Spanish caller. [Qwen3-TTS VoiceDesign](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign) generated the reference voice, and [Qwen3-TTS Base](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-Base) used that synthetic reference across the deck. Both ran locally. The app plays the finished files and waits for each call to finish before the next deal.

The [CONADE guide to traditional Mexican games](https://historico.conade.gob.mx/eventos/autoctonos2015/paginas/autoctonos_libro.pdf) documents callers using verses that lead into the card name. The [traditional game demonstration](https://www.youtube.com/watch?v=e782OmumlyA) gives an example of the opening formula. Lotería keeps its short opener and card names, with the delivery modeled after a pregón. The generation prompt was:

> Voz de un hombre adulto de México, acento mexicano del centro del país, un cantador de lotería en una reunión de familia. Barítono cálido y resonante, sonrisa en la voz. Proyecta con alegría para que lo oiga toda la mesa, sin forzar ni gritar. Ritmo de pregón natural, con un leve ascenso en «Corre y se va con» como invitación a escuchar lo que sigue. Haz una pausa entre cartas; da énfasis a la sílaba tónica y cierra el nombre con una caída breve y segura. Dicción clara, vocales naturales, sin alargar en exceso. Habla, no cantes melodías. Solo voz, sin música, sin efectos ni ambiente.

The synthetic reference was “¡Corre y se va con…! ¡El gallo! ¡La sandía! ¡El violonchelo! ¡Las jaras!” The finished files are mono MP3s at 24 kHz with short pauses at the edges.

## Retained developer tooling

See [api/README.md](api/README.md) for the explicit developer opt-in.

For the disposable Podman-backed kind deployment with an internal fake API, see [k8s/full-stack.md](k8s/full-stack.md).
