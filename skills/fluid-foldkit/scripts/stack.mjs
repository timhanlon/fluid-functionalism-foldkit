import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function readStack(directory = '.') {
  const root = path.resolve(directory);
  const file = path.join(root, 'package.json');
  const manifest = JSON.parse(readFileSync(file, 'utf8'));
  const packages = { ...manifest.dependencies, ...manifest.devDependencies };
  const source = path.join(root, 'src/fluid');
  const components = path.join(source, 'components');
  const installed = existsSync(components)
    ? readdirSync(components).filter((name) => existsSync(path.join(components, name, 'index.ts')))
    : [];
  const resolvedPackages = {};
  for (const name of ['foldkit', '@foldkit/ui', 'effect', '@effect/platform-browser', 'motion']) {
    const installed = path.join(root, 'node_modules', name, 'package.json');
    if (existsSync(installed)) {
      const pkg = JSON.parse(readFileSync(installed, 'utf8'));
      resolvedPackages[name] = { version: pkg.version, peers: pkg.peerDependencies ?? {} };
    }
  }
  const wiring = [];
  for (const name of ['src/entry.ts', 'src/main.ts']) {
    const target = path.join(root, name);
    if (!existsSync(target)) continue;
    readFileSync(target, 'utf8')
      .split('\n')
      .forEach((line, index) => {
        if (/theme\.css|makeApplication|subscriptions|Command\.mapMessage/.test(line))
          wiring.push({ file: name, line: index + 1, text: line.trim() });
      });
  }
  const state = path.join(source, 'compat/applied.json');
  return {
    root,
    framework: packages.foldkit ? 'Foldkit' : 'Foldkit not declared in this package',
    packages: Object.fromEntries(
      ['foldkit', '@foldkit/ui', 'effect', '@effect/platform-browser', 'motion'].map((name) => [
        name,
        packages[name] ?? null,
      ]),
    ),
    resolvedPackages,
    wiringScope:
      'src/entry.ts and src/main.ts only; inspect alternate application entries manually. Peer ranges are facts for review, not an automatic compatibility verdict.',
    packageEvidence: `${file}:1`,
    installed,
    wiring,
    compatibility: existsSync(state)
      ? ((s) => ({ version: s.version, recordedFiles: Object.keys(s.files).length }))(
          JSON.parse(readFileSync(state, 'utf8')),
        )
      : null,
    prerequisites:
      'Native Foldkit source; Tailwind CSS v4 is required. React and components.json are not required.',
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1]))
  console.log(JSON.stringify(readStack(process.argv[2]), null, 2));
