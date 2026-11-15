import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { readStack } from './stack.mjs';

const directory = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '.';
const stack = readStack(directory);
const origin = process.env.FLUID_REGISTRY_ORIGIN ?? 'https://fff.timhanlon.com';
const json = async (url) => {
  const response = await fetch(url);
  if (!response.ok || !response.headers.get('content-type')?.includes('json'))
    throw new Error(
      `Expected registry JSON at ${url}; received ${response.status} ${response.headers.get('content-type')}`,
    );
  return response.json();
};
async function main() {
  const index = await json(`${origin}/r/registry.json`);
  const payloads = new Map(
    await Promise.all(
      index.items
        .filter((item) => item.name !== 'starter')
        .map(async (item) => [item.name, await json(`${origin}/r/${item.name}.json`)]),
    ),
  );
  const required = new Set();
  const exists = (file) =>
    file.target?.startsWith('~/src/fluid/') &&
    existsSync(path.join(stack.root, file.target.slice(2)));
  const visit = (name) => {
    if (required.has(name)) return;
    const payload = payloads.get(name);
    if (!payload) throw new Error(`Registry dependency ${name} is absent from the index.`);
    required.add(name);
    for (const dependency of payload.registryDependencies ?? [])
      visit(
        new URL(dependency).pathname
          .split('/')
          .pop()
          .replace(/\.json$/, ''),
      );
  };
  for (const [name, payload] of payloads) if ((payload.files ?? []).some(exists)) visit(name);
  const selected = process.argv[process.argv.indexOf('--diff') + 1];
  const results = [];
  for (const name of required)
    for (const file of payloads.get(name).files ?? []) {
      const relative = file.target?.replace(/^~\//, '');
      if (!relative?.startsWith('src/fluid/') || relative.split('/').includes('..')) continue;
      const target = path.join(stack.root, relative);
      if (!existsSync(target)) {
        results.push({ item: name, file: relative, status: 'MISSING' });
        continue;
      }
      const local = readFileSync(target, 'utf8').replace(/\r\n/g, '\n');
      const remote = file.content.replace(/\r\n/g, '\n');
      const result = {
        item: name,
        file: relative,
        status: local === remote ? 'CURRENT' : 'DIFFERS',
      };
      if (result.status === 'DIFFERS' && process.argv.includes('--diff') && selected === name) {
        const a = local.split('\n'),
          b = remote.split('\n');
        result.diff = Array.from({ length: Math.max(a.length, b.length) }, (_, i) =>
          a[i] === b[i] ? null : { line: i + 1, local: a[i] ?? null, registry: b[i] ?? null },
        ).filter(Boolean);
      }
      results.push(result);
    }
  console.log(
    JSON.stringify(
      {
        root: stack.root,
        registry: origin,
        changelog: `${origin}/changelog.md`,
        results,
        note: 'DIFFERS may be a local customization. MISSING includes newly required shared files. Review before replacement; no application files were changed.',
      },
      null,
      2,
    ),
  );
}
main().catch((error) => {
  console.error(
    `Cannot compare Fluid Foldkit updates: ${error.message}. Check network access or set FLUID_REGISTRY_ORIGIN to a trusted registry mirror. No application files were changed.`,
  );
  process.exitCode = 1;
});
