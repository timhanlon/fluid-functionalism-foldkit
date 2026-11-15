# Reading and auditing a Foldkit application

Use scripts/stack.mjs for fresh facts. Inspect the returned files and the app's
own instructions. A missing optional font, skill, or component is not by itself
a product defect. Do not infer that a Vite app is React, or demand components.json.

Check that the installed foldkit, @foldkit/ui, Effect and browser platform match
their package peer ranges and the chosen guide. Look for one theme import in the
entry, child Command mapping, controlled OutMessage handling and subscriptions
in Runtime.makeApplication. Preserve consumer-owned routing and network work.
Verify pnpm patch state before touching a patched version; a successful fresh
install says nothing about migrating an earlier patch.

Select the routes people actually use. Read the component craft and implementation,
then measure any claimed defect. scripts/audit.mjs moves a real pointer and
reports geometry, weight shifts and durations. Its flags are measurements, not
instructions to change every deviation. Confirm focus, Escape/return, scrolling,
portals, reduced motion and removal/remount cleanup in the real browser.

For each proposed improvement record: current visible behavior, affected surface,
measurement or file:line, desired behavior and one concrete correction. Delete
claims contradicted by the implementation or browser. Respect existing product
decisions. Ask before introducing a signature motion the application never had.
Do not inflate a small UI correction into an infrastructure migration.

Default audit output is the conversation. Save decisions or reports only where
the user requests them. Do not cache stack facts as durable project decisions.
