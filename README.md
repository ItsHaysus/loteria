# Lotería PWA

The normal application is an installable PWA. Docker, Kubernetes, and AI are retained as developer tooling and are inactive at the normal app URL.

## Install on iPhone

Serve the checkout over HTTPS (or use localhost for desktop development), open it in Safari, then choose **Share → Add to Home Screen → Add**. Launch Lotería from its Home Screen icon so it runs in standalone mode. Check portrait and landscape, draw several cards, scroll the dealt-card strip, and confirm recorded calls play after enabling Voice.

The responsive smoke test covers exact CSS viewports for iPhone SE, 13 mini, 15, 18 Pro, Air, 18 Pro Max, and iPhone Duo outer/inner displays. It checks safe-area layout, 44px touch targets, overflow, card rendering, and that the normal PWA keeps AI hidden. With a static server on port 8000 and geckodriver on port 4444:

```sh
deno run \
  --allow-net=127.0.0.1:4444,127.0.0.1:8000,127.0.0.1:9222 \
  --allow-write=/tmp/loteria-iphone-layouts \
  tests/pwa-iphone-layout.mjs
```

This is a responsive-layout smoke test, not a replacement for installing the app on physical iPhone hardware and checking Mobile Safari behavior.

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
curl -fsS -o /dev/null http://localhost:8080/audio/El%20%C3%81rbol.opus
```

In the browser, click Start and check that the cards appear and recorded calls play with audio enabled. Try pausing, resuming, changing speed, and restarting.

## Retained developer tooling

See [api/README.md](api/README.md) for the explicit developer opt-in.

For the disposable Podman-backed kind deployment with an internal fake API, see [k8s/full-stack.md](k8s/full-stack.md).
