#!/bin/bash

set -euo pipefail

# Restore counterpart to charts/rmt/templates/backup-cronjob.yaml's pg_dump
# backups. Run this from a machine with kubectl access to the cluster.
#
# Usage:
#   ./scripts/restore-postgres.sh <backup-file.sql.gz> [helm-release] [namespace]
#
# Lists available backups if no file is given:
#   ./scripts/restore-postgres.sh --list [helm-release] [namespace]

BACKUP_FILE="${1:?Usage: $0 <backup-file.sql.gz>|--list [helm-release] [namespace]}"
RELEASE="${2:-rmt}"
NAMESPACE="${3:-default}"

POSTGRES_STS="${RELEASE}-postgres"
BACKUP_PVC="${RELEASE}-backups"

# A throwaway pod that mounts the same backup PVC, so we can list/copy files
# out without needing exec access inside the CronJob's ephemeral pods.
BROWSE_POD="rmt-backup-browser"

ensure_browse_pod() {
  if ! kubectl -n "$NAMESPACE" get pod "$BROWSE_POD" >/dev/null 2>&1; then
    echo "Starting a temporary pod to browse the backup volume..."
    kubectl -n "$NAMESPACE" run "$BROWSE_POD" --image=busybox --restart=Never \
      --overrides="{\"spec\":{\"containers\":[{\"name\":\"$BROWSE_POD\",\"image\":\"busybox\",\"command\":[\"sleep\",\"3600\"],\"volumeMounts\":[{\"name\":\"backups\",\"mountPath\":\"/backups\"}]}],\"volumes\":[{\"name\":\"backups\",\"persistentVolumeClaim\":{\"claimName\":\"$BACKUP_PVC\"}}]}}"
    kubectl -n "$NAMESPACE" wait --for=condition=Ready pod/"$BROWSE_POD" --timeout=60s
  fi
}

cleanup_browse_pod() {
  kubectl -n "$NAMESPACE" delete pod "$BROWSE_POD" --ignore-not-found=true --wait=false >/dev/null 2>&1 || true
}
trap cleanup_browse_pod EXIT

if [ "$BACKUP_FILE" = "--list" ]; then
  ensure_browse_pod
  echo "Available backups in PVC '$BACKUP_PVC':"
  kubectl -n "$NAMESPACE" exec "$BROWSE_POD" -- ls -lh /backups
  exit 0
fi

echo "⚠️  This will REPLACE the current database contents of release '$RELEASE' (namespace '$NAMESPACE')."
read -p "Type the release name ('$RELEASE') to confirm: " CONFIRM
if [ "$CONFIRM" != "$RELEASE" ]; then
  echo "Aborted — confirmation did not match."
  exit 1
fi

ensure_browse_pod

echo "Copying $BACKUP_FILE out of the backup volume..."
kubectl -n "$NAMESPACE" cp "$BROWSE_POD:/backups/$BACKUP_FILE" "/tmp/$BACKUP_FILE"

echo "Scaling down the app deployment to avoid writes during restore..."
kubectl -n "$NAMESPACE" scale deployment/"$RELEASE" --replicas=0
kubectl -n "$NAMESPACE" wait --for=delete pod -l app.kubernetes.io/instance="$RELEASE",app.kubernetes.io/name=rmt --timeout=60s 2>/dev/null || true

echo "Restoring into $POSTGRES_STS-0..."
PGUSER=$(kubectl -n "$NAMESPACE" get secret "${RELEASE}-postgres-secret" -o jsonpath='{.data.POSTGRES_USER}' | base64 -d)
PGDATABASE=$(kubectl -n "$NAMESPACE" get secret "${RELEASE}-postgres-secret" -o jsonpath='{.data.POSTGRES_DB}' | base64 -d)

gunzip -c "/tmp/$BACKUP_FILE" | kubectl -n "$NAMESPACE" exec -i "${POSTGRES_STS}-0" -- \
  psql -U "$PGUSER" -d "$PGDATABASE"

echo "Scaling the app deployment back up..."
kubectl -n "$NAMESPACE" scale deployment/"$RELEASE" --replicas=1
kubectl -n "$NAMESPACE" rollout status deployment/"$RELEASE" --timeout=120s

rm -f "/tmp/$BACKUP_FILE"
echo "✅ Restore complete."
