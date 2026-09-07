# RMT — On-Prem Kubernetes Deployment

Replaces the old AWS ECR + EC2 + EKS deployment path. RMT still runs on
Kubernetes — what's leaving is AWS, not Kubernetes. This chart targets the
org's own **k3s** cluster (confirmed from `k3s/app-deployment.yaml`, the
previous raw manifest this chart supersedes).

## What this chart deploys

- `rmt` — the app `Deployment`/`Service` (Node/Express + built React frontend, same image as before)
- `rmt-postgres` — Postgres as an in-cluster `StatefulSet` (replaces any AWS-managed Postgres assumption; there wasn't one in the live setup — `postgres-service` was already in-cluster)
- `rmt-minio` — MinIO (S3-compatible object storage) for visit photos, replacing base64-in-Postgres
- `rmt-postgres-backup` — nightly `pg_dump` `CronJob` writing to a PVC, since there's no managed-DB automatic backup anymore
- `Ingress` + `cert-manager` annotation for TLS, replacing the AWS Load Balancer Controller / ALB

## Prerequisites (cluster-level, install once, not part of this chart)

1. **A container registry** reachable from the cluster — a self-hosted Docker Registry, Harbor, or Nexus. Not included here; point `push.sh`/`values.yaml image.repository` at it.
2. **A `StorageClass`** for persistent volumes — Longhorn is the standard lightweight choice for k3s:
   ```
   helm repo add longhorn https://charts.longhorn.io
   helm install longhorn longhorn/longhorn -n longhorn-system --create-namespace
   ```
   Set `storageClass: longhorn` in values (default), or point at whatever the cluster already has.
3. **ingress-nginx**:
   ```
   helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
   helm install ingress-nginx ingress-nginx/ingress-nginx -n ingress-nginx --create-namespace
   ```
4. **cert-manager**, plus a `ClusterIssuer` — an internal-CA issuer for a purely internal hostname, or a `letsencrypt-prod` issuer if the cluster has outbound HTTPS egress and the hostname is publicly resolvable:
   ```
   helm repo add jetstack https://charts.jetstack.io
   helm install cert-manager jetstack/cert-manager -n cert-manager --create-namespace --set installCRDs=true
   ```
   Then apply a `ClusterIssuer` resource and reference its name in `values.yaml` under `ingress.tls.clusterIssuer`.

## Network policy for this deployment: SMTP only

This deployment intentionally keeps **only SMTP** as an external network
dependency. Zoho Books webhook sync and Zoho Cliq notifications are left
**unconfigured** (not deleted from the code — see `values.yaml`'s comment
block):
- The Books webhook route (`POST /api/webhooks/zoho-books`) already fails
  closed (401) with no `ZOHO_BOOKS_WEBHOOK_SECRET` set, so it's inert.
- Cliq notifications already degrade to a console-log simulation with no
  webhook URL configured (`server/services/cliqService.js`).
- Zoho SSO was already removed from the app in an earlier pass — there's no
  login flow depending on it.

If network posture changes later and Books/Cliq should be re-enabled, add
`ZOHO_BOOKS_WEBHOOK_SECRET` / `ZOHO_CLIQ_WEBHOOK_URL` /
`ZOHO_CLIQ_SALES_WEBHOOK_URL` to `templates/secret.yaml` and a values
override — no other code changes needed.

## Required secrets (fill in before `helm install`)

| values.yaml key | Purpose |
|---|---|
| `postgres.password` | Postgres password |
| `secrets.jwtSecret` | JWT signing secret — 32+ random chars, e.g. `openssl rand -base64 48` |
| `secrets.refreshSecret` | Refresh-token signing secret — same generation method |
| `secrets.smtp.password` | SMTP password for the reminder-ladder/notification emails |
| `secrets.geminiApiKey` | Optional — AI agent falls back to regex-only matching without it |
| `minio.accessKey` / `minio.secretKey` | MinIO root credentials |

Never commit real values into `values.yaml`. Pass them via `-f my-secrets.yaml` (gitignored) or `--set`.

## Install

```
helm install rmt ./charts/rmt \
  --set image.repository=<your-registry>/rmt \
  --set image.tag=<tag> \
  --set hostname=rmt.internal.marslab.local \
  -f my-secrets.yaml
```

Or let `push.sh` do the build+push+`helm upgrade --install` in one step (see repo root `push.sh`).

## Post-install steps

1. **Create the MinIO bucket** (auto-created on first photo upload by `server/services/objectStorage.js`, nothing manual needed) — but if you have existing visit photos stored as base64 in Postgres, migrate them once MinIO is reachable:
   ```
   kubectl exec deploy/rmt -- node server/migratePhotosToObjectStorage.js
   ```
   (also runnable locally via `npm run migrate:photos` against a `MINIO_*`-configured `.env`)
2. **Verify the backup CronJob** ran at least once: `kubectl get cronjob rmt-postgres-backup` / `kubectl get jobs`.
3. To restore from a backup, see `../../scripts/restore-postgres.sh` at the repo root.

## Scaling note

`app.replicas` is pinned to `1` — `server/services/scheduler.js` runs the
reminder-ladder emails and status transitions as an in-process `node-cron`
job with no distributed lock. Do not raise replicas without first moving
that logic behind an internal API endpoint fired by a Kubernetes `CronJob`
(the alternative fix considered and deferred during this migration).
