import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { applyPatch, createTwoFilesPatch, parsePatch } from 'diff';

export function patchFile(change) {
  const file = change.newFileName?.replace(/^b\//, '');
  if (!file?.startsWith('dist/') || file.split('/').includes('..'))
    throw new Error('Unexpected compatibility patch path');
  return file;
}

/** Save the consumer delta before pnpm retires the old version's registration. */
export function prepareUpgrade({ project, ui, version, patch, stateFile, pendingFile, digest }) {
  if (existsSync(pendingFile))
    throw new Error(
      'An upgrade is already prepared. Install the new registry item, then run setup.',
    );
  const state = JSON.parse(readFileSync(stateFile, 'utf8'));
  if (existsSync(path.join(path.dirname(pendingFile), `upgrade-from-${state.version}.json`)))
    throw new Error(
      'An archived upgrade from this version already exists. Preserve and review it before preparing another.',
    );
  const installed = JSON.parse(readFileSync(path.join(ui, 'package.json'), 'utf8'));
  if (installed.version !== state.version || installed.version === version)
    throw new Error(
      'Prepare an upgrade while the recorded previous UI version is still installed.',
    );
  for (const [file, hash] of Object.entries(state.files))
    if (digest(readFileSync(path.join(ui, file))) !== hash)
      throw new Error(
        `Installed ${file} changed since setup. Preserve and review those edits first.`,
      );
  const oldCanonical = state.canonicalPatch ?? patch;
  if (digest(oldCanonical) !== state.patch)
    throw new Error(
      'Keep the previous ui.patch until preparation completes; its digest must match applied.json.',
    );
  const run = (args, options = {}) =>
    execFileSync('pnpm', args, { cwd: project, encoding: 'utf8', ...options });
  const registrations = JSON.parse(run(['config', 'get', 'patchedDependencies', '--json']) || '{}');
  const key = `@foldkit/ui@${state.version}`;
  const registered = registrations[key];
  if (typeof registered !== 'string') throw new Error(`No exact ${key} patch registration found.`);
  const registeredPatch = readFileSync(registered, 'utf8');
  const canonical = parsePatch(oldCanonical);
  const changes = parsePatch(registeredPatch);
  const files = [...new Set([...canonical, ...changes].map(patchFile))];
  const temporary = mkdtempSync(path.join(tmpdir(), 'fluid-ui-upgrade-'));
  const edit = path.join(temporary, 'pristine');
  try {
    run(['patch', key, '--ignore-existing', '--edit-dir', edit], { stdio: 'inherit' });
    const custom = files
      .flatMap((file) => {
        const original = existsSync(path.join(edit, file))
          ? readFileSync(path.join(edit, file), 'utf8')
          : '';
        const owned = canonical.find((change) => patchFile(change) === file);
        const base = owned ? applyPatch(original, owned) : original;
        const change = changes.find((entry) => patchFile(entry) === file);
        const expected = change ? applyPatch(original, change) : original;
        const actual = readFileSync(path.join(ui, file), 'utf8');
        if (base === false || expected === false || actual !== expected)
          throw new Error(`Cannot verify the old patch for ${file}. No registration was removed.`);
        return base === actual ? [] : [createTwoFilesPatch(`a/${file}`, `b/${file}`, base, actual)];
      })
      .join('\n');
    // This backup is written before patch-remove, which also deletes its patch file.
    writeFileSync(
      pendingFile,
      JSON.stringify(
        {
          fromVersion: state.version,
          targetVersion: version,
          state,
          registeredPatch,
          canonicalPatch: oldCanonical,
          customPatch: custom,
        },
        null,
        2,
      ) + '\n',
      { flag: 'wx' },
    );
    run(['patch-remove', key], { stdio: 'inherit' });
    console.log(
      `Saved the original patch and consumer delta in ${pendingFile}. Install the new item, then run setup.`,
    );
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}
