# Component craft

Read the installed implementation for exact current props, durations and cleanup. The following constraints explain how to compose with each control; the corresponding public guide provides its runtime wiring.

## breadcrumb

Keep destinations as native links and the current step noninteractive. Collapse is measured against available width; hiding arbitrary steps without that measurement loses the overflow contract.

[Complete Breadcrumb guide](https://fff.timhanlon.com/docs/breadcrumb.md)

## button

The button owns press geometry and loading feedback. Preserve its complete event/disabled contract and a stable label/icon slot; another scale animation on a wrapper competes with the press.

[Complete Button guide](https://fff.timhanlon.com/docs/button.md)

## select

The child owns popup navigation and acknowledgement; the parent owns the selected value. Forward focus/dismissal Commands and avoid a second Value attribute on the native field.

[Complete Select guide](https://fff.timhanlon.com/docs/select.md)

## date-picker

A draft edit differs from a committed selected date. Keep controlled options identical in update and view, retain popup/focus Commands, and preserve the calendar rules rather than rebuilding them in a wrapper.

[Complete DatePicker guide](https://fff.timhanlon.com/docs/date-picker.md)

## checkbox

Use a stable native form identity and an accessible label. The controlled value belongs to the parent; visual check feedback must agree with native checked/disabled state.

[Complete Checkbox guide](https://fff.timhanlon.com/docs/checkbox.md)

## switch

The parent owns checked state. Preserve the native control and accessible label; the moving thumb is feedback rather than a second state source.

[Complete Switch guide](https://fff.timhanlon.com/docs/switch.md)

## combobox

Input text, selected values, created choices and popup focus have separate roles. Map Commands and controlled acknowledgements; keep one owner for the input value to preserve native selection and caret behavior.

[Complete Combobox guide](https://fff.timhanlon.com/docs/combobox.md)

## dropdown

Selection acknowledgement, dismissal and native focus return are distinct edges. Preserve Commands and the primitive attribute bundles. Nested menus and filtering must not add a competing focus owner.

[Complete Dropdown guide](https://fff.timhanlon.com/docs/dropdown.md)

## input

The parent owns text; an empty numeric edit is still a string. Native file selection is uncontrolled and files are delivered by the callback. Preserve Mount cleanup for number stepping and file presentation.

[Complete Input guide](https://fff.timhanlon.com/docs/input.md)

## textarea

The parent owns text. Keep its accessible label and disabled/read-only distinction; retain the field geometry and focus behavior instead of replacing it with a styled generic element.

[Complete Textarea guide](https://fff.timhanlon.com/docs/textarea.md)

## badge

A badge labels status rather than acting as a button. Keep solid/dot intent and contrast; do not communicate status through color alone.

[Complete Badge guide](https://fff.timhanlon.com/docs/badge.md)

## field

Keep label/control/help/error linkage semantic. Group and legend are native form structure; a decorative label must not replace the accessible name or hide an error from assistive technology.

[Complete Field guide](https://fff.timhanlon.com/docs/field.md)

## input-copy

Feedback follows successful clipboard completion, with a failure path and a secure-context requirement. Keep the value stable and preserve the icon variant tooltip/focus cleanup.

[Complete InputCopy guide](https://fff.timhanlon.com/docs/input-copy.md)

## input-group

The group shares pointer/focus geometry while the parent owns field values. Avoid an independent hover on every child. Preserve observers/listeners when adding or removing fields.

[Complete InputGroup guide](https://fff.timhanlon.com/docs/input-group.md)

## card

Compose layout and selection in the parent. One group owns the hover geometry; avoid a background per item that fights the group highlight. Keep overlay actions independently accessible.

[Complete Card guide](https://fff.timhanlon.com/docs/card.md)

## banner

Dismissal requests and the completed retained exit are separate events. Keep the component mounted during its exit and handle focus before removing the last visible action.

[Complete Banner guide](https://fff.timhanlon.com/docs/banner.md)

## carousel-dots

The parent owns the slide value. Autoplay progress is feedback for that value; removing/reordering slides must not leave the selection outside the available range. Keep pause and reduced-motion behavior explicit.

[Complete CarouselDots guide](https://fff.timhanlon.com/docs/carousel-dots.md)

## thinking-indicator

Status text and the glyph cycle form one status presentation. Reduced motion needs a meaningful stable state; do not add a second timer or animate the same glyph through another owner.

[Complete ThinkingIndicator guide](https://fff.timhanlon.com/docs/thinking-indicator.md)

## thinking-steps

Completion and expanded details are distinct states. Retain step transitions and disclosure cleanup; avoid nesting competing measured-height collapse owners.

[Complete ThinkingSteps guide](https://fff.timhanlon.com/docs/thinking-steps.md)

## accordion

Expansion retains its exit while the panel collapses. Avoid a second measured-height collapse around it; let one owner settle the geometry. Keyboard movement and hover are scoped to the group.

[Complete Accordion guide](https://fff.timhanlon.com/docs/accordion.md)

## checkbox-group

The group owns roving focus and shared hover geometry. Give each choice a distinct id/value and preserve disabled exclusions; do not introduce another keyboard navigation owner.

[Complete CheckboxGroup guide](https://fff.timhanlon.com/docs/checkbox-group.md)

## radio-group

The selected value is controlled separately from the child focus model. Preserve native form identity and exclusion of disabled items from navigation.

[Complete RadioGroup guide](https://fff.timhanlon.com/docs/radio-group.md)

## tabs

Focus movement is manual activation: moving to another tab does not select it until activation. Keep selected value separate from child navigation state and use stable panel callbacks when they carry parent Messages or Mounts.

[Complete Tabs guide](https://fff.timhanlon.com/docs/tabs.md)

## slider

Value and transient drag state differ. Lift subscriptions, including the Range pair, so document-level dragging and Escape cancellation work. Stop/reset dragging when the control is removed.

[Complete Slider guide](https://fff.timhanlon.com/docs/slider.md)

## tooltip

Preserve delayed show, retained exit, trigger attributes and accessible description linkage. A portal inherits root tokens. Keep ids unique and release its Mount when the trigger disappears.

[Complete Tooltip guide](https://fff.timhanlon.com/docs/tooltip.md)

## calendar

Selection, booking/disabled restrictions and the displayed month are different concerns. The range band previews an end before committing. Preserve keyboard navigation and month-transition geometry; applications provide their own today and restrictions.

[Complete Calendar guide](https://fff.timhanlon.com/docs/calendar.md)

## color-picker

Keep hue through achromatic colors and controlled echoes. Rail drags require subscriptions; the panel Mount owns square dragging and field scrubbing. Popover positioning attributes and nested format-menu cleanup must survive composition.

[Complete ColorPicker guide](https://fff.timhanlon.com/docs/color-picker.md)

## dialog

The native modal owns isolation, focus trapping/return, scroll locking and retained exits. Forward the unmount lifecycle message before dropping its child state. Preserve the whole initial-focus and close-button attribute bundles.

[Complete Dialog guide](https://fff.timhanlon.com/docs/dialog.md)

## sidebar

Preserve responsive detection, collapse/peek, rail resizing and mobile focus/scroll cleanup. Header, rows and footer share alignment axes. Route selection belongs to the application, not a guessed DOM index.

[Complete Sidebar guide](https://fff.timhanlon.com/docs/sidebar.md)

## command-menu

Filtering, grouping, tabs and focus highlight must use the same visible item set. Shortcut hints are labels; an actual subscription registers the action. Keep dialog state through modal cleanup.

[Complete CommandMenu guide](https://fff.timhanlon.com/docs/command-menu.md)

## table

Use semantic table/header/body/cell structure and real controls for sorting. One Mount owns row hover. Empty content spans the actual column count. Consumer alignment classes override default cell alignment.

[Complete Table guide](https://fff.timhanlon.com/docs/table.md)

## chat-message

Messages, actions and visibility belong to the application. File previews have a lifetime: preserve image URL and PDF cleanup, rather than recreating File objects on every view.

[Complete ChatMessage guide](https://fff.timhanlon.com/docs/chat-message.md)

## input-message

Draft, attachments, queue and sending state are application-owned. QueueChanged and response-completion release are different edges. Preserve caret/history, file-preview and resizing cleanup; transport cancellation belongs to the app.

[Complete InputMessage guide](https://fff.timhanlon.com/docs/input-message.md)

## ask-user-questions

A single choice can advance immediately; multi-select and free text need explicit submission. Preserve question ids, completion/replay state and accessible focus across steps. Treat validation as question configuration, not a global rule.

[Complete AskUserQuestions guide](https://fff.timhanlon.com/docs/ask-user-questions.md)
