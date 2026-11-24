# Disposable full-stack kind lab

This lab runs the static Lotería game and the fake-provider ASP.NET clue API in one Podman-backed kind cluster. Nginx is the only component reached through the localhost port-forward. The clue API remains a ClusterIP service.

Run all commands from the repository root.

## Build and create the lab

Confirm the cluster name is unused before creating it.

~~~sh
KIND_EXPERIMENTAL_PROVIDER=podman kind get clusters
podman build -t localhost/loteria:v1 .
podman build -f api/Loteria.ClueApi/Dockerfile -t localhost/loteria-clue-api:fake-v1 .
KIND_EXPERIMENTAL_PROVIDER=podman kind create cluster --name loteria-lab --wait 120s
~~~

Load both local images without publishing them.

~~~sh
podman save --format docker-archive -o /tmp/loteria-web-v1.tar localhost/loteria:v1
podman save --format docker-archive -o /tmp/loteria-api-fake-v1.tar localhost/loteria-clue-api:fake-v1
KIND_EXPERIMENTAL_PROVIDER=podman kind load image-archive /tmp/loteria-web-v1.tar --name loteria-lab
KIND_EXPERIMENTAL_PROVIDER=podman kind load image-archive /tmp/loteria-api-fake-v1.tar --name loteria-lab
~~~

Deploy the internal API and web application.

~~~sh
kubectl apply \
  -f k8s/api-deployment.yaml \
  -f k8s/api-service.yaml \
  -f k8s/deployment.yaml \
  -f k8s/service.yaml
kubectl rollout status deployment/loteria-clue-api --timeout=120s
kubectl rollout status deployment/loteria --timeout=120s
~~~

## Use one localhost URL

Select an available port and forward only the web Service.

~~~sh
LOCAL_PORT=$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1]); s.close()')
kubectl port-forward --address 127.0.0.1 service/loteria "$LOCAL_PORT":80 >/tmp/loteria-full-stack-port-forward.log 2>&1 &
PORT_FORWARD_PID=$!
sleep 2
curl -sS -o /dev/null -w '%{http_code}\n' "http://127.0.0.1:$LOCAL_PORT/"
curl -sS "http://127.0.0.1:$LOCAL_PORT/api/clues/10"
printf 'Open http://127.0.0.1:%s/\n' "$LOCAL_PORT"
~~~

The first command should print 200. The second should return a fake clue with source set to model. AI clues remain off in the browser until the AI control is enabled.

## Verify fallback and recovery

Scale the internal API down and confirm the proxy reports an unavailable backend.

~~~sh
kubectl scale deployment/loteria-clue-api --replicas=0
kubectl wait --for=delete pod -l app.kubernetes.io/name=loteria-clue-api --timeout=60s
curl -sS -o /dev/null -w '%{http_code}\n' "http://127.0.0.1:$LOCAL_PORT/api/clues/10"
~~~

With AI clues enabled, the browser displays the card's built-in clue and continues drawing. Restore the API and verify recovery.

~~~sh
kubectl scale deployment/loteria-clue-api --replicas=1
kubectl rollout status deployment/loteria-clue-api --timeout=120s
curl -sS "http://127.0.0.1:$LOCAL_PORT/api/clues/10"
~~~

## Cleanup

~~~sh
kill "$PORT_FORWARD_PID"
KIND_EXPERIMENTAL_PROVIDER=podman kind delete cluster --name loteria-lab
rm -f /tmp/loteria-web-v1.tar /tmp/loteria-api-fake-v1.tar /tmp/loteria-full-stack-port-forward.log
~~~

The two tagged images remain in local Podman storage and are never published.
