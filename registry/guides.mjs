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
    dropdown:
      'Keep Dropdown.Model in the parent, map every Command and handle Selected OutMessages. Pass the same selection options to update and view. Items may supply static leading Html before the icon, or use the top-level renderLeading callback for parent Messages or Mounts; its scoped click/keyboard boundary preserves the leading control and keeps its clicks from selecting the row. Inline leading controls are siblings of the full-row native action, so arbitrary controls never nest inside a button. The parent owns their Messages. Items marked destructive color the label and primary icon; shortcut labels do not bind keys. Tree and ContextMenu inherit the shared item contract. Searchable uses a sticky search band and retains the last visible result height while empty; its scoped Mount samples layout before input dispatch and releases the retained space when rows return or the field unmounts. Dropdown.Panel composes native button/checkbox controls in an inline group, with parent-owned selection and the shared hover presentation.',
    'key-cap':
      'KeyCap.view renders one semantic kbd; KeyCap.keys renders a combo with one kbd per key. Both are stateless view helpers with native attributes and require no Model, Commands or subscriptions. Pass a string such as ⇧⌘O or Ctrl+K, or an array such as ["Page Up"] to keep a key name intact. splitKeys is exported. Use tone=inverted on a dark substrate. These are labels, not keyboard handlers: shortcut registration stays with the parent or its existing primitive. Hide decorative shortcut labels from assistive technology when the enclosing control already has a complete accessible name.',
    'message-scroller':
      'Keep MessageScroller.Model in the parent and map every Command. The parent owns messages and streaming state. Give view a bounded height and compose content/item helpers in the top-level renderContent slot when rows carry parent Messages. Mark arriving user turns with anchor and use stable keys; initial anchors are history. content renders a polite log; pass busy while streaming so completed replies are announced together. showButton includes the source return-to-latest control; alternatively compose the exported button with parent Messages and forward ScrollToEndRequested only when the parent accepts the action. atEnd is available in Model. autoScroll=false disables following growth but still opens at the end and glides on new anchor turns. Keep Unmounted lifecycle handling so stale observer and animation completions cannot affect a remounted instance. Scoped Mounts own native scroll geometry, resize/anchor observation and Motion cleanup. No subscriptions are required.',
    'context-menu':
      'Keep ContextMenu.Model in the parent and pass identical items, search and selection options to update/view. Forward every Command and handle every element of result.outMessages: Selected or Created identifies its trigger and targetValue, while OpenChanged reports opening/dismissal. Render native trigger elements with all supplied child attributes; give keyboard targets tabindex=0 or use native controls. Each trigger id must be unique. filter is a top-level view callback; native text fields always keep their browser menu. data-context-value identifies a clicked row for the parent without storing DOM nodes in Model. Root and trigger disabled states preserve the native menu. The shared Dropdown tree owns submenus, search, selection, portals, dismissal and keyboard behavior; ContextMenu owns only opening, its zero-size body anchor and conditional return focus. Shared items accept destructive for a destructive label and icon, shortcut for display-only key caps, and static leading markup. Use the top-level renderLeading callback for leading content carrying parent Messages or Mounts; do not put those functions inside items. Preserve unmount/lifetime handling and use the printed pnpm compatibility setup. No subscriptions are required.',
    'code-block':
      'Keep CodeBlock.Model, pass the exact same code string to update and view, and map every Command. Copied is emitted only after a successful clipboard write. Failed copies announce an error; feedback clears after two seconds. Use a unique id per instance and preserve Unmounted/Tooltip lifecycle Messages. The public view ships no syntax highlighter: children may contain plain markup, and the top-level renderContent slot supports content carrying parent Messages or Mounts. Code stays the untrimmed clipboard payload even when content is highlighted. Shared Button, Tooltip and ScrollArea provide primitive behavior and scrolling. No subscriptions are required.',
    confirmation:
      'Keep Confirmation.Model for its shared Banner lifecycle and forward every Command. The parent owns requested/approved/denied state and handles Approved or Denied OutMessages before passing its next state to view; clicking does not execute a tool or grant approval outside the application. The question is a labelled group, with an announced answer replacing the buttons at the same height. Banner dismissal passes through dismissible and dismissLabel; Dismissed and Hidden OutMessages report its lifecycle without approving or denying. Pass controlled: true to update when the parent must handle a dismiss request before changing visibility, and route Banner Showed/Hid Messages for explicit visibility changes. Banner and Button are included. Preserve the answer Mount cleanup and reduced-motion handling. No subscriptions are required.',
    breadcrumb:
      'Store Breadcrumb.Model in the parent, forward every Command and handle Selected OutMessages for menu destinations. Links remain native anchors. The current page is noninteractive and announced with aria-current. Pass a bounded width for overflow collapse. The scoped Mount measures visible steps and owns the shared hover and observer cleanup. Set reveal to expand for an in-place path, or use the hidden-step menu. Decoration bundles support custom native/framework links and menu triggers. Dropdown is included and requires the printed compatibility setup. No lifted subscriptions are required.',
    'chat-message':
      'ChatMessage is a stateless view helper; the parent owns messages, actions and visibility. Files may be native browser File objects or remote { url, mediaType, filename? } attachments (the AI SDK file-part shape). Remote images render from their URL and fall back to the document glyph on error; remote nonimages do not fetch bytes. FileThumbnail is included and owns ref-counted image object URLs and abortable PDF rendering. This browser-only example creates its sample files once outside view. It bundles the pinned pdfjs-dist worker with Vite and calls setPdfWorkerSrc before rendering; the default otherwise uses the matching CDN worker. Applications with restrictive CSP should host their worker and allow their chosen worker/image sources. Preserve Mount cleanup to release previews after the last user unmounts. No child Model or subscriptions are required.',
    'input-message':
      'The parent owns draft text, native File objects, queue, history and idle/submitted/streaming/ready/error status. Keep InputMessage.Model, map all Commands and handle every OutMessage; QueueChanged after submit must clear the draft and attachments. This example also includes the public QueuedStack helper, its Model, Commands and edit/remove/reorder OutMessages. Apply InputMessage.releaseOnStatusChange on every parent-owned status edge: submitted/streaming are busy, error parks the queue, and a return to idle/ready releases one item. Remove that item before sending it; preserve its queued id for any shared-layout presentation. Stop cancels the transport and returns to idle through the same transition. The example exposes response and error controls; real network sending and cancellation belong to the application. FileThumbnail and its pinned PDF package are included; bundle the matching worker or configure setPdfWorkerSrc before rendering (the default is the matching CDN worker). Scoped Mounts own native caret/history, file drops, resizing, hover, previews and cleanup. No lifted subscriptions are exported.',
    'ask-user-questions':
      'Store AskUserQuestions.Model and pass the same questions to update and view. update returns model and an array of outMessages, not the single outMessage convention: handle every Completed or Skipped event. The parent owns completion storage and replay. Single-select advances immediately; multi-select and free text submit explicitly, and email validation is configured per question. The scoped Mount owns keyboard navigation, focus, field sizing and transition geometry; preserve it through ordinary updates and release it on removal. No Commands or lifted subscriptions are exported.',

    sidebar:
      'Store Sidebar.Model in the parent and map all returned Commands. Build a Sidebar.Kit with the parent HtmlBuilder and wrapped Messages, then compose provider, sidebar and inset with header/content/group/menu/footer helpers. Parent Messages own route selection. The scoped Mounts own responsive detection, the bracket shortcut, rail resizing, group animation and mobile drawer focus/scroll cleanup. No lifted subscriptions are required. Sidebar.Blocks is included. The small class-name utility and its pinned clsx and tailwind-merge dependencies are shipped; Tailwind compiles the same utility classes used by the showcase.',
    'command-menu':
      'The inline component and dialog wrapper each retain their child Model. Pass identical items to update and view, map every Command, and handle Selected OutMessages in the parent. The public dialog helper is imported from command-menu/dialog and is explicitly included in this item. Register the parent shortcut subscription with the same id passed to CommandDialog.init; shortcut labels alone do not register actions. An open palette answers its combo first, otherwise the last mounted eligible peer answers. A data-keyboard-scope region keeps a palette outside it from claiming its keys; pass inScope for an explicit opening scope. Keep subscriptions stable across opening/closing: the nonportalled view anchor reports current open state, and scoped cleanup releases peer registration. Keep the dialog child Model through unmount lifecycle handling so it releases modal resources. Scoped Mounts own input/list navigation and highlighting. Item.destructive colors the row while its description remains muted; it does not change activation or confirmation policy.',
    'data-table':
      'Store DataTable.Model in the parent. Pass the same data, stable column definitions and row IDs to update and view. For derived accessor values, use the top-level getCellValue(row, columnId) callback and return the original value for unchanged data columns; functions nested inside columns cannot cross a Foldkit view-input boundary. Display-only and utility columns retain their behavior. Map every Command, handle CellEdited, RowAction, SelectionAction and RowsReordered OutMessages, and call Synced after replacing data to clamp paging. At natural height, actionable headers share a gliding fill and an open header menu retains its pressed fill; column drags suspend it. Filled tables keep sticky headers with their own fills. Pinned cells stay opaque; mirrored selection and the current hover fill paint above them outside the masked ScrollArea viewport. Scroll timelines keep the overlays with native scrolling, while fade compensation preserves selected and hovered row colors at frozen edges. Browsers without scroll timelines keep crisp edges. Header padding forwards to the native menu trigger. Leading selection boxes and row grips ride the shared hover fill as decorative slots. Native controls remain in their rows for input, checked or mixed state, visible focus, frozen columns and touch; sub-rows have no independent drag handle. Root rows and their expanded descendants form native sortable row groups, so drops and keyboard moves preserve the subtree. Alt with Up or Down moves the selected roots together, or the focused root when none are selected. The native table is the active SDK drop container, exposing only row-group or data-column sortable markers for the current drag. Insertion boundaries include the final position; no-op drops produce no reorder. Inert 2px accent lines project the active SDK insertion target: rows span the visible table width and columns span the visible column height. Row lines disappear when the carried roots would keep the same order; column lines follow the source header reference and stay within the viewport edges. The lines never choose a target and disappear with the copy on cancel or unmount. Hidden column slots and the frozen-column count survive reordering. A carried column copies its rendered header, including its icon and sort arrow, at 80% opacity while the original header and cells dim to 40%. The copy keeps its vertical position and stops at the visible table edges, with frozen positioning and the old edge hairline removed. Both row and column copies are inert, preserve source theme tokens and disappear on cancellation or unmount. Native pointercancel on a row or column handle forwards the public SDK CancelledDrag message for that table lifetime. Pending and active gestures clear their copy, line and grabbing cursor without reordering or changing selection; stale cancellation from a retired lifetime is ignored. This Foldkit adaptation cancels interrupted column gestures rather than committing them as a release. Tree rows share a 24px chevron slot at every depth, with continuous guide rules and count tooltips. Expansion slides rows, selection fills and frozen mirrors together over 120ms. New cells are uncovered as rows move; closing cells remain briefly as an inert copy with no duplicate IDs. Reduced motion applies layout immediately, and reversing or unmounting cancels the projection. From a focused row, Right opens it or enters its first child; Left closes it or returns to its parent. Child inputs and buttons retain their own keys. Keep nested data edits in the parent and preserve row IDs through collapse and reopen. Key the surrounding DOM when switching between independent table models so each native Mount retains the correct Message route. Selection fills follow the displayed page order, merge adjacent selected rows, and leave the stationary table while those rows travel in a drag copy. The inert copy preserves rendered cells, check states, typography, column widths and frozen positions at 80% opacity; original carried rows dim to 40%. Adjacent rows share a lifted block and separated rows keep their gaps. A selection spanning more than 60% of the window stacks the grabbed row first, clips the copy and reports the carried root count. The SDK supplies pointer state, collision, cancellation and the grabbing cursor; the visual copy adds no pointer listener or interaction machine. Row and selection actions accept a static icon, shortcut label, destructive tone and disabled state; their OutMessages leave business actions in the parent. Keep values and row history in the parent; History provides bounded undo and redo. renderCell is a top-level view input; nested render callbacks are not valid Foldkit view inputs. Lift DataTable.subscriptions into the application to run the official DragAndDrop pointer and keyboard behavior. Dropdown, Select, DatePicker, Checkbox and Combobox own their existing Foldkit UI behavior. Portalled Combobox and Select cell editors use viewport collision handling and can extend beyond the table scroll area. A custom scroll-area collision boundary requires support from the Foldkit UI anchor API. Preserve Mount cleanup and install the compatibility patch printed above.',
    table:
      'Table is a set of semantic native table view helpers. The parent owns rows, sorting, selection, empty state and visibility. Supply selectedIndices for merged adjacent selection fills; these refer to each body row index. Change snapKey in the same render that opens or closes rows so fills jump to the new layout before paint, then resume their springs. Pass size and radius explicitly from app preferences. RowProps.keepRule preserves a header divider when the first body row is selected. Give actionable heads a hoverIndex to join the separate horizontal fill; heldHeadIndex retains a pressed fill for an open popup, and hideHeadHighlight suspends it during a drag. These are visual inputs; parent controls and Foldkit UI keep their existing interactions. selectionMirrors lists mirror-host IDs in the same containing root, replacing upstream DOM refs so native nodes stay out of Model. Each host needs a positioned coordinate space aligned with the table when used as an overlay; Table owns only its mirrored fills and preserves host content. hoverMarkers supplies indexed decorative Html slots in place of upstream hoverMarker(index). The active slot travels with the animated fill and keeps its original view ownership through updates; interactive controls remain in the real row. onHighlightFrame receives the current animated table-space y, height and opacity, plus its native surface as the second argument so effects can stay scoped without global DOM lookups; use it to write to the DOM, not to update Model per frame. It is a current view input, so a render can replace or remove the listener. Native visible focus claims the row highlight until the pointer moves; scrolling under a stationary pointer follows the row beneath it. After an owner moves a row while its control keeps focus, dispatch a bubbling TABLE_HIGHLIGHT_EVENT from that row to reclaim its visual. Table observes repeated arrow keys to snap its fill and never handles navigation itself. Supply scope and aria-sort on headers and real buttons for interactive sorting. Use stable row keys and sequential row indices for the scoped visual projection. Table.empty requires the actual column count and stays centered within the visible scroll box. No child Model, Commands or subscriptions are required; preserve the visual Mount cleanup.',

    calendar:
      'Keep Calendar.Model and the controlled Calendar.Selection in the parent. Pass the same Options to update and view, map every returned Command and handle Selected OutMessages. The example uses a fixed November 2026 range with a two-night minimum and one disabled date for deterministic behavior; applications supply their own today, month and restrictions. Labels and formatter callbacks must use top-level factories in viewInputs. The scoped Mount owns geometry, keyboard focus and retained month transitions; no lifted subscriptions are exported.',
    'color-picker':
      'This example includes the inline panel and exported Popover namespace. Keep each child Model and controlled color value in the parent, forward every Command and handle ValueChanged and Removed OutMessages. Lift ColorPicker.subscriptions for both panels with distinct prefixes; the Popover panel is read from model.popover.picker while open. Register the aggregate in the runtime entry below. The explicit pnpm patch is required by the shared Dropdown format menu. The optional EyeDropper depends on browser support and a secure user gesture; this example hides it. Scoped Mounts own square dragging, tooltips, menu focus and popup cleanup. Labelled swatches and non-HEX channel fields each share a separate tooltip group. The channel group survives RGB/HSL/OKLCH changes and resets when switching to HEX; no extra parent routing beyond ColorPicker.update is needed.',
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
      'Store Tooltip.Model, wrap Messages and map all returned Commands, including delayed show and retained exit. Supply renderTrigger as a top-level viewInputs callback and retain its complete trigger attribute bundle for focus and accessible description linkage. shortcut accepts a combo or explicit key names and keeps the plain bubble height. For a fluid group, keep Tooltip.Group.Model, map Group.update Commands, wrap the triggers with Group.view and render every member through Group.tip using the same Model and parent Message mapper. The first hover waits delayDuration (200ms by default); neighbors skip that delay while warm and for skipDelayDuration (300ms) after closing. Each official Tooltip retains its trigger, keyboard, description and anchor ownership. A closing bubble holds150ms for a same-side handoff; side flips fade independently, and scroll/resize clears the inherited preference. Scope cleanup and lifetime guards prevent old observers, exit completions and cooldowns from changing a remounted group. The panel is portalled and inherits root theme tokens. Use unique ids and slotIds. No additional lifted subscriptions are exported.',

    card: 'Card is a controlled view helper: the parent owns selection, dismissal and visibility. Use stable keys and accessible labels for action overlays. Card.group owns scoped hover geometry; preserve its Mount cleanup. Consumer images or logos are supplied by the application, not fetched by the registry. No child Model, Commands or subscriptions are required.',
    banner:
      'Store Banner.Model in the parent, wrap its Messages and map all returned Commands. Dismissed announces the request; Hidden is emitted after the retained exit completes. Keep rendering the child during exits. The scoped Mount settles the animation and moves focus out of dismissing content. This example uses the default uncontrolled Banner.update behavior; controlled applications must own visibility and issue Showed/Hid themselves. No additional lifted subscriptions are exported.',
    'carousel-dots':
      'The parent owns the numeric slide index and handles onValueChange for manual and autoplay sources. Keep the index in range for count. Autoplay is a scoped Mount clock: duration is milliseconds, paused preserves its progress, and unmount releases its frames, observer and hover engine. An explicit progress value overrides the internal clock. Reduced-motion disables automatic advancement. No child Model, Commands or lifted subscriptions are required.',
    'thinking-indicator':
      'This view helper exposes one accessible Thinking status. The decorative glyph and cycling words are aria-hidden. Preserve its scoped Mount, which owns the interval, morph animations and media-query listener, releases them on removal and respects reduced motion. The parent can show or hide it without child state, Commands or subscriptions.',
    'thinking-steps':
      'The parent owns the reader choice and progressive step status. Leave open undefined to follow running (then defaultOpen, true by default). Store onOpenChange in a nullable parent choice and pass it as open to retain the reader override through later status changes. Keep a unique disclosure id. Header and step meta accept durations or counts. Pending steps do not render; upcoming steps remain visible and muted, and error steps use destructive text/icons. Only http(s) and single-slash site paths become href links, which open in a new tab. The compound step, details and source helpers accept consumer content and assets. Scoped Mounts own collapse geometry, entrance animation and trigger highlighting; preserve cleanup. No child Model, Command mapping or lifted subscriptions are required.',

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
                'Run both commands. The second applies the shipped render-slot patch to @foldkit/ui 0.171.0 through pnpm 10’s patch and patch-commit commands. It preserves existing pnpm configuration and compatible consumer patches. Keep the generated patch, pnpm settings, lockfile and src/fluid/compat/applied.json with your application. Re-running setup checks the recorded package state and makes no changes when it is already applied. Conflicting patches require review; this setup does not silently replace them.',
              ),
              paragraph(
                'For a custom lockfile-dir, use pnpm’s manual workflow instead: run pnpm patch @foldkit/ui@0.171.0 --edit-dir .fluid-ui-edit, apply src/fluid/compat/ui.patch inside that edit directory (for example git apply --no-index ../src/fluid/compat/ui.patch), then run pnpm patch-commit .fluid-ui-edit --patches-dir with a directory relative to your custom lockfile location. Review and preserve existing custom patches. The automatic helper supports the default pnpm lockfile location.',
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
        ...(stateful && composition[component.name]
          ? [paragraph(composition[component.name])]
          : []),
        ...(stateful
          ? [
              paragraph(
                'The primitive backdrop blocks background hover, suppresses the browser context menu and forwards wheel scrolling to an underlying panel that can move; at its boundary, normal document scrolling remains available. Editable Combobox and DatePicker fields stay live through an anchor cutout. Preserve the scoped Mount cleanup. Foldkit continues to own portals, outside dismissal and backdrop exit retention.',
              ),
            ]
          : []),
        ...(component.name === 'combobox'
          ? [
              paragraph(
                'Multi selection may include values whose items have not loaded. Their chips show the raw value until its label arrives, preserve selection order as other rows are picked, and submit the complete controlled values. Handle Changed using the complete array, not a list filtered to the loaded dataset. The parent owns loading and creation: Created requests a label; append the new item and its value when creation completes. Explicit chip removal or Clear can remove unknown values too. This example delays remote labels while the list is open and lets the parent finish creation separately.',
              ),
            ]
          : []),
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
        link(
          `${component.title} interactive examples and API`,
          component.docsPath ?? `/docs/${component.name}`,
        ),
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
