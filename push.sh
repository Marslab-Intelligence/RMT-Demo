#!/bin/bash

set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# Build the RMT image, push it to the on-prem container registry, and roll
# the Kubernetes deployment via the Helm chart in charts/rmt.
#
# This replaces the old AWS ECR / EC2 push flow — the app now runs entirely
# on the org's own k3s cluster. No AWS CLI, no ECR login, no IAM credential
# chain: registry auth is plain docker-registry basic auth (works against a
# self-hosted Docker Registry, Harbor, or Nexus).
#
# CREDENTIALS ARE NOT STORED IN THIS FILE — supply them via env vars:
#   REGISTRY_URL       e.g. registry.internal.marslab.local:5000 (required)
#   REGISTRY_USER       registry login username (required unless the
#                        registry allows anonymous push)
#   REGISTRY_PASSWORD   registry login password/token
#   KUBECONFIG          path to the on-prem cluster's kubeconfig, if not
#                        already the default (~/.kube/config)
# ─────────────────────────────────────────────────────────────────────────────

REGISTRY_URL="${REGISTRY_URL:?REGISTRY_URL is required, e.g. registry.internal.marslab.local:5000}"
REPO_NAME="${REPO_NAME:-rmt}"
IMAGE_TAG="${IMAGE_TAG:-v-$(date +%Y%m%d-%H%M%S)}"
LOCAL_IMAGE="${LOCAL_IMAGE:-renewal-management-system-app:latest}"
FULL_IMAGE="$REGISTRY_URL/$REPO_NAME:$IMAGE_TAG"

HELM_RELEASE="${HELM_RELEASE:-rmt}"
HELM_NAMESPACE="${HELM_NAMESPACE:-default}"
HELM_CHART="${HELM_CHART:-./charts/rmt}"
HELM_VALUES="${HELM_VALUES:-}"

if docker info >/dev/null 2>&1; then
  DOCKER="docker"
else
  DOCKER="sudo docker"
fi

# ── Registry login ───────────────────────────────────────────────────────────
if [ -n "${REGISTRY_PASSWORD:-}" ]; then
  echo "Logging into registry ($REGISTRY_URL)..."
  echo "$REGISTRY_PASSWORD" | $DOCKER login "$REGISTRY_URL" --username "${REGISTRY_USER:-admin}" --password-stdin
else
  echo "REGISTRY_PASSWORD not set — assuming docker is already authenticated to $REGISTRY_URL, or the registry allows anonymous push."
fi

# ── Build and push ───────────────────────────────────────────────────────────
echo "Building image..."
$DOCKER build --no-cache -t "$LOCAL_IMAGE" .

echo "Tagging image as $FULL_IMAGE..."
$DOCKER tag "$LOCAL_IMAGE" "$FULL_IMAGE"

echo "Pushing image..."
$DOCKER push "$FULL_IMAGE"

# ── Deploy via Helm ───────────────────────────────────────────────────────────
if ! command -v helm >/dev/null 2>&1; then
  echo "ERROR: helm not found. Install it, or run 'kubectl set image' manually against your own manifests." >&2
  exit 1
fi

echo "Rolling out $FULL_IMAGE via 'helm upgrade --install $HELM_RELEASE'..."
HELM_VALUES_ARG=()
if [ -n "$HELM_VALUES" ]; then
  HELM_VALUES_ARG=(-f "$HELM_VALUES")
fi

helm upgrade --install "$HELM_RELEASE" "$HELM_CHART" \
  --namespace "$HELM_NAMESPACE" \
  --create-namespace \
  --set image.repository="$REGISTRY_URL/$REPO_NAME" \
  --set image.tag="$IMAGE_TAG" \
  "${HELM_VALUES_ARG[@]}" \
  --wait --timeout 120s

echo "Done! Deployed $FULL_IMAGE"
