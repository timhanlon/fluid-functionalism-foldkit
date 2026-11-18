export function additionalDocs(catalog, manifest) {
  const origin = catalog.origin;
  const skillCommand = `curl -fL ${origin}/skills/install.mjs -o /tmp/fluid-foldkit-skill-install.mjs\n# Review the downloaded installer, then:\nnode /tmp/fluid-foldkit-skill-install.mjs --global`;
  const docs = {
    overview: `# Fluid Foldkit\n\nEditable native Foldkit source adapted from Fluid Functionalism. Tailwind CSS v4 is required. React and components.json are not required.\n\n## Compatibility\n\nNode.js 22.22.2 or newer; pnpm 10.33.0. Foldkit/UI ${manifest.dependencies.foldkit}, Effect ${manifest.dependencies.effect}, Motion ${manifest.dependencies.motion}.\n\n## Empty project\n\n\`\`\`sh\nmkdir fluid-app\ncd fluid-app\npnpm init\nnpm pkg set type=module\npnpm dlx shadcn@4.23.0 add ${origin}/r/starter.json --yes\npnpm exec vite --host 127.0.0.1\n\`\`\`\n\nThe starter demonstrates Button, Select and DatePicker. It supplies src/main.ts, src/entry.ts, index.html, TypeScript and Vite configuration; use it only in an empty project. It does not install every component.\n\n## Existing application\n\nInstall the chosen /r/{component}.json using the standard shadcn CLI and follow its complete /docs/{component}.md guide. Editable source lands under src/fluid/. Enable @tailwindcss/vite in Vite and declare @layer theme, base, components, utilities; in the HTML head before styles load. Import ./fluid/tailwind.css once from src/entry.ts. Keep child Models, map Commands, handle OutMessages and lift exported subscriptions. Preserve scoped Mount cleanup. Review local edits before replacing shared source.\n\n## Site settings\n\nPass size (default/compact), radius (rounded/pill/sharp) and icons to components that expose them. These are component options, not React providers. Set --fluid-accent after the theme import and the light/dark class on html; omit the latter for System. data-hover=standard selects standard mounted hover behavior. Fonts are consumer supplied; preserve a selected family and weight instead of inventing an asset URL. Variable Inter's optical-size axis helps label weight changes hold their width.\n\n[Catalog and guides](${origin}/llms.txt). [Foldkit skill](${origin}/docs/skill.md). [Port changelog](${origin}/changelog.md).\n`,
    skill: `# Fluid Foldkit skill\n\nA native Foldkit skill with fresh stack reading, source installation and composition, interaction craft, custom motion, browser measurement and reviewed updates. It uses this port's registry and src/fluid paths. The upstream mickadesign React skill targets another runtime.\n\n## Install\n\n\`\`\`sh\n${skillCommand}\n\`\`\`\n\nThe installer verifies every file against the published manifest and refuses unreviewed local changes. --global writes ~/.agents/skills/fluid-foldkit; omit it for .agents/skills/fluid-foldkit in the current project. --directory <path> selects an explicit skill directory. --dry-run validates and reports without writing. --update replaces unchanged files from an earlier recorded install and rejects local customizations. Review any obsolete files separately.\n\nRead the installed SKILL.md, then run node <skill>/scripts/stack.mjs <application-directory>. It reads facts without changing the app. Use scripts/upgrade.mjs to compare installed source; it never replaces it. The optional browser audit has its own scripts/package.json and requires a permitted Chromium.\n\n## What it ships\n\n- [SKILL.md](${origin}/skills/fluid-foldkit/SKILL.md)\n- [Component catalog](${origin}/skills/fluid-foldkit/references/components.md)\n- [Component craft](${origin}/skills/fluid-foldkit/references/craft.md)\n- [Custom motion](${origin}/skills/fluid-foldkit/references/custom-motion.md)\n- [Stack audit](${origin}/skills/fluid-foldkit/references/stack-audit.md)\n- stack.mjs, upgrade.mjs and audit.mjs scripts, plus original design attribution.\n`,
    changelog: `# Fluid Foldkit changelog and updates\n\nThese are port-specific migration instructions. The visual /changelog page retains upstream React release notes as design history; those are not commands for updating Foldkit apps.\n\n## Foldkit 0.171.0\n\nKeep foldkit and @foldkit/ui at 0.171.0 with Effect 4.1.3 and @effect/platform-browser 4.1.3. Repository development tooling uses @foldkit/devtools 0.171.0, its MCP 0.26.0 and Vite plugin 0.29.0. Consumers need only their guide's runtime dependencies. The render-slot UI compatibility patch still applies. A previous patched installation needs the preparation procedure below before dependency changes.\n\n## Reviewed source updates\n\nRun the Foldkit skill stack and upgrade readers. Compare every installed component and shared dependency with this port's /r/registry.json and payloads. A difference may be a consumer customization, not an upstream fix. Preserve those changes; preview the CLI update with --dry-run and review file replacements before using --overwrite. Do not install the starter over an existing app.\n\n## Upgrading a pnpm compatibility version\n\nWhile the old UI, ui.patch and applied.json are still present, stage the current setup helpers separately. Review them and preserve any local helper edits before copying the approved replacements:\n\n\`\`\`sh\nmkdir -p /tmp/fluid-foldkit-compat\ncurl -fL ${origin}/compat/setup.mjs -o /tmp/fluid-foldkit-compat/setup.mjs\ncurl -fL ${origin}/compat/migrate.mjs -o /tmp/fluid-foldkit-compat/migrate.mjs\n# Review both files and preserve local helper edits before copying:\ncp /tmp/fluid-foldkit-compat/setup.mjs src/fluid/compat/setup.mjs\ncp /tmp/fluid-foldkit-compat/migrate.mjs src/fluid/compat/migrate.mjs\nnode src/fluid/compat/setup.mjs --prepare-upgrade\n\`\`\`\n\nPreparation verifies the installed old patch, saves the original registration, compatibility state and consumer delta in src/fluid/compat/upgrade.json, then lets pnpm patch-remove retire the old registration. Keep this backup. It prevents ERR_PNPM_UNUSED_PATCH during the dependency update. If the old canonical patch differs, retain its old ui.patch until preparation; do not replace it first. Unrecorded edits or conflicts require review.\n\nNow install the reviewed new component payload (for example Combobox), approving only reviewed source replacements, and run setup:\n\n\`\`\`sh\npnpm dlx shadcn@4.23.0 add ${origin}/r/combobox.json --yes\nnode src/fluid/compat/setup.mjs\n\`\`\`\n\nThe new patch is applied first, then the saved consumer delta. Conflicts stop before registering the new patch and retain upgrade.json for review. On success applied.json records the new version and the original backup becomes upgrade-from-{old-version}.json. Preserve the generated patch, pnpm settings, lockfile and both records. Do not remove applied.json to bypass checks. A custom lockfile-dir needs the manual pnpm patch workflow in the component guide. Restore your saved original files, package versions and registration if you abandon a prepared upgrade.\n\nRun typecheck, build and browser checks after migration. Same-version repeat setup and fresh installs are separate checks from a version upgrade.\n`,
  };
  const helper = (title, item, program) =>
    `# ${title}\n\nDelivery status: reusable Foldkit helper; it is not the upstream React API.\n\n## Install\n\n\`\`\`sh\npnpm dlx shadcn@4.23.0 add ${origin}/r/${item}.json --yes\n\`\`\`\n\nImport ./fluid/tailwind.css once from src/entry.ts. ${item === 'hover' ? 'Import ./fluid/fluid-hover/styles.css as shown below and retain the positioned hover scope.' : 'The helper TypeScript imports its CSS.'} For an empty project, follow /docs.md first. Save the following as src/main.ts with the starter's entry. No child Model or lifted subscriptions are needed.\n\n\`\`\`ts\n${program}\n\`\`\`\n\nPreserve the scoped Mount cleanup. Verify geometry, keyboard scrolling or pointer behavior in a real browser. [Design and custom-motion guidance](${origin}/skills/fluid-foldkit/references/custom-motion.md).\n`;
  docs.scrollbars = helper(
    'Scrollbars / ScrollArea',
    'scroll-area',
    `import { Schema } from 'effect';
import type { HtmlBuilder } from 'foldkit/html';
import * as ScrollArea from './fluid/components/scroll-area';
export const Model = Schema.Struct({});
export type Model = typeof Model.Type;
export type Message = never;
export const init = () => ({ model: {} });
export const update = (model: Model) => ({ model });
export const view = (_model: Model, h: HtmlBuilder<Message>) => ({
  title: 'ScrollArea',
  body: ScrollArea.view({ orientation: 'both', label: 'Scrollable records', style: 'height:240px;width:min(100%,480px)',
    children: [h.div([h.Style({ width: '900px' })], Array.from({length: 40}, (_, i) => h.p([], ['Row ' + i])))],
  }, h),
});`,
  );
  docs['fluid-hover'] = helper(
    'Fluid Hover',
    'hover',
    `import { Schema, Effect } from 'effect';
import { Mount } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import type { HtmlBuilder } from 'foldkit/html';
import { mountHover } from './fluid/fluid-hover/engine';
import './fluid/fluid-hover/styles.css';
export const Message = defineMessageUnion({ CompletedHover: {} });
const Hovered = Mount.define('Example.Hover', { messages: [Message.CompletedHover],
  execute: ({element}) => Effect.acquireRelease(
    Effect.sync(() => mountHover(element as HTMLElement, { itemSelector: '[data-item]', axis: 'y' })),
    (hover) => Effect.sync(() => hover.dispose()),
  ).pipe(Effect.as(Message.CompletedHover())),
});
export const Model = Schema.Struct({});
export type Model = typeof Model.Type;
export type Message = typeof Message.Type;
export const init = () => ({ model: {} });
export const update = (model: Model) => ({ model });
export const view = (_model: Model, h: HtmlBuilder<Message>) => ({ title: 'Hover',
  body: h.div([h.Class('ff-hover-scope'), h.Style({ display: 'flex', flexDirection: 'column', width: '240px' }), h.OnMount(Hovered())], ['One','Two','Three'].map(label => h.button([h.DataAttribute('item',''), h.Style({ position: 'relative', zIndex: '1', padding: '8px', background: 'transparent' })], [label]))),
});`,
  );
  const references = {
    motion: [
      'Motion',
      'The upstream springs module is not separately distributed by this port. Native components already own their animation. For custom browser Effects use Motion from motion, follow the installed control and reduced-motion handling, and release its animation handles through a scoped Mount.',
    ],
    reveal: [
      'Reveal',
      'The four upstream page-reveal classes and Skeleton orchestration are not a supported Foldkit registry item. This page demonstrates the design. Do not install the React reveal payload into Foldkit or claim a replacement is source parity.',
    ],
    sizes: [
      'Sizes',
      'tailwind.css supplies paired body/caption sizes and line heights. Components exposing size accept default or compact. There is no distributed React SizeProvider, useSize hook or complete standalone size-context item. Pass the same size through your composition and preserve native touch field behavior.',
    ],
    surfaces: [
      'Surfaces',
      'The base theme supplies --surface-1 through --surface-8, foreground and border tokens. Root tokens reach portals. It does not distribute the React Elevated primitive or a complete context/provider API. Use the shipped component surface behavior and explicit CSS tokens for custom surfaces.',
    ],
    typography: [
      'Typography',
      'The portable theme provides body/caption tokens and an optional Inter/system font stack. The website six-role scale, Google font picker and .typeset system are reference-only; there is no separately supported typography registry item. Supply font assets and heading typography in the application, and verify weight changes against actual loaded fonts.',
    ],
  };
  for (const [slug, [title, text]] of Object.entries(references))
    docs[slug] =
      `# ${title}\n\nDelivery status: design reference, not a separately supported registry installation.\n\n${text}\n\n## Available shared theme\n\n\`\`\`sh\npnpm dlx shadcn@4.23.0 add ${origin}/r/base.json --yes\n\`\`\`\n\nImport ./fluid/tailwind.css from src/entry.ts. This installs the available theme and attribution, not the upstream ${title} implementation. No private checkout is needed. Read [custom motion](${origin}/skills/fluid-foldkit/references/custom-motion.md) and [the component catalog](${origin}/llms.txt) for supported native compositions.\n`;
  return docs;
}
