FROM docker.io/library/nginx:stable-alpine

ENV CLUE_API_UPSTREAM=http://host.containers.internal:5050
ENV NGINX_ENVSUBST_FILTER=CLUE_API_UPSTREAM

COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY index.html styles.css script.js ai-clue.js service-worker.js manifest.json manifest.webmanifest /usr/share/nginx/html/
COPY Cards/ /usr/share/nginx/html/Cards/
COPY audio/ /usr/share/nginx/html/audio/
COPY Background/ /usr/share/nginx/html/Background/
COPY icons/ /usr/share/nginx/html/icons/
