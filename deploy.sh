#!/bin/bash

set -euo pipefail

# Ships the current source tree to the on-prem build host and runs push.sh
# there (build image -> push to the internal registry -> helm upgrade).
# Replaces the old EC2/pem-key/AWS-profile flow — SSH_KEY/SSH_HOST now point
# at whatever on-prem box has docker + helm + a kubeconfig for the cluster,
# not an AWS EC2 instance.

SSH_KEY="${SSH_KEY:?SSH_KEY is required, e.g. /path/to/deploy_key}"
SSH_USER="${SSH_USER:-deploy}"
SSH_HOST="${SSH_HOST:?SSH_HOST is required, e.g. build.internal.marslab.local}"
REMOTE_DIR="${REMOTE_DIR:-/home/$SSH_USER/deploy-rmt}"

REGISTRY_URL="${REGISTRY_URL:?REGISTRY_URL is required}"
IMAGE_TAG="${IMAGE_TAG:-v-$(date +%Y%m%d-%H%M%S)}"

echo "=========================================="
echo "🚀 Deploying to $SSH_HOST (Image Tag: $IMAGE_TAG)"
echo "=========================================="

echo "📦 1. Creating source archive..."
tar --exclude='node_modules' --exclude='.git' --exclude='dist' -czf /tmp/rmt_code.tar.gz -C "$(pwd)" .

echo "📤 2. Uploading code to $SSH_HOST..."
scp -F /dev/null -o ConnectTimeout=15 -o StrictHostKeyChecking=no -i "$SSH_KEY" /tmp/rmt_code.tar.gz "$SSH_USER@$SSH_HOST:/home/$SSH_USER/"

echo "⚙️ 3. Building image, pushing to registry, and rolling the Helm release..."
ssh -F /dev/null -o ConnectTimeout=15 -o StrictHostKeyChecking=no -i "$SSH_KEY" "$SSH_USER@$SSH_HOST" "
  mkdir -p '$REMOTE_DIR'
  tar -xzf /home/$SSH_USER/rmt_code.tar.gz -C '$REMOTE_DIR'
  cd '$REMOTE_DIR'
  chmod +x push.sh
  REGISTRY_URL='$REGISTRY_URL' REGISTRY_USER='${REGISTRY_USER:-}' REGISTRY_PASSWORD='${REGISTRY_PASSWORD:-}' IMAGE_TAG='$IMAGE_TAG' ./push.sh
"

echo "=========================================="
echo "✅ Deployment completed successfully!"
echo "=========================================="
