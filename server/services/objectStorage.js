import { Client as MinioClient } from 'minio';

// S3-compatible object storage for visit photos — replaces storing base64
// image blobs directly in `visits.photo_data` (TEXT column), which bloats
// every pg_dump backup and every SELECT that touches the visits table.
// Talks to MinIO in-cluster on-prem; the client API is identical to talking
// to AWS S3, so this is the only file that would need to change if a future
// deployment used real S3 instead.
//
// Degrades gracefully: if MINIO_ENDPOINT isn't configured (e.g. still
// running against an un-migrated local dev DB), every function below is a
// no-op that returns null, and callers fall back to the legacy inline-base64
// path — this lets the migration roll out without a hard cutover.

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || '';
const MINIO_PORT = parseInt(process.env.MINIO_PORT || '9000', 10);
const MINIO_USE_SSL = process.env.MINIO_USE_SSL === 'true';
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || '';
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || '';
const MINIO_BUCKET = process.env.MINIO_BUCKET || 'rmt-visit-photos';

const isConfigured = Boolean(MINIO_ENDPOINT && MINIO_ACCESS_KEY && MINIO_SECRET_KEY);

let client = null;
let bucketEnsured = false;

function getClient() {
  if (!isConfigured) return null;
  if (!client) {
    client = new MinioClient({
      endPoint: MINIO_ENDPOINT,
      port: MINIO_PORT,
      useSSL: MINIO_USE_SSL,
      accessKey: MINIO_ACCESS_KEY,
      secretKey: MINIO_SECRET_KEY,
    });
  }
  return client;
}

async function ensureBucket() {
  if (bucketEnsured) return;
  const c = getClient();
  if (!c) return;
  const exists = await c.bucketExists(MINIO_BUCKET).catch(() => false);
  if (!exists) {
    await c.makeBucket(MINIO_BUCKET);
  }
  bucketEnsured = true;
}

export function isObjectStorageConfigured() {
  return isConfigured;
}

/**
 * Uploads a base64 data-URL or raw base64 photo string and returns the
 * object key to store in `visits.photo_data` in its place. Returns null if
 * object storage isn't configured (caller should keep the base64 as-is).
 */
export async function uploadVisitPhoto(visitId, base64Data) {
  const c = getClient();
  if (!c || !base64Data) return null;
  await ensureBucket();

  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(base64Data);
  const contentType = match ? match[1] : 'image/jpeg';
  const raw = match ? match[2] : base64Data;
  const buffer = Buffer.from(raw, 'base64');

  const key = `visits/${visitId}/${Date.now()}.jpg`;
  await c.putObject(MINIO_BUCKET, key, buffer, buffer.length, { 'Content-Type': contentType });
  return key;
}

/**
 * Returns a time-limited presigned URL for a stored object key, or null if
 * object storage isn't configured or the value isn't an object key (e.g.
 * it's still a legacy inline base64 string from before this migration).
 */
export async function getVisitPhotoUrl(objectKeyOrBase64) {
  const c = getClient();
  if (!c || !objectKeyOrBase64) return null;
  if (objectKeyOrBase64.startsWith('data:') || objectKeyOrBase64.length > 500) {
    // Legacy inline base64 value — not an object key, nothing to presign.
    return null;
  }
  return c.presignedGetObject(MINIO_BUCKET, objectKeyOrBase64, 60 * 60); // 1 hour
}
