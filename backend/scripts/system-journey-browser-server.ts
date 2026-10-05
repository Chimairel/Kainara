import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { directory, harness } from './helpers/system-audit-harness';

async function main() {
  const h = await harness('6-browser');
  for (const key of ['none', 'diabetes', 'unknown', 'shellfish', 'rnd-a', 'admin']) await h.login(key);
  // The browser forwards requests to the guarded isolated API, never the owner's API.
  await writeFile(path.join(directory, 'browser-api.json'), JSON.stringify({ base: h.base }));
  console.log('Isolated browser API ready. Synthetic fixtures only.');
  process.on('SIGINT', () => {
    void h.close().then(() => process.exit(0));
  });
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
