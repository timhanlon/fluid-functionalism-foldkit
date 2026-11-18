import { Option } from 'effect';
import { Submodel } from 'foldkit';
import type { Attribute, ChildAttribute, Html, HtmlBuilder } from 'foldkit/html';
import * as Button from '../button';
import * as Tooltip from '../tooltip';
import { icon } from '../icons';
import {
  addMonths,
  compare,
  firstOfMonth,
  isEqual,
  key,
  lastOfMonth,
  ordinal,
  toNative,
  type Day,
} from './dates';
import { bandSlice, monthGrid } from './grid';
import { dayState } from './matchers';
import { picking, rangeBand, selectedDay } from './selection';
import { gridKeys, initialFocus } from './focus';
import { createLabelFormatters, type Labels, type Formatters } from './labels';
import { detailFor, hasDetail, type DayDetail } from './details';
import {
  Model,
  Message,
  dayId,
  navigationTarget,
  navigationTooltipGroup,
  selection,
  viewMonth,
  visibleMonths,
  type Options,
} from './state';
import { Mounted } from './runtime';
import './styles.css';
export interface Props extends Options {
  readonly size?: 'default' | 'compact';
  readonly radius?: 'rounded' | 'pill' | 'sharp';
  readonly icons?: string;
  readonly cellSize?: number;
  readonly fill?: boolean;
  readonly showOutsideDays?: boolean;
  readonly autoFocus?: boolean;
  readonly dayDetail?: DayDetail;
  readonly locale?: string;
  /** For h.submodel, return callback labels from a top-level factory:
   * `labels: () => ({ day: (date) => date.toDateString() })`.
   * Object values support static labels, or callbacks in a direct view call. */
  readonly labels?: Labels | (() => Labels);
  /** Use a top-level factory in h.submodel: `formatters: () => ({ day: () => "•" })`.
   * The object form remains available to direct view callers. */
  readonly formatters?: Formatters | (() => Formatters);
  readonly attributes?: readonly (Attribute<Message> | ChildAttribute)[];
}
export const view = Submodel.defineView<Model, Message, Props>((model, props, h) => {
  const months = visibleMonths(model, props),
    grids = months.map((month) => monthGrid(month, props)),
    count = props.numberOfMonths ?? 1;
  const layout =
      count > 1
        ? props.orientation === undefined || props.orientation === 'auto'
          ? model.layout
          : props.orientation
        : 'horizontal',
    stacked = count > 1 && layout === 'vertical',
    twoUp = count > 1 && !stacked;
  const current = selection(model, props),
    isPicking = props.mode === 'range' && picking(current),
    preview = Option.getOrUndefined(model.hovered),
    band = rangeBand(current, preview, props);
  const outsideHidden = count > 1 || props.showOutsideDays === false,
    locale = props.locale ?? 'en-US',
    cell = props.cellSize ?? (props.size === 'compact' ? 32 : 36);
  const labels = createLabelFormatters(locale);
  const customLabels = typeof props.labels === 'function' ? props.labels() : props.labels;
  const formatters = typeof props.formatters === 'function' ? props.formatters() : props.formatters;
  const inMonthDays = grids.flatMap((grid) =>
    grid.weeks.flatMap((week) =>
      week.days.filter((date) => date.month === grid.month.month && date.year === grid.month.year),
    ),
  );
  const tabDate = initialFocus(
    inMonthDays,
    current,
    model.today,
    props,
    Option.getOrUndefined(model.focused),
  );
  const gridStart = grids[0] ? ordinal(grids[0].first) : 0;
  const nav = (directions: readonly (-1 | 1)[]) => {
    const key = directions.length === 2 ? 'pair' : directions[0]! < 0 ? 'previous' : 'next';
    const group = navigationTooltipGroup(model, key);
    const toMessage = (message: Tooltip.Group.Message) =>
      Message.NavigationTooltip({ key, message });
    return h.div(
      [
        h.Class('ff-calendar-nav'),
        h.DataAttribute('slot', 'calendar-nav'),
        h.DataAttribute('calendar-inert', ''),
      ],
      [
        Tooltip.Group.view(
          group,
          {
            toMessage,
            children: directions.map((direction) =>
              h.span(
                [h.Class('ff-calendar-nav-slot')],
                [
                  Tooltip.Group.tip(
                    group,
                    direction < 0 ? 'previous' : 'next',
                    {
                      content: direction < 0 ? 'Previous month' : 'Next month',
                      radius: props.radius,
                      renderTrigger: (attributes) =>
                        Button.view(
                          {
                            variant: 'ghost',
                            // Upstream's icon-compact: the chevron renders at 14px.
                            size: 'icon-compact',
                            radius: props.radius,
                            label:
                              direction < 0
                                ? (customLabels?.previousMonth ?? 'Go to the Previous Month')
                                : (customLabels?.nextMonth ?? 'Go to the Next Month'),
                            disabled: !navigationTarget(model, props, direction),
                            onClick: Message.Navigate({ direction }),
                            className: 'ff-calendar-nav-button',
                            attributes: [
                              ...attributes,
                              h.DataAttribute('calendar-nav', direction < 0 ? 'previous' : 'next'),
                            ],
                            children: [
                              h.span(
                                [
                                  h.Class('ff-calendar-nav-chevron'),
                                  h.DataAttribute('direction', String(direction)),
                                ],
                                [icon('chevron-right', props.icons, h)],
                              ),
                            ],
                          },
                          h,
                        ),
                    },
                    toMessage,
                    h,
                  ),
                ],
              ),
            ),
          },
          h,
        ),
      ],
    );
  };
  const weekdays = (grid: (typeof grids)[number], visual = false) =>
    h.div(
      [
        h.Class('ff-calendar-weekdays'),
        h.DataAttribute('calendar-inert', ''),
        ...(visual ? [h.AriaHidden(true)] : [h.Role('row')]),
      ],
      [
        props.showWeekNumber
          ? h.span(
              [
                h.Class('ff-calendar-week-number'),
                ...(visual
                  ? []
                  : [
                      h.Role('columnheader'),
                      h.AriaLabel(customLabels?.weekNumberHeader ?? 'Week Number'),
                    ]),
              ],
              [],
            )
          : null,
        ...grid.weeks[0]!.days.map((date) =>
          h.span(
            [
              h.Class('ff-calendar-weekday'),
              ...(visual
                ? []
                : [
                    h.Role('columnheader'),
                    h.AriaLabel(customLabels?.weekday?.(toNative(date)) ?? labels.dayName(date)),
                  ]),
            ],
            [formatters?.weekday?.(toNative(date)) ?? labels.dayName(date, true).slice(0, 2)],
          ),
        ),
      ],
    );
  const nodeForDay = (date: Day, grid: (typeof grids)[number]): Html => {
    const outside = date.month !== grid.month.month || date.year !== grid.month.year,
      rules = dayState(date, props),
      today = isEqual(date, model.today);
    const hidden =
      rules.hidden ||
      (outsideHidden && outside) ||
      (!!props.startMonth && compare(date, firstOfMonth(props.startMonth)) < 0) ||
      (!!props.endMonth && compare(date, lastOfMonth(props.endMonth)) > 0);
    const selected =
      props.mode === 'range'
        ? current._tag === 'Range' && selectedDay(current, date)
        : current._tag === 'Single' && isEqual(current.date, date);
    const from = current._tag === 'Range' ? Option.getOrUndefined(current.from) : undefined,
      to = current._tag === 'Range' ? Option.getOrUndefined(current.to) : undefined;
    const end =
      props.mode === 'range'
        ? (!!from && isEqual(from, date)) || (!isPicking && !!to && isEqual(to, date))
        : selected;
    const proposed =
      isPicking && !!band && !!preview && isEqual(date, preview) && (!from || !isEqual(date, from));
    const slice = bandSlice(date, grid, band, outsideHidden, hidden),
      n = ordinal(date),
      middle = !!band && n > ordinal(band.from) && n < ordinal(band.to);
    const detail = detailFor(props.dayDetail, date, outside),
      showDetail = hasDetail(detail),
      detailId = `${model.id}-detail-${key(date)}`;
    const modifiers = {
      selected,
      today,
      booked: rules.booked,
      disabled: rules.disabled,
      outside,
      hidden,
    };
    const committed =
      !isPicking &&
      end &&
      Option.isSome(model.committedEnd) &&
      isEqual(model.committedEnd.value, date);
    return h.div(
      [
        h.Key(key(date)),
        h.Class('ff-calendar-cell'),
        h.Role('gridcell'),
        h.AriaSelected(selected),
        h.DataAttribute('day', key(date)),
        h.DataAttribute('outside', String(outside)),
        h.DataAttribute('hidden', String(hidden)),
        h.DataAttribute('today', String(today)),
      ],
      [
        slice
          ? h.span(
              [
                h.Class('ff-calendar-band'),
                h.DataAttribute('slot', 'calendar-range-band'),
                h.AriaHidden(true),
                h.Style({
                  left: slice.left,
                  right: slice.right,
                  borderTopLeftRadius: `${slice.borderTopLeftRadius}px`,
                  borderBottomLeftRadius: `${slice.borderBottomLeftRadius}px`,
                  borderTopRightRadius: `${slice.borderTopRightRadius}px`,
                  borderBottomRightRadius: `${slice.borderBottomRightRadius}px`,
                }),
              ],
              [],
            )
          : null,
        hidden
          ? null
          : h.button(
              [
                h.Id(dayId(model.id, date)),
                h.Class('ff-calendar-day'),
                h.Type('button'),
                h.Disabled(rules.disabled),
                h.AriaLabel(
                  customLabels?.day?.(toNative(date), modifiers) ??
                    labels.dayLabel(date, modifiers),
                ),
                h.Tabindex(tabDate && isEqual(tabDate, date) ? 0 : -1),
                h.DataAttribute('date', key(date)),
                ...(!outside ? [h.DataAttribute('calendar-index', String(n - gridStart))] : []),
                ...(rules.disabled ? [h.DataAttribute('calendar-inert', '')] : []),
                h.DataAttribute('selected', String(end)),
                h.DataAttribute('booked', String(rules.booked)),
                h.DataAttribute('unavailable', String(rules.disabled)),
                h.DataAttribute('preview-end', String(proposed)),
                h.DataAttribute('range-middle', String(middle)),
                h.DataAttribute('committed', String(committed)),
                ...(showDetail ? [h.AriaDescribedBy(detailId)] : []),
                h.OnClick(Message.PressedDay({ date }), {
                  defaultAction: 'Prevent',
                  propagation: 'Stop',
                }),
                h.OnKeyDownPreventDefault((pressed, modifiers) =>
                  gridKeys.some((value) => value === pressed) || (pressed === 'Escape' && isPicking)
                    ? Option.some(
                        Message.GridKey({ date, key: pressed, shift: modifiers.shiftKey }),
                      )
                    : Option.none(),
                ),
              ],
              [
                h.span(
                  [h.Class('ff-calendar-number')],
                  [formatters?.day?.(toNative(date)) ?? String(date.day)],
                ),
                showDetail
                  ? h.span(
                      [
                        h.Id(detailId),
                        h.Class('ff-calendar-day-detail'),
                        h.DataAttribute('slot', 'calendar-day-detail'),
                      ],
                      [typeof detail === 'function' ? detail(h) : String(detail)],
                    )
                  : null,
                today && !showDetail
                  ? h.span(
                      [
                        h.Class('ff-calendar-today-dot'),
                        h.DataAttribute('slot', 'calendar-today-dot'),
                        h.AriaHidden(true),
                      ],
                      [],
                    )
                  : null,
              ],
            ),
      ],
    );
  };
  const rendered = grids.map((grid, index) => {
    const name = formatters?.caption?.(toNative(grid.month)) ?? labels.caption(grid.month),
      captionId = `${model.id}-caption-${index}`;
    return h.div(
      [
        h.Key(`slot-${index}`),
        h.Class('ff-calendar-month'),
        h.DataAttribute('slot', 'calendar-month'),
        h.DataAttribute('month', key(grid.month)),
        h.DataAttribute('display-index', String(index)),
      ],
      [
        h.div(
          [
            h.Class('ff-calendar-caption'),
            h.DataAttribute('slot', 'calendar-caption'),
            h.DataAttribute('calendar-inert', ''),
          ],
          [
            twoUp && index === 0 && !props.hideNavigation && !props.disableNavigation
              ? nav([-1])
              : null,
            h.span(
              [h.Class('ff-calendar-caption-layer')],
              [
                h.span(
                  [h.Class('ff-calendar-caption-inner')],
                  [
                    h.span(
                      [h.Class('ff-calendar-caption-clip')],
                      [
                        h.span(
                          [
                            h.Key(key(grid.month)),
                            h.Id(captionId),
                            h.Class('ff-calendar-caption-text'),
                            h.Role('status'),
                            h.AriaLive('polite'),
                          ],
                          [name],
                        ),
                        h.span([h.Class('ff-calendar-caption-outgoing'), h.AriaHidden(true)], []),
                      ],
                    ),
                  ],
                ),
              ],
            ),
            !props.hideNavigation && !props.disableNavigation && !stacked
              ? twoUp
                ? index === grids.length - 1
                  ? nav([1])
                  : null
                : nav([-1, 1])
              : null,
          ],
        ),
        h.div(
          [
            h.Class('ff-calendar-grid'),
            h.DataAttribute('slot', 'calendar-grid'),
            h.Role('grid'),
            h.AriaLabel(customLabels?.month?.(toNative(grid.month)) ?? name),
            h.AriaLabelledBy(captionId),
            ...(props.mode === 'range' ? [h.AriaMultiSelectable(true)] : []),
          ],
          [
            h.div(
              [h.Class('ff-calendar-weeks'), h.DataAttribute('slot', 'calendar-weeks')],
              [
                h.div(
                  [h.Key(key(grid.month)), h.Class('ff-calendar-weeks-panel'), h.Role('rowgroup')],
                  [
                    stacked
                      ? h.div([h.Class('ff-calendar-sr-only')], [weekdays(grid)])
                      : weekdays(grid),
                    h.div(
                      [
                        h.Class('ff-calendar-days'),
                        ...(twoUp && !props.fill
                          ? [
                              h.Style({
                                minHeight: `${Math.max(...grids.map((item) => item.weeks.length)) * cell}px`,
                              }),
                            ]
                          : []),
                      ],
                      grid.weeks.map((week) =>
                        h.div(
                          [h.Key(key(week.days[0]!)), h.Class('ff-calendar-week'), h.Role('row')],
                          [
                            props.showWeekNumber
                              ? h.div(
                                  [
                                    h.Class('ff-calendar-week-number'),
                                    h.DataAttribute('calendar-inert', ''),
                                    h.Role('rowheader'),
                                    h.AriaLabel(
                                      customLabels?.weekNumber?.(week.week) ?? `Week ${week.week}`,
                                    ),
                                  ],
                                  [formatters?.weekNumber?.(week.week) ?? String(week.week)],
                                )
                              : null,
                            ...week.days.map((date) => nodeForDay(date, grid)),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
                h.div([h.Class('ff-calendar-weeks-outgoing'), h.AriaHidden(true)], []),
              ],
            ),
          ],
        ),
      ],
    );
  });
  return h.div(
    [
      h.Id(model.id),
      h.Class('ff-calendar'),
      h.DataAttribute('slot', 'calendar-root'),
      h.DataAttribute('size', props.size ?? 'default'),
      h.DataAttribute('radius', props.radius ?? 'rounded'),
      h.DataAttribute('number-months', String(count)),
      h.DataAttribute('orientation', props.orientation ?? 'auto'),
      h.DataAttribute('layout', layout),
      h.DataAttribute('fill', String(!!props.fill)),
      h.DataAttribute('week-numbers', String(!!props.showWeekNumber)),
      h.DataAttribute('picking', String(isPicking)),
      h.DataAttribute('nav-hidden', String(!!props.hideNavigation || !!props.disableNavigation)),
      h.DataAttribute(
        'range-complete',
        String(
          props.mode === 'range' &&
            current._tag === 'Range' &&
            Option.isSome(current.from) &&
            Option.isSome(current.to),
        ),
      ),
      h.DataAttribute('view-month', key(viewMonth(model, props))),
      h.DataAttribute('keyboard', String(model.keyboard && model.hasFocus)),
      h.DataAttribute('focused', Option.isSome(model.focused) ? key(model.focused.value) : ''),
      h.DataAttribute('auto-focus', String(!!props.autoFocus)),
      h.DataAttribute(
        'range-start',
        current._tag === 'Range' && Option.isSome(current.from) ? key(current.from.value) : '',
      ),
      h.DataAttribute('hovered', Option.isSome(model.hovered) ? key(model.hovered.value) : ''),
      h.DataAttribute('band-from', band ? key(band.from) : ''),
      h.DataAttribute('band-to', band ? key(band.to) : ''),
      h.DataAttribute('commit-generation', String(model.commitGeneration)),
      h.DataAttribute('cell-size', String(cell)),
      h.DataAttribute(
        'commit-end',
        Option.isSome(model.committedEnd) ? key(model.committedEnd.value) : '',
      ),
      h.Attribute('dir', props.dir ?? 'ltr'),
      h.Style({ '--cell-size': `${cell}px` }),
      h.OnMount(Mounted()),
      ...(props.attributes ?? []),
    ],
    [
      h.div(
        [h.Class('ff-calendar-body'), h.DataAttribute('slot', 'calendar')],
        [
          h.div(
            [h.Class('ff-calendar-months'), h.DataAttribute('slot', 'calendar-months')],
            [
              stacked && grids[0]
                ? h.div(
                    [h.Class('ff-calendar-sticky-weekdays'), h.DataAttribute('calendar-inert', '')],
                    [weekdays(grids[0], true)],
                  )
                : null,
              stacked && !props.hideNavigation && !props.disableNavigation
                ? h.div([h.Class('ff-calendar-stacked-nav')], [nav([-1, 1])])
                : null,
              h.div(
                [h.Class('ff-calendar-strip')],
                [h.div([h.Class('ff-calendar-hover-layers'), h.AriaHidden(true)], []), ...rendered],
              ),
            ],
          ),
        ],
      ),
    ],
  );
});
