import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync, lstatSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const destination = path.resolve(
  option('--directory') ??
    path.join(
      args.includes('--global') ? homedir() : process.cwd(),
      '.agents/skills/fluid-foldkit',
    ),
);
const origin = process.env.FLUID_SKILL_ORIGIN ?? 'https://fff.timhanlon.com';
const manifestResponse = await fetch(`${origin}/skills/fluid-foldkit/manifest.json`);
if (!manifestResponse.ok || !manifestResponse.headers.get('content-type')?.includes('json'))
  throw new Error('Expected the published skill manifest as JSON. No files were written.');
const manifest = await manifestResponse.json();
const stateFile = path.join(destination, '.installed.json');
const previous = existsSync(stateFile)
  ? JSON.parse(readFileSync(stateFile, 'utf8'))
  : { files: {} };
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const prepared = [];
for (const [file, hash] of Object.entries(manifest.files)) {
  if (!/^[a-zA-Z0-9_./-]+$/.test(file) || file.startsWith('/') || file.split('/').includes('..'))
    throw new Error('Invalid skill manifest path.');
  const target = path.join(destination, file);
  for (
    let current = target;
    current.length >= destination.length;
    current = path.dirname(current)
  ) {
    if (existsSync(current) && lstatSync(current).isSymbolicLink())
      throw new Error(`Review the symlink at ${current} before installation.`);
    if (current === destination) break;
  }
  const response = await fetch(`${origin}/skills/fluid-foldkit/${file}`);
  if (!response.ok) throw new Error(`Could not fetch ${file}. No files were written.`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (digest(bytes) !== hash)
    throw new Error(`Integrity mismatch for ${file}. No files were written.`);
  if (existsSync(target)) {
    const local = digest(readFileSync(target));
    if (local !== hash && (!args.includes('--update') || local !== previous.files[file]))
      throw new Error(
        `Preserve and review ${target}. Use --update only for unchanged files from an earlier install.`,
      );
  }
  prepared.push({ file, target, bytes });
}
console.log(
  JSON.stringify(
    { destination, files: prepared.map(({ file }) => file), dryRun: args.includes('--dry-run') },
    null,
    2,
  ),
);
if (!args.includes('--dry-run')) {
  for (const { target, bytes } of prepared) {
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, bytes);
  }
  writeFileSync(stateFile, JSON.stringify(manifest, null, 2) + '\n');
}
