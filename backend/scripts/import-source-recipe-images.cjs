const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
require('dotenv').config({ quiet: true });
const { v2: cloudinary } = require('cloudinary');
const apply = process.argv.includes('--apply');
const base = path.resolve('.local/meal-presentation-audit');
const manifestPath = path.resolve('src/data/panlasang-cloudinary-images.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const records = JSON.parse(fs.readFileSync(path.join(base, 'cloudinary-exact-matches.json'), 'utf8')).raw;
const inventory = JSON.parse(fs.readFileSync(path.join(base, 'cloudinary-inventory.json'), 'utf8'));
const inventoryIds = new Set(inventory.resources.map((asset) => asset.public_id));
const journalPath = path.join(base, 'source-photo-upload-results.json');
const journal = fs.existsSync(journalPath)
  ? JSON.parse(fs.readFileSync(journalPath, 'utf8'))
  : { startedAt: new Date().toISOString(), successes: [], failures: [] };
const uploadedIds = new Set(journal.successes.map((row) => row.publicId));
const publicIdFor = (id) =>
  'nutrimind/recipe-catalogue/' + crypto.createHash('sha256').update(id).digest('hex').slice(0, 28);
const candidates = records.filter((row) => {
  if (!row.sourceRecordId || !row.sourceImageUrl || manifest.recipes[row.sourceUrl]) return false;
  const photo = new URL(row.sourceImageUrl);
  const page = new URL(row.sourceUrl);
  if (
    photo.protocol !== 'https:' ||
    photo.hostname !== 'panlasangpinoy.com' ||
    !photo.pathname.startsWith('/wp-content/uploads/')
  )
    return false;
  if (page.protocol !== 'https:' || page.hostname !== 'panlasangpinoy.com') return false;
  const id = publicIdFor(row.sourceRecordId);
  return !inventoryIds.has(id) && !uploadedIds.has(id);
});
console.log(
  JSON.stringify({
    mode: apply ? 'upload' : 'dry-run',
    candidates: candidates.length,
    previousUploads: journal.successes.length,
    cloudName: manifest.cloudName,
    databaseWrites: false,
  })
);
function saveJournal() {
  fs.writeFileSync(journalPath, JSON.stringify(journal, null, 2) + '\n');
}
async function main() {
  if (!apply) return;
  const configUrl = new URL(process.env.CLOUDINARY_URL || '');
  if (configUrl.protocol !== 'cloudinary:' || configUrl.hostname !== manifest.cloudName)
    throw new Error('Cloudinary target mismatch');
  cloudinary.config({
    cloud_name: configUrl.hostname,
    api_key: decodeURIComponent(configUrl.username),
    api_secret: decodeURIComponent(configUrl.password),
    secure: true,
  });
  let cursor = 0,
    completed = 0;
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (cursor < candidates.length) {
        const row = candidates[cursor++];
        const publicId = publicIdFor(row.sourceRecordId);
        try {
          const response = await fetch(row.sourceImageUrl, {
            method: 'HEAD',
            redirect: 'manual',
            signal: AbortSignal.timeout(15000),
          });
          const contentType = response.headers.get('content-type') || '';
          if (!response.ok || !contentType.startsWith('image/')) {
            journal.failures.push({
              sourceRecordId: row.sourceRecordId,
              sourceUrl: row.sourceUrl,
              photoSourceUrl: row.sourceImageUrl,
              status: response.status,
              reason: 'Source photo unavailable',
            });
          } else {
            const asset = await cloudinary.uploader.upload(row.sourceImageUrl, {
              public_id: publicId,
              resource_type: 'image',
              overwrite: false,
              unique_filename: false,
              format: 'jpg',
              timeout: 60000,
              tags: ['nutrimind', 'panlasang-pinoy', 'source-recipe'],
            });
            if (asset.public_id !== publicId || !/^https:\/\/res\.cloudinary\.com\//.test(asset.secure_url))
              throw new Error('Upload identity mismatch');
            journal.successes.push({
              sourceRecordId: row.sourceRecordId,
              sourceUrl: row.sourceUrl,
              publicId,
              version: String(asset.version),
              format: asset.format,
              kind: 'EXACT',
              creator: 'Panlasang Pinoy',
              photoSourceUrl: row.sourceImageUrl,
            });
          }
        } catch (error) {
          // Provider messages can contain request details; retain only a bounded status.
          journal.failures.push({
            sourceRecordId: row.sourceRecordId,
            sourceUrl: row.sourceUrl,
            photoSourceUrl: row.sourceImageUrl,
            status: Number(error.http_code) || null,
            reason: 'Source check or upload failed',
          });
        }
        completed++;
        saveJournal();
        if (completed % 50 === 0 || completed === candidates.length)
          console.log(
            JSON.stringify({
              completed,
              total: candidates.length,
              uploaded: journal.successes.length,
              failed: journal.failures.length,
            })
          );
      }
    })
  );
  const grouped = new Map();
  for (const row of journal.successes) {
    const rows = grouped.get(row.sourceUrl) || [];
    rows.push(row);
    grouped.set(row.sourceUrl, rows);
  }
  for (const [sourceUrl, rows] of grouped) {
    if (new Set(rows.map((row) => row.photoSourceUrl)).size !== 1) throw new Error('Conflicting source photo records');
    const canonical = rows.find((row) => row.sourceRecordId.startsWith('pp_')) || rows[0];
    const { sourceUrl: ignoredSource, ...photo } = canonical;
    const aliases = rows
      .filter((row) => row.sourceRecordId !== canonical.sourceRecordId)
      .map((row) => row.sourceRecordId);
    manifest.recipes[sourceUrl] = { ...photo, ...(aliases.length ? { sourceRecordAliases: aliases } : {}) };
  }
  const recordsById = new Map(records.map((row) => [row.sourceRecordId, row]));
  for (const row of records) {
    const photo = manifest.recipes[row.sourceUrl];
    const canonical = photo && recordsById.get(photo.sourceRecordId);
    if (!photo || !canonical || row.sourceRecordId === photo.sourceRecordId) continue;
    if (
      !row.sourceRecordId.startsWith('DEMO_PREPARATION:') ||
      !row.sourceImageUrl ||
      row.sourceImageUrl !== canonical.sourceImageUrl
    )
      continue;
    photo.sourceRecordAliases = [...new Set([...(photo.sourceRecordAliases || []), row.sourceRecordId])];
  }
  manifest.verifiedAt = new Date().toISOString();
  manifest.recipes = Object.fromEntries(Object.entries(manifest.recipes).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  journal.completedAt = new Date().toISOString();
  saveJournal();
  console.log(
    JSON.stringify({
      complete: true,
      mappings: Object.keys(manifest.recipes).length,
      uploaded: journal.successes.length,
      failed: journal.failures.length,
      databaseWrites: false,
    })
  );
}
main().catch(() => {
  console.error('Photo import stopped. Check the configured target and local journal; credentials were not logged.');
  process.exitCode = 1;
});
