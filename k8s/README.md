# Lotería kind lab

This lab runs the local static Nginx image in a disposable kind cluster using Podman. It does not publish the image. Run all commands from the repository root.

## Prerequisites

Verify that Podman is running and that `kind` and `kubectl` are installed.

```sh
podman version
kind version
kubectl version --client
```

## Create the cluster and deploy v1

Build the first tag, create the named cluster with the Podman provider, and copy the image directly into the kind node. The temporary archive avoids Podman tag-discovery differences in kind and does not publish the image.

```sh
podman build -t localhost/loteria:v1 .
KIND_EXPERIMENTAL_PROVIDER=podman kind create cluster --name loteria-lab --wait 120s
podman save --format docker-archive -o /tmp/loteria-v1.tar localhost/loteria:v1
KIND_EXPERIMENTAL_PROVIDER=podman kind load image-archive /tmp/loteria-v1.tar --name loteria-lab
kubectl apply -f k8s/deployment.yaml -f k8s/service.yaml
kubectl rollout status deployment/loteria --timeout=120s
kubectl get pods -l app.kubernetes.io/name=loteria
kubectl get service loteria
```

`imagePullPolicy: Never` makes a missing kind image fail visibly instead of pulling an unrelated registry image.

## Reach the app

Select an available loopback port, start the port-forward, and use the printed URL in a browser.

```sh
LOCAL_PORT=$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1]); s.close()')
kubectl port-forward --address 127.0.0.1 service/loteria "$LOCAL_PORT":80 >/tmp/loteria-port-forward.log 2>&1 &
PORT_FORWARD_PID=$!
sleep 2
curl -sS -o /dev/null -w '%{http_code}\n' "http://127.0.0.1:$LOCAL_PORT/"
printf 'Open http://127.0.0.1:%s/\n' "$LOCAL_PORT"
```

The curl result should be `200`.

## Delete a Pod and observe replacement

Record the Pod names, delete one, wait until every selected Pod is Ready, then compare the names. The Deployment controller creates a replacement because the desired replica count remains two.

```sh
kubectl get pods -l app.kubernetes.io/name=loteria
POD_TO_DELETE=$(kubectl get pods -l app.kubernetes.io/name=loteria -o jsonpath='{.items[0].metadata.name}')
kubectl delete pod "$POD_TO_DELETE" --wait=true
kubectl wait --for=condition=Ready pod -l app.kubernetes.io/name=loteria --timeout=120s
kubectl get pods -l app.kubernetes.io/name=loteria
```

## Roll out v2 and roll back to v1

For this deployment exercise, v2 is a second local tag of the tested image. Loading it into kind keeps the workflow registry-free. Changing the Pod template image triggers a rollout even though both tags currently contain the same application bytes.

```sh
podman tag localhost/loteria:v1 localhost/loteria:v2
podman save --format docker-archive -o /tmp/loteria-v2.tar localhost/loteria:v2
KIND_EXPERIMENTAL_PROVIDER=podman kind load image-archive /tmp/loteria-v2.tar --name loteria-lab
kubectl set image deployment/loteria nginx=localhost/loteria:v2
kubectl rollout status deployment/loteria --timeout=120s
kubectl get deployment loteria -o jsonpath='{.spec.template.spec.containers[0].image}{"\n"}'
kubectl rollout undo deployment/loteria
kubectl rollout status deployment/loteria --timeout=120s
kubectl get deployment loteria -o jsonpath='{.spec.template.spec.containers[0].image}{"\n"}'
```

The image queries should print `localhost/loteria:v2` after the rollout and `localhost/loteria:v1` after rollback.

## Cleanup

Stop the port-forward and delete the disposable cluster. The image remains only in local Podman storage unless you remove it separately.

```sh
kill "$PORT_FORWARD_PID"
KIND_EXPERIMENTAL_PROVIDER=podman kind delete cluster --name loteria-lab
rm -f /tmp/loteria-v1.tar /tmp/loteria-v2.tar
```
