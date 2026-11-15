---
name: fluid-foldkit
description: Install, compose, audit and update the native Foldkit port of Fluid Functionalism, including its source registry, interaction craft and custom motion. Use for Fluid Foldkit applications and its fff.timhanlon.com guides; the upstream React @fluid skill targets a different runtime.
---

# Fluid Foldkit

Use the editable native Foldkit components at <https://fff.timhanlon.com>.
Read <https://fff.timhanlon.com/llms.txt> for current public guides and versions.
Tailwind CSS v4 is required; React, components.json and a React provider are not prerequisites.

## Read the application

Run `node <skill>/scripts/stack.mjs <app-directory>` before advising, installing
or updating. It reads package versions, installed source and runtime wiring
fresh, with file references; it does not alter the application. In a monorepo,
select the actual application directory. Read existing project decisions before
recommending a change. Keep audit findings in the response unless asked to save.

## Install and compose

Use [the catalog](references/components.md) to select a component and its guide.
The Markdown guide contains the command, complete application and entry, API,
theme, compatibility and update instructions. Install with the standard shadcn
CLI and this port's `/r/<name>.json` URLs. Source lands in `src/fluid/`.

Read the relevant [craft section](references/craft.md) before wrapping or changing
a component. Keep its child Model, wrap Messages, map every returned Command and
handle OutMessages. Lift subscriptions when exported. Preserve scoped Mount
cleanup and complete primitive attribute bundles. Unique instance ids and stable
slotIds identify DOM slots, not shared model values. Some helpers are stateless;
follow their actual guide instead of adding unnecessary child state.

Use starter only in an empty project. For an existing application install the
chosen component; never overwrite its entry or configuration with starter files.
Review same-named files before replacement. For copied playground examples,
retain the configured composition and its runtime entry, not just its view.

## Audit and write custom UI

Read [stack-audit.md](references/stack-audit.md) for evidence-based advice and
[custom-motion.md](references/custom-motion.md) before inventing motion alongside
the components. Inspect the installed implementation for exact current values.
For a running app, `scripts/audit.mjs <url>` measures real pointer motion,
weight-related layout changes, control heights and transitions. Install its
optional Playwright dependency first with `npm install --ignore-scripts --prefix
<skill>/scripts` (an app-level pnpm workspace install can skip this directory).
Supply a permitted Chromium through CHROME_PATH if
needed. It is read-only by default; `--json <path>` explicitly saves measurements.

Report what a person sees, the affected surface, the evidence and the smallest
correction. Source inspection and Story/Scene simulation do not establish paint,
native focus, geometry, animation or physical touch. A new product behavior such
as fluid hover needs the user's intent; existing stillness may be deliberate.
Do not impose React MotionConfig or an unrelated framework migration. An empty
recommendation list is valid.

## Update installed source

Run `node <skill>/scripts/upgrade.mjs <app-directory>` to compare installed files
with the public registry, including shared dependencies. It writes nothing.
`--diff <item>` prints differing lines; differences are not proof that local
edits can be discarded. Review the installed source, diff and port changelog at
<https://fff.timhanlon.com/changelog.md> before applying an update.

For patched UI version changes, follow the guide's preparation step while the
old version and its state still exist. Preserve the original patch, consumer
delta, pnpm settings, lockfile and compatibility records. Stop on a conflict;
deleting applied.json bypasses protection rather than migrating the patch.
Apply reviewed replacements only, then run typecheck/build and browser checks.
Distinguish local, committed, pushed, deployed and live-verified results.

The seven system docs declare their delivery status explicitly. Reference-only
React examples describe upstream design; do not install them into this app.
