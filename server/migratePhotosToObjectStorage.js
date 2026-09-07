// One-off migration: moves existing `visits.photo_data` base64 blobs out of
// Postgres and into MinIO/S3-compatible object storage, replacing each row's
// column value with the object key. Safe to re-run — only touches rows whose
// photo_data still looks like inline base64 (not already an object key).
//
// Requires MINIO_ENDPOINT/MINIO_ACCESS_KEY/MINIO_SECRET_KEY to be set (same
// vars server/services/objectStorage.js reads). Run manually once during the
// on-prem migration, after MinIO is up and reachable:
//   node server/migratePhotosToObjectStorage.js
import db from './db.js';
import { isObjectStorageConfigured, uploadVisitPhoto } from './services/objectStorage.js';

async function migrate() {
  if (!isObjectStorageConfigured()) {
    console.error('MinIO is not configured (MINIO_ENDPOINT/MINIO_ACCESS_KEY/MINIO_SECRET_KEY missing). Aborting.');
    process.exit(1);
  }

  const { rows } = await db.query(
    `SELECT id, photo_data FROM visits WHERE photo_data IS NOT NULL AND length(photo_data) > 500`
  );

  console.log(`Found ${rows.length} visit(s) with inline base64 photo data to migrate.`);

  let migrated = 0;
  let failed = 0;

  for (const visit of rows) {
    try {
      const key = await uploadVisitPhoto(visit.id, visit.photo_data);
      if (!key) {
        console.warn(`  - visit ${visit.id}: upload returned no key, skipping.`);
        continue;
      }
      await db.query('UPDATE visits SET photo_data = $1 WHERE id = $2', [key, visit.id]);
      migrated++;
      console.log(`  + visit ${visit.id}: migrated -> ${key}`);
    } catch (err) {
      failed++;
      console.error(`  ! visit ${visit.id}: migration failed —`, err.message);
    }
  }

  console.log(`\nDone. Migrated ${migrated}/${rows.length}, ${failed} failed.`);
  process.exit(failed > 0 ? 1 : 0);
}

migrate();
