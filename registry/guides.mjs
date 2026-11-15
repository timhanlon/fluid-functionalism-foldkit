import { readFileSync, existsSync } from 'node:fs';
import { additionalDocs } from './system-docs.mjs';
import { craft } from './craft.mjs';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const paragraph = (text) => ({ kind: 'paragraph', text });
const heading = (text, id) => ({ kind: 'heading', text, id });
const code = (text, language = 'sh') => ({ kind: 'code', text, language });
const link = (text, href) => ({ kind: 'link', text, href });

/** Shared content for the website and its Markdown twins. Program examples are
 * also consumed by the independent installation verifier. */
export function registryGuides() {
  const catalog = JSON.parse(read('registry/catalog.json'));
  const manifest = JSON.parse(read('package.json'));
  const api = JSON.parse(read('src/content/component-api.json'));
  const command = (name) =>
    `pnpm dlx shadcn@4.23.0 add ${catalog.origin}/r/${name}.json --yes` +
    (catalog.components.find((item) => item.name === name)?.compatibility === 'pnpm'
      ? '\nnode src/fluid/compat/setup.mjs'
      : '');
  const patchedComponents = catalog.components
    .filter((item) => item.compatibility === 'pnpm')
    .map((item) => item.title)
    .join(', ');
  const compatibility = [
    heading('Compatibility', 'compatibility'),
    paragraph(
      `Use Node.js 22.22.2 or newer and pnpm 10.33.0. These components target Foldkit and @foldkit/ui ${manifest.dependencies.foldkit}, Effect ${manifest.dependencies.effect} and Motion ${manifest.dependencies.motion}. The installer adds the packages each component needs. Review version changes before installing into an existing app. Tailwind CSS v4 is required. React and components.json are not required.`,
    ),
    paragraph(
      `Source files install under src/fluid/ with their relative imports, CSS and attribution intact. This destination is fixed for now. ${catalog.components
        .filter((item) => !item.compatibility)
        .map((item) => item.title)
        .join(
          ', ',
        )} use unpatched published packages. ${patchedComponents} require the explicit compatibility setup printed with their install commands. Components outside the installable list remain available in the showcase as reference work.`,
    ),
    heading('Theme and fonts', 'theme'),
    paragraph(
      'Import ./fluid/tailwind.css once from src/entry.ts. Component CSS is imported by its TypeScript module. The default theme follows the operating system. Set class="light" or class="dark" on <html> to override it. Root-level tokens reach portalled popups. When migrating an older registry install, remove the old fluid/theme.css import and file, and remove components/sidebar/portable.css and its import if present; preserve any local customizations before updating. Override CSS variables after the theme import; --fluid-accent controls the focus accent. Inter is optional and consumer-supplied; otherwise the system font is used. No captured website stylesheet or font URL is needed.',
    ),
    heading('Updating your copies', 'updates'),
    link('Port changelog and compatibility version migration', '/changelog.md'),
    paragraph(
      'Before changing a patched UI version, prepare the upgrade while the previous UI and its compatibility state are still installed. Follow the linked procedure; it saves the old patch and consumer delta and retires the old pnpm registration. Keep the backup and stop on conflicts. Do not delete applied.json to force setup.',
    ),
    paragraph(
      'The installed source belongs to your application. Commit or otherwise preserve your edits before updating. Run the same add command with --dry-run to inspect an update, then run it normally and review its diff. Avoid --overwrite until you have reviewed local customizations. Shared files can affect several components. Keep compatible Foldkit, @foldkit/ui and Effect versions together, and rerun your app’s behavior and browser checks after updating.',
    ),
    paragraph(
      'Retain src/fluid/LICENSE.original and the icon notices installed with components that need icons. Behavior tests do not establish complete upstream visual parity or cross-browser and physical-touch support.',
    ),
  ];
  const controlledText =
    'The parent owns value and handles onInput by returning its next Model. These controls need no child Model, Command mapping or lifted subscriptions. Use a distinct id for every instance.';
  const controlledToggle =
    'The parent owns checked and handles onToggle by returning its next Model. This controlled view helper does not need a child Model, Command mapping or lifted subscriptions. Use a distinct id for every instance.';
  const composition = {
    breadcrumb:
      'Store Breadcrumb.Model in the parent, forward every Command and handle Selected OutMessages for menu destinations. Links remain native anchors. The current page is noninteractive and announced with aria-current. Pass a bounded width for overflow collapse. The scoped Mount measures visible steps and owns the shared hover and observer cleanup. Set reveal to expand for an in-place path, or use the hidden-step menu. Decoration bundles support custom native/framework links and menu triggers. Dropdown is included and requires the printed compatibility setup. No lifted subscriptions are required.',
    'chat-message':
      'ChatMessage is a stateless view helper; the parent owns messages, actions and visibility. Files are native browser File objects. FileThumbnail is included and owns ref-counted image object URLs and abortable PDF rendering. This browser-only example creates its sample files once outside view. It bundles the pinned pdfjs-dist worker with Vite and calls setPdfWorkerSrc before rendering; the default otherwise uses the matching CDN worker. Applications with restrictive CSP should host their worker and allow their chosen worker/image sources. Preserve Mount cleanup to release previews after the last user unmounts. No child Model or subscriptions are required.',
    'input-message':
      'The parent owns draft text, native File objects, queue, history and idle/streaming status. Keep InputMessage.Model, map all Commands and handle every OutMessage; QueueChanged after submit must clear the draft and attachments. This example also includes the public QueuedStack helper, its Model, Commands and edit/remove/reorder OutMessages. InputMessage.release is called on the simulated response-completion edge to dispatch the next queued item; real network sending and cancellation belong to the application. FileThumbnail and its pinned PDF package are included; bundle the matching worker or configure setPdfWorkerSrc before rendering (the default is the matching CDN worker). Scoped Mounts own native caret/history, file drops, resizing, hover, previews and cleanup. No lifted subscriptions are exported.',
    'ask-user-questions':
      'Store AskUserQuestions.Model and pass the same questions to update and view. update returns model and an array of outMessages, not the single outMessage convention: handle every Completed or Skipped event. The parent owns completion storage and replay. Single-select advances immediately; multi-select and free text submit explicitly, and email validation is configured per question. The scoped Mount owns keyboard navigation, focus, field sizing and transition geometry; preserve it through ordinary updates and release it on removal. No Commands or lifted subscriptions are exported.',

    sidebar:
      'Store Sidebar.Model in the parent and map all returned Commands. Build a Sidebar.Kit with the parent HtmlBuilder and wrapped Messages, then compose provider, sidebar and inset with header/content/group/menu/footer helpers. Parent Messages own route selection. The scoped Mounts own responsive detection, the bracket shortcut, rail resizing, group animation and mobile drawer focus/scroll cleanup. No lifted subscriptions are required. Sidebar.Blocks is included. The small class-name utility and its pinned clsx and tailwind-merge dependencies are shipped; Tailwind compiles the same utility classes used by the showcase.',
    'command-menu':
      'The inline component and dialog wrapper each retain their child Model. Pass identical items to update and view, map every Command, and handle Selected OutMessages in the parent. The public dialog helper is imported from command-menu/dialog and is explicitly included in this item. Register the parent shortcut subscription and runtime subscriptions shown below; shortcut labels alone do not register actions. Keep the dialog child Model through unmount lifecycle handling so it releases modal resources. Scoped Mounts own input/list navigation and highlighting.',
    table:
      'Table is a set of semantic native table view helpers. The parent owns rows, sorting, empty state and visibility. Supply scope and aria-sort on headers and real buttons for interactive sorting. Use stable row keys and sequential row indices for the scoped hover projection. Table.empty requires the actual column count. No child Model, Commands or subscriptions are required; preserve the hover Mount cleanup.',

    calendar:
      'Keep Calendar.Model and the controlled Calendar.Selection in the parent. Pass the same Options to update and view, map every returned Command and handle Selected OutMessages. The example uses a fixed November 2026 range with a two-night minimum and one disabled date for deterministic behavior; applications supply their own today, month and restrictions. Labels and formatter callbacks must use top-level factories in viewInputs. The scoped Mount owns geometry, keyboard focus and retained month transitions; no lifted subscriptions are exported.',
    'color-picker':
      'This example includes the inline panel and exported Popover namespace. Keep each child Model and controlled color value in the parent, forward every Command and handle ValueChanged and Removed OutMessages. Lift ColorPicker.subscriptions for both panels with distinct prefixes; the Popover panel is read from model.popover.picker while open. Register the aggregate in the runtime entry below. The explicit pnpm patch is required by the shared Dropdown format menu. The optional EyeDropper depends on browser support and a secure user gesture; this example hides it. Scoped Mounts own square dragging, tooltips, menu focus and popup cleanup.',
    dialog:
      'Store Dialog.Model in the parent, wrap Messages and map all returned Commands. The native modal owns isolation, initial focus, focus trapping and return, dismissal, scroll locking and retained exits. renderContent and renderFooter are top-level callbacks; preserve the complete initialFocus and closeButton attribute bundles supplied through their Slots. Parent Messages can update content directly through those callbacks. The example can unmount the whole modal from inside to demonstrate cleanup. Retain its child Model and forward the Unmounted lifecycle Message so it can release resources and reset itself before reuse; do not reset or drop that state before lifecycle handling. No additional lifted subscriptions are exported.',

    accordion:
      'Store Accordion.Model in the parent and wrap its Messages. Accordion.update returns the next Model directly, rather than an Update result; pass the same options to init, update and view. The multiple example keeps expansion in that child Model. The scoped Mount owns keyboard focus, hover geometry and retained collapse animation; preserve cleanup. No Commands, OutMessages or subscriptions are exported.',
    'checkbox-group':
      'The parent owns selected values and renders Checkbox children. This item includes Checkbox for the complete composition. Keep unique child ids, names and values for native forms. CheckboxGroup owns scoped roving focus, arrow/Home/End navigation, hover and selection backgrounds; preserve cleanup when removed. No child Model or lifted subscriptions are required.',
    'radio-group':
      'Store RadioGroup.Model in the parent, map every returned Command and update the parent controlled value from Selected OutMessages. Render through a stable slotId, use a unique init id and forward the same controlled value to view. The optional name supplies a native form input. Disabled options are excluded from navigation. No additional lifted subscriptions are exported.',
    tabs: 'Store Tabs.Model separately from the parent selected value. Forward every returned Command and handle Selected OutMessages. Keyboard navigation is manual: moving focus does not activate a tab until Enter or Space. Keep panel callbacks at the top level of viewInputs when they carry parent Messages or Mounts, as in the counter example. Preserve the scoped hover Mount; no lifted subscriptions are exported.',
    slider:
      'This program includes both Slider and its exported Range namespace. Keep their child Models and controlled values separate, wrap each child Message, forward all Commands and handle ChangedValue OutMessages. Range.update also receives the current pair. Lift and aggregate both exported subscription sets into the parent, and pass subscriptions to Runtime.makeApplication in the entry below; otherwise document-level pointer dragging and Escape cancellation do not work. The example stops subscriptions and resets child drag state when the controls are hidden. Native focus, geometry and value edits remain browser behavior.',
    tooltip:
      'Store Tooltip.Model, wrap Messages and map all returned Commands, including delayed show and retained exit. Supply renderTrigger as a top-level viewInputs callback and retain its complete trigger attribute bundle for focus and accessible description linkage. The panel is portalled and inherits root theme tokens; preserve scoped cleanup. Use unique ids and slotIds. No additional lifted subscriptions are exported.',

    card: 'Card is a controlled view helper: the parent owns selection, dismissal and visibility. Use stable keys and accessible labels for action overlays. Card.group owns scoped hover geometry; preserve its Mount cleanup. Consumer images or logos are supplied by the application, not fetched by the registry. No child Model, Commands or subscriptions are required.',
    banner:
      'Store Banner.Model in the parent, wrap its Messages and map all returned Commands. Dismissed announces the request; Hidden is emitted after the retained exit completes. Keep rendering the child during exits. The scoped Mount settles the animation and moves focus out of dismissing content. This example uses the default uncontrolled Banner.update behavior; controlled applications must own visibility and issue Showed/Hid themselves. No additional lifted subscriptions are exported.',
    'carousel-dots':
      'The parent owns the numeric slide index and handles onValueChange for manual and autoplay sources. Keep the index in range for count. Autoplay is a scoped Mount clock: duration is milliseconds, paused preserves its progress, and unmount releases its frames, observer and hover engine. An explicit progress value overrides the internal clock. Reduced-motion disables automatic advancement. No child Model, Commands or lifted subscriptions are required.',
    'thinking-indicator':
      'This view helper exposes one accessible Thinking status. The decorative glyph and cycling words are aria-hidden. Preserve its scoped Mount, which owns the interval, morph animations and media-query listener, releases them on removal and respects reduced motion. The parent can show or hide it without child state, Commands or subscriptions.',
    'thinking-steps':
      'The parent owns open and progressive step status. Pass onOpenChange back into that Model and keep a unique disclosure id. Pending steps do not render. The compound step, details and source helpers accept consumer content and assets. Scoped Mounts own collapse geometry, entrance animation and trigger highlighting; preserve cleanup. No child Model, Command mapping or lifted subscriptions are required.',

    button:
      'Button is stateless: pass a parent Message to onClick and render with the parent HtmlBuilder. It does not need a child Model, Command mapping or lifted subscriptions.',
    checkbox: controlledToggle,
    switch: controlledToggle,
    input: controlledText,
    textarea: controlledText,
    badge:
      'Badge is a presentation helper: render it with the parent HtmlBuilder and derive its props from parent state. The native button in this example updates parent state to demonstrate changing badge content, color and variant. Badge needs no child Model, Command mapping or lifted subscriptions.',
    field:
      'Field composes labels, descriptions and errors around a control; the parent owns its value and validation. The Input used here is included by this registry item. No child Model, Command mapping or lifted subscriptions are needed. Use unique control, description and error ids. The scoped Field Mount links its own description/error ids while preserving caller-provided aria-describedby ids, and removes its links when unmounted. Retain this cleanup. Field.set and Field.legend provide native fieldset semantics.',
    'input-copy':
      'Store InputCopy.Model in the parent, wrap InputCopy.Message and map every returned Command. Pass the same value and disabled flag to update and view. Count successful copies from OutMessage.Copied; failures do not emit it. Use a unique init id and stable slotId for each instance. The icon variant owns a portalled Tooltip child, delayed feedback and scoped browser cleanup. No additional lifted subscriptions are exported. Clipboard access requires a secure context (HTTPS or localhost) and browser permission; the component attempts a native fallback and reports failure when copying is unavailable.',
    'input-group':
      'InputGroup accepts child HTML; it does not own field values or a child Model. This item includes the InputField helper used in the example, its CSS, icons and hover engine. The parent handles each onInput and provides unique control ids. Group size and corners are inherited by fields unless a field overrides them. Preserve the scoped Mount: it tracks pointer/focus geometry and releases listeners, observers and animation frames when the group is removed. No Command mapping or lifted subscriptions are needed.',
  };
  const guides = {};
  for (const component of catalog.components) {
    const entryPath = `registry/examples/${component.name}.entry.ts`;
    const entry = existsSync(new URL(`../${entryPath}`, import.meta.url))
      ? read(entryPath)
      : read('registry/starter/src/entry.ts').replace("import './app.css';\n", '');
    const stateful = ['select', 'date-picker', 'combobox', 'dropdown'].includes(component.name);
    guides[component.name] = {
      title: component.title,
      summary: component.description,
      blocks: [
        paragraph(component.description),
        heading('Install', 'install'),
        code(command(component.name)),
        ...(component.compatibility === 'pnpm'
          ? [
              paragraph(
                'Run both commands. The second applies the shipped render-slot patch to @foldkit/ui 0.170.0 through pnpm 10’s patch and patch-commit commands. It preserves existing pnpm configuration and compatible consumer patches. Keep the generated patch, pnpm settings, lockfile and src/fluid/compat/applied.json with your application. Re-running setup checks the recorded package state and makes no changes when it is already applied. Conflicting patches require review; this setup does not silently replace them.',
              ),
              paragraph(
                'For a custom lockfile-dir, use pnpm’s manual workflow instead: run pnpm patch @foldkit/ui@0.170.0 --edit-dir .fluid-ui-edit, apply src/fluid/compat/ui.patch inside that edit directory (for example git apply --no-index ../src/fluid/compat/ui.patch), then run pnpm patch-commit .fluid-ui-edit --patches-dir with a directory relative to your custom lockfile location. Review and preserve existing custom patches. The automatic helper supports the default pnpm lockfile location.',
              ),
              link('Official pnpm 10 patch workflow', 'https://pnpm.io/10.x/cli/patch'),
            ]
          : []),
        paragraph(
          'Run this in an existing Foldkit application. Shared source, component CSS, theme tokens, pinned dependencies and attribution install automatically. Import ./fluid/tailwind.css once from your application entry.',
        ),
        heading('Tailwind setup', 'tailwind'),
        paragraph(
          'Enable @tailwindcss/vite in your existing Vite configuration as shown below. The base item installs Tailwind v4 and its Vite plugin. The stylesheet scans src/ and index.html, including the installed components. Preserve the theme, base, components, utilities layer order before component CSS loads. The starter already configures this.',
        ),
        code(read('registry/starter/vite.config.ts'), 'ts'),
        heading('New project', 'new-project'),
        paragraph(
          'For an empty project, initialize a module package and install the starter to get the TypeScript, Vite and host files. Then run this component’s install command above and replace src/main.ts and src/entry.ts with the program and entry below. Start it with pnpm exec vite --host 127.0.0.1.',
        ),
        code(
          `mkdir fluid-example\ncd fluid-example\npnpm init\nnpm pkg set type=module\n${command('starter')}`,
        ),
        heading('Complete application example', `${component.name}-example`),
        paragraph(
          'Save this program as src/main.ts. The imports match the installed src/fluid/ layout. It works with the entry shown immediately below; use these same pieces when integrating into a larger parent application.',
        ),
        code(read(`registry/examples/${component.name}.ts`), 'ts'),
        heading('Application entry', 'entry'),
        paragraph(
          'Save this as src/entry.ts and mount it from <script type="module" src="/src/entry.ts"></script> in index.html, with a <div id="app"></div> host. For a new project, the starter already supplies these files and Vite/TypeScript configuration.',
        ),
        code(entry, 'ts'),
        paragraph(
          stateful
            ? 'The parent stores the child Model and controlled value separately. Pass the same controlled configuration to update and view. Forward every returned Command with Command.mapMessage; otherwise popup focus, acknowledgement and dismissal can stop working. Handle OutMessages to update the parent’s controlled value. These examples require no additional lifted subscriptions. Use a distinct component id and slotId for each instance, and preserve the installed scoped Mount cleanup.'
            : composition[component.name],
        ),
        ...(component.name === 'input'
          ? [
              paragraph(
                'Input owns the scoped Mount for native number stepping and file styling; retain its cleanup. File inputs are uncontrolled: handle onFiles and project file metadata into Messages rather than storing browser File objects in the Schema Model. Foldkit clears the native file selection after onFiles; the example displays the metadata from that callback, and choosing the same file again remains possible. Process the supplied File objects through your application’s upload workflow rather than expecting a later native form submission to retain them. The number input keeps a string value so an empty edit can be represented; parse and validate it when submitting.',
              ),
            ]
          : []),
        heading('Public API', 'api'),
        ...(api[component.name] ?? []).map((block) => ({ kind: 'api', ...block })),
        paragraph(
          'The installed index.ts exports the public component API. The interactive component page contains generated prop tables and additional examples.',
        ),
        link(`${component.title} interactive examples and API`, `/docs/${component.name}`),
        heading('Design details', 'craft'),
        paragraph(craft[component.name]),
        link('Foldkit skill and craft references', '/docs/skill.md'),
        ...compatibility,
      ],
    };
  }
  return { catalog, guides, documents: additionalDocs(catalog, manifest) };
}

export function guideMarkdown(guide) {
  return (
    `# ${guide.title}\n\n${guide.summary}\n\n` +
    guide.blocks
      .map((block) => {
        if (block.kind === 'api') {
          const escape = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
          return (
            `### ${block.name}\n\n| Prop | Type | Description |\n| --- | --- | --- |\n` +
            block.fields
              .map(
                (field) =>
                  `| ${field.name}${field.optional ? '?' : ''} | \`${escape(field.type)}\` | ${escape(field.description)} |`,
              )
              .join('\n')
          );
        }
        if (block.kind === 'heading') return `## ${block.text}`;
        if (block.kind === 'code')
          return `\`\`\`${block.language}\n${block.text.trimEnd()}\n\`\`\``;
        if (block.kind === 'link') return `[${block.text}](${block.href})`;
        return block.text;
      })
      .join('\n\n') +
    '\n'
  );
}
