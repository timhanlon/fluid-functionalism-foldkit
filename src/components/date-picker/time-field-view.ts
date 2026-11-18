import { Option } from 'effect';
import { Popover } from '@foldkit/ui';
import { Submodel } from 'foldkit';
import type { Html } from 'foldkit/html';
import * as ScrollArea from '../scroll-area';
import { Model, Message } from './time-field-model';
import * as Edit from './time-field-state';
import { Anchored, FieldMounted, ListMounted } from './time-field-runtime';
import { formatDuration, formatTime } from './time';
import './styles.css';
export interface Props extends Edit.Options {
  readonly label: string;
  readonly liveAnchorId?: string;
  readonly radius?: 'rounded' | 'pill' | 'sharp';
  readonly placeholder: string;
  readonly prefix?: Html;
  readonly suffix?: Html;
  readonly size?: 'default' | 'compact';
}
const cache = new WeakMap<
  Edit.Options['slots'],
  Map<string, { labels: readonly string[]; widest: readonly string[] }>
>();
function formatted(props: Edit.Options) {
  let entries = cache.get(props.slots);
  if (!entries) {
    entries = new Map();
    cache.set(props.slots, entries);
  }
  const key = `${props.hourCycle}:${props.locale ?? ''}`,
    cached = entries.get(key);
  if (cached) return cached;
  const labels = props.slots.map((slot) => formatTime(slot.minutes, props.hourCycle, props.locale)),
    longest = labels.reduce((a, b) => (b.length > a.length ? b : a), ''),
    twin = longest.replace(/AM|PM/, (value) => (value === 'AM' ? 'PM' : 'AM')),
    result = { labels, widest: twin === longest ? [longest] : [longest, twin] };
  entries.set(key, result);
  return result;
}
export const view = Submodel.defineView<Model, Message, Props>((model, props, h) => {
  const { labels, widest } = formatted(props);
  const text = Edit.display(model.edit, props),
    selected = Edit.selectedIndex(props),
    listId = `${model.id}-list`,
    anchorId = Popover.buttonId(model.popover.id),
    active = Option.getOrUndefined(model.edit.activeIndex);
  return h.submodel({
    slotId: 'popup',
    model: model.popover,
    view: Popover.view,
    toParentMessage: (message) => Message.Popover({ message }),
    viewInputs: {
      anchor: { placement: 'bottom-start', gap: 6, padding: 8, portal: true },
      toView: (info) =>
        h.span(
          [h.Class('ff-time-field-host')],
          [
            h.span(
              [
                h.Id(anchorId),
                h.Class('ff-date-picker-time'),
                h.DataAttribute('slot', 'date-picker-time'),
                h.DataAttribute('datepicker-segment', ''),
                h.DataAttribute(
                  'editing',
                  String(model.edit.isOpen || Option.isSome(model.edit.draft)),
                ),
                h.OnMount(FieldMounted({ listId })),
              ],
              [
                props.prefix ?? null,
                h.span(
                  [h.Class('ff-time-input-grid')],
                  [
                    ...[text || props.placeholder, ...widest].map((value) =>
                      h.span([h.Class('ff-time-input-sizer'), h.AriaHidden(true)], [value]),
                    ),
                    h.input([
                      h.Id(`${model.id}-input`),
                      h.Type('text'),
                      h.InputMode('text'),
                      h.Size(1),
                      h.Role('combobox'),
                      h.AriaLabel(props.label),
                      h.AriaExpanded(model.edit.isOpen),
                      h.AriaAutocomplete('list'),
                      ...(model.edit.isOpen ? [h.AriaControls(listId)] : []),
                      ...(model.edit.isOpen && active !== undefined
                        ? [h.AriaActiveDescendant(`${listId}-${active}`)]
                        : []),
                      h.Autocomplete('off'),
                      h.Spellcheck(false),
                      h.Disabled(!!props.disabled),
                      h.Placeholder(props.placeholder),
                      h.Value(text),
                      h.OnFocus(Message.Edit({ message: Edit.Message.Opened() })),
                      h.OnClick(Message.Edit({ message: Edit.Message.Opened() })),
                      h.OnInput((value) =>
                        Message.Edit({ message: Edit.Message.Changed({ value }) }),
                      ),
                      h.OnKeyDownPreventDefault((key) =>
                        Edit.handlesKey(model.edit, key)
                          ? Option.some(Message.Edit({ message: Edit.Message.PressedKey({ key }) }))
                          : Option.none(),
                      ),
                    ]),
                  ],
                ),
                props.suffix
                  ? h.span(
                      [
                        h.Class('ff-time-suffix'),
                        h.DataAttribute(
                          'editing',
                          String(model.edit.isOpen || Option.isSome(model.edit.draft)),
                        ),
                      ],
                      [props.suffix],
                    )
                  : null,
              ],
            ),
            info.isVisible
              ? h.div(
                  [
                    ...info.backdrop,
                    h.Class('ff-popup-backdrop'),
                    h.AriaHidden(true),
                    h.DataAttribute('slot', 'popup-shield'),
                    h.DataAttribute('shield-for', `${model.popover.id}-panel`),
                    h.DataAttribute('shield-anchor', props.liveAnchorId ?? anchorId),
                  ],
                  [],
                )
              : null,
            info.isVisible
              ? h.div(
                  [
                    ...info.panel,
                    h.OnMount(Anchored({ anchorId })),
                    h.Class('ff-popup ff-time-popup'),
                    h.DataAttribute('radius', props.radius === 'sharp' ? 'sharp' : 'rounded'),
                    h.DataAttribute('open', String(model.edit.isOpen)),
                    h.DataAttribute('size', props.size ?? 'default'),
                  ],
                  [
                    ScrollArea.view(
                      {
                        className: 'ff-time-scroll',
                        viewportClassName: 'ff-time-viewport ff-scroll-fade',
                        children: [
                          h.div(
                            [
                              h.Id(listId),
                              h.Class('ff-time-list'),
                              h.Role('listbox'),
                              h.AriaLabel(props.label),
                              h.DataAttribute(
                                'duration',
                                String(props.slots.some((slot) => slot.duration !== undefined)),
                              ),
                              h.DataAttribute(
                                'active-index',
                                active === undefined ? '' : String(active),
                              ),
                              h.DataAttribute(
                                'open-target',
                                Option.isSome(model.openTarget)
                                  ? String(model.openTarget.value)
                                  : '',
                              ),
                              h.DataAttribute(
                                'scroll-generation',
                                String(model.edit.scrollGeneration),
                              ),
                              h.DataAttribute('scroll-center', String(model.edit.scrollCenter)),
                              h.OnMount(ListMounted({ anchorId })),
                            ],
                            props.slots.map((slot, index) =>
                              h.div(
                                [
                                  h.Key(String(slot.minutes)),
                                  h.Id(`${listId}-${index}`),
                                  h.Role('option'),
                                  h.Class('ff-time-option'),
                                  h.AriaSelected(index === selected),
                                  h.DataAttribute('active', String(index === active)),
                                  h.OnClick(
                                    Message.Edit({ message: Edit.Message.Picked({ index }) }),
                                  ),
                                ],
                                [
                                  h.span(
                                    [h.Class('ff-time-option-label')],
                                    [
                                      ...[labels[index]!, ...widest].map((value) =>
                                        h.span(
                                          [h.Class('ff-time-option-sizer'), h.AriaHidden(true)],
                                          [value],
                                        ),
                                      ),
                                      h.span([], [labels[index]!]),
                                    ],
                                  ),
                                  slot.duration === undefined
                                    ? null
                                    : h.span(
                                        [h.Class('ff-time-option-duration')],
                                        [formatDuration(slot.duration)],
                                      ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      },
                      h,
                    ),
                  ],
                )
              : null,
          ],
        ),
    },
  });
});
