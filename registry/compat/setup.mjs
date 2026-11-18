import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  readFileSync,
  writeFileSync,
  mkdtempSync,
  rmSync,
  existsSync,
  mkdirSync,
  renameSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyPatch, parsePatch } from 'diff';
import { prepareUpgrade, patchFile } from './migrate.mjs';

// Installed at src/fluid/compat/setup.mjs. pnpm owns manifest/workspace edits,
// patch registration and the ensuing install; this script never rewrites them.
const project = fileURLToPath(new URL('../../../', import.meta.url));
const ui = path.join(project, 'node_modules/@foldkit/ui');
const manifest = JSON.parse(readFileSync(path.join(ui, 'package.json'), 'utf8'));
const version = '0.171.0';
const pnpmVersion = execFileSync('pnpm', ['--version'], { encoding: 'utf8', cwd: project }).trim();
if (!pnpmVersion.startsWith('10.'))
  throw new Error(`Use pnpm 10 for this compatibility setup; found ${pnpmVersion}.`);
let workspace = project;
for (let directory = project; ; directory = path.dirname(directory)) {
  if (existsSync(path.join(directory, 'pnpm-workspace.yaml'))) {
    workspace = directory;
    break;
  }
  if (directory === path.dirname(directory)) break;
}
const customLockfileDir = execFileSync('pnpm', ['config', 'get', 'lockfile-dir'], {
  cwd: project,
  encoding: 'utf8',
}).trim();
if (customLockfileDir && customLockfileDir !== 'undefined') {
  throw new Error(
    'Use the documented manual pnpm patch workflow with a custom lockfile-dir. No files were changed.',
  );
}

const patch = readFileSync(new URL('./ui.patch', import.meta.url), 'utf8');
const digest = (value) => createHash('sha256').update(value).digest('hex');
const patches = parsePatch(patch);
const files = patches.map(patchFile);
const stateFile = fileURLToPath(new URL('./applied.json', import.meta.url));
const pendingFile = fileURLToPath(new URL('./upgrade.json', import.meta.url));
if (process.argv.includes('--prepare-upgrade')) {
  prepareUpgrade({ project, ui, version, patch, stateFile, pendingFile, digest });
  process.exit(0);
}
if (manifest.version !== version)
  throw new Error(
    `Fluid compatibility requires @foldkit/ui ${version}; found ${manifest.version}.`,
  );
const pending = existsSync(pendingFile) ? JSON.parse(readFileSync(pendingFile, 'utf8')) : undefined;
if (pending && pending.targetVersion !== version)
  throw new Error(
    'Prepared upgrade targets another version. Review upgrade.json before proceeding.',
  );
if (
  pending &&
  existsSync(fileURLToPath(new URL(`./upgrade-from-${pending.fromVersion}.json`, import.meta.url)))
)
  throw new Error(
    'The original upgrade archive already exists. Preserve it before completing this migration.',
  );
if (existsSync(stateFile) && !pending) {
  const state = JSON.parse(readFileSync(stateFile, 'utf8'));
  if (
    state.version !== version ||
    state.patch !== digest(patch) ||
    Object.keys(state.files).some(
      (file) => state.files[file] !== digest(readFileSync(path.join(ui, file))),
    )
  ) {
    throw new Error(
      'Compatibility state changed. Review your installed UI and patch before reapplying.',
    );
  }
  console.log('Fluid UI compatibility is already applied.');
} else {
  const temporary = mkdtempSync(path.join(tmpdir(), 'fluid-ui-patch-'));
  const edit = path.join(temporary, 'package');
  const run = (args) => execFileSync('pnpm', args, { cwd: project, stdio: 'inherit' });
  try {
    // Without --ignore-existing, pnpm includes any consumer-owned patch first.
    run(['patch', `@foldkit/ui@${version}`, '--edit-dir', edit]);
    const prepared = patches.map((change, index) => {
      const target = path.join(edit, files[index]);
      const result = applyPatch(readFileSync(target, 'utf8'), change);
      if (result === false)
        throw new Error(
          `Your existing patch conflicts in ${files[index]}. No compatibility patch was registered.`,
        );
      return { target, result };
    });
    for (const change of pending?.customPatch ? parsePatch(pending.customPatch) : []) {
      const file = patchFile(change),
        target = path.join(edit, file);
      const owned = prepared.find((entry) => entry.target === target);
      const current = owned?.result ?? (existsSync(target) ? readFileSync(target, 'utf8') : '');
      const result = applyPatch(current, change);
      if (result === false)
        throw new Error(
          `Consumer patch conflicts in ${file}. Review the saved upgrade.json; no new patch was registered.`,
        );
      if (owned) owned.result = result;
      else prepared.push({ target, result });
    }
    for (const { target, result } of prepared) {
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, result);
    }
    run([
      'patch-commit',
      edit,
      '--patches-dir',
      path.relative(workspace, fileURLToPath(new URL('./patches/', import.meta.url))),
    ]);
    writeFileSync(
      stateFile,
      JSON.stringify(
        {
          version,
          patch: digest(patch),
          canonicalPatch: patch,
          files: Object.fromEntries(
            prepared.map(({ target }) => {
              const file = path.relative(edit, target);
              return [file, digest(readFileSync(path.join(ui, file)))];
            }),
          ),
        },
        null,
        2,
      ) + '\n',
    );
    if (pending)
      renameSync(
        pendingFile,
        fileURLToPath(new URL(`./upgrade-from-${pending.fromVersion}.json`, import.meta.url)),
      );
    console.log(
      'Fluid UI compatibility applied through pnpm. Commit the generated patch, pnpm settings and lockfile with your app.',
    );
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}
