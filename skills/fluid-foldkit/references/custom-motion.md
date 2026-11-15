# Motion next to native Foldkit controls

Use the installed source as the timing and ownership reference. The port uses
Motion's DOM API from `motion`, never `motion/react`. Foldkit Models own persistent
interaction state; scoped Mount Effects own DOM geometry, observers, listeners
and animation handles. Commands handle asynchronous results. Avoid global DOM
listeners without scoped release, and avoid doing DOM work during view.

The design has fast, moderate and slow motion tiers (roughly 80, 160 and 240ms),
with crisp exits. Read the actual component before choosing a spring or exit;
the port does not ship an upstream React `springs` module. Reuse a component's
animation conventions instead of introducing a second competing choreography.
Honor prefers-reduced-motion in custom browser Effects.

One hover geometry owner serves a list or grid. The shipped helper is
`src/fluid/fluid-hover/engine.ts` from `/r/hover.json`; `mountHover(element,
{ itemSelector, axis })` returns a disposable engine. Acquire it in a Mount and
call dispose on release. Import fluid-hover/styles.css, use a positioned
ff-hover-scope container and retain a foreground layer for the items. The complete
external recipe is /docs/fluid-hover.md. Data-dependent item membership must be measured again.
Use plain state attributes from the view; avoid state-dependent :has selectors
that restyle an entire page. Do not layer another hover on a control that already
owns one. The root data-hover setting can select standard hover.

Use transform and opacity for travel where possible. Some existing controls
measure and animate geometry deliberately; do not substitute transforms blindly
for a retained height transition or compose two competing collapse owners.

Weight changes need stable label geometry. Keep the heavier ghost label in the
same grid cell as the visible label and expose only the visible text to assistive
technology. Variable Inter's paired weight and optical-size settings preserve
width more accurately than weight alone. It is optional and consumer supplied;
a fallback font needs separate geometry checks.

Icons share a fixed cell during crossfade. Rounded nested surfaces derive their
inner radius from the outer radius and actual inset; use the installed shape
helper instead of assuming every inset is 4px. Sharp remains a deliberate 1px
corner. Use tailwind.css tokens for foreground/muted text, surfaces and focus accent.
Font size and line height are paired; default and compact controls differ.

Page Reveal remains a reference-only system. Do not install upstream React
reveal classes or hand-roll a replacement while claiming it is a supported port.
