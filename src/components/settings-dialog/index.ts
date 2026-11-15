import { Schema } from 'effect';
import { Command, Submodel, type Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import type { Html } from 'foldkit/html';
import * as Dialog from '../dialog';
import * as Sidebar from '../sidebar';
import * as Select from '../select';
import * as InputField from '../input-field';
import * as InputGroup from '../input-group';
import * as Switch from '../switch';
import * as Button from '../button';
import * as ScrollArea from '../scroll-area';
import { icon, type IconName } from '../icons';
import './styles.css';

const Section = Schema.Literals(['general', 'notifications', 'appearance', 'security', 'members']);
type Section = typeof Section.Type;
export const sections: readonly {
  value: Section;
  label: string;
  icon: IconName;
  description: string;
}[] = [
  {
    value: 'general',
    label: 'General',
    icon: 'settings',
    description: 'Workspace name, language, and region.',
  },
  {
    value: 'notifications',
    label: 'Notifications',
    icon: 'bell',
    description: 'What reaches your inbox and when.',
  },
  {
    value: 'appearance',
    label: 'Appearance',
    icon: 'palette',
    description: 'Theme and density for this device.',
  },
  {
    value: 'security',
    label: 'Security',
    icon: 'shield',
    description: 'Sign-in protection and active sessions.',
  },
  {
    value: 'members',
    label: 'Members',
    icon: 'users',
    description: 'Who can access this workspace.',
  },
];
export const Model = Schema.Struct({
  dialog: Dialog.Model,
  sidebar: Sidebar.Model,
  section: Section,
  selects: Schema.Record(Schema.String, Select.Model),
  values: Schema.Record(Schema.String, Schema.String),
  toggles: Schema.Record(Schema.String, Schema.Boolean),
});
export type Model = typeof Model.Type;
export const Message = defineMessageUnion({
  Dialog: { message: Dialog.Message },
  Sidebar: { message: Sidebar.Message },
  SectionSelected: { value: Section },
  Select: { key: Schema.String, message: Select.Message },
  FieldChanged: { value: Schema.String },
  Toggled: { key: Schema.String, checked: Schema.Boolean },
});
export type Message = typeof Message.Type;
export const init = ({
  id,
  defaultSection = 'general',
}: {
  readonly id: string;
  readonly defaultSection?: Section;
}): Model => ({
  // Focus the selected navigation row, as upstream does. The scrollable
  // sidebar viewport otherwise receives initial focus and paints a rectangular
  // ring clipped by the dialog's rounded corners. On mobile the hidden row
  // is skipped by Dialog's focusability check, falling back to the picker.
  dialog: Dialog.init({
    id,
    focusSelector: '[data-sidebar="menu-button"][aria-current="page"]',
  }),
  sidebar: Sidebar.init({ id: `${id}-sidebar`, width: '13rem' }),
  section: defaultSection,
  selects: {},
  values: {},
  toggles: {},
});
const resetFields = (model: Model): Model => ({
  ...model,
  values: {},
  toggles: {},
  selects: model.selects.section ? { section: model.selects.section } : {},
});
const chooseSection = (model: Model, section: Section) =>
  section === model.section ? model : resetFields({ ...model, section });
export function update(model: Model, message: Message): Update.Return<Model, Message> {
  switch (message._tag) {
    case 'Dialog': {
      const result = Dialog.update(model.dialog, message.message);
      const next = { ...model, dialog: result.model };
      return {
        model: result.outMessage?._tag === 'Opened' ? { ...resetFields(next), selects: {} } : next,
        commands: (result.commands ?? []).map((command) =>
          Command.mapMessage(command, (message) => Message.Dialog({ message })),
        ),
      };
    }
    case 'Sidebar': {
      const result = Sidebar.update(model.sidebar, message.message);
      return {
        model: { ...model, sidebar: result.model },
        commands: (result.commands ?? []).map((command) =>
          Command.mapMessage(command, (inner) => Message.Sidebar({ message: inner })),
        ),
      };
    }
    case 'SectionSelected':
      return { model: chooseSection(model, message.value) };
    case 'FieldChanged':
      return { model: { ...model, values: { ...model.values, name: message.value } } };
    case 'Toggled':
      return { model: { ...model, toggles: { ...model.toggles, [message.key]: message.checked } } };
    case 'Select': {
      const result = Select.update(
        model.selects[message.key] ?? Select.init({ id: `${model.dialog.id}-${message.key}` }),
        message.message,
      );
      let next = { ...model, selects: { ...model.selects, [message.key]: result.model } };
      const value = result.outMessage?.value;
      if (value !== undefined)
        next =
          message.key === 'section' && Schema.is(Section)(value)
            ? chooseSection(next, value)
            : { ...next, values: { ...next.values, [message.key]: value } };
      return {
        model: next,
        commands: (result.commands ?? []).map((command) =>
          Command.mapMessage(command, (event) =>
            Message.Select({ key: message.key, message: event }),
          ),
        ),
      };
    }
  }
}
export interface Props {
  readonly size?: 'default' | 'compact';
  readonly radius?: 'rounded' | 'pill' | 'sharp';
  readonly icons?: string;
  readonly hideTrigger?: boolean;
}
export const view = Submodel.defineView<Model, Message, Props>((model, props, h) => {
  const size = props.size ?? 'default',
    radius = props.radius ?? 'rounded';
  const choices = sections.map((section) => ({
    ...section,
    icon: icon(section.icon, props.icons, h),
  }));
  const kit: Sidebar.Kit<Message> = {
    h,
    toMessage: (message) => Message.Sidebar({ message }),
    size,
    radius,
    icons: props.icons,
  };
  const current = sections.find((section) => section.value === model.section)!;
  const picker = (
    key: string,
    label: string,
    initial: string,
    items: readonly Select.Item[],
    variant: 'bordered' | 'borderless' = 'bordered',
  ) =>
    h.submodel({
      slotId: `select-${key}`,
      model: model.selects[key] ?? Select.init({ id: `${model.dialog.id}-${key}` }),
      view: Select.view,
      toParentMessage: (message) => Message.Select({ key, message }),
      viewInputs: {
        label,
        items,
        size,
        radius,
        variant,
        value: key === 'section' ? model.section : (model.values[key] ?? initial),
      },
    });
  const options = (rows: readonly (readonly [string, string])[]) =>
    rows.map(([value, label]) => ({ value, label }));
  const row = (label: string, description: string, control: Html) =>
    h.div(
      [h.Class('ff-settings-row')],
      [
        h.div(
          [h.Class('ff-settings-row-copy')],
          [h.span([], [label]), h.span([h.Class('ff-settings-caption')], [description])],
        ),
        h.div([h.Class('ff-settings-control')], [control]),
      ],
    );
  const toggle = (key: string, label: string, description: string, initial: boolean) =>
    row(
      label,
      description,
      Switch.view(
        {
          radius: radius,
          id: `${model.dialog.id}-${key}`,
          label,
          size,
          checked: model.toggles[key] ?? initial,
          onToggle: (checked) => Message.Toggled({ key, checked }),
          className: 'ff-settings-switch',
        },
        h,
      ),
    );
  const button = (label: string) =>
    Button.view({ children: [label], size: 'compact', radius, variant: 'secondary' }, h);
  let content: Html;
  switch (model.section) {
    case 'notifications':
      content = h.div(
        [],
        [
          toggle('digest', 'Daily digest', 'One email each morning with what changed.', true),
          toggle('mentions', 'Mentions', 'When someone @-mentions you.', true),
          toggle('updates', 'Product updates', 'New features, once a month at most.', false),
        ],
      );
      break;
    case 'appearance':
      content = h.div(
        [],
        [
          row(
            'Theme',
            'Follows the system unless you pick one.',
            picker(
              'theme',
              'Theme',
              'system',
              [
                ['system', 'System', 'monitor'],
                ['light', 'Light', 'sun'],
                ['dark', 'Dark', 'moon'],
              ].map(([value, label, name]) => ({
                value: value!,
                label: label!,
                icon: icon(name as IconName, props.icons, h),
              })),
            ),
          ),
          row(
            'Density',
            'Row height across lists and tables.',
            picker(
              'density',
              'Density',
              'default',
              options([
                ['default', 'Default'],
                ['compact', 'Compact'],
              ]),
            ),
          ),
        ],
      );
      break;
    case 'security':
      content = h.div(
        [],
        [
          toggle(
            'twoFactor',
            'Two-factor authentication',
            'A code from your authenticator app at sign-in.',
            true,
          ),
          toggle('alerts', 'New sign-in alerts', 'Email when a new device signs in.', true),
          row(
            'Active sessions',
            '3 devices are signed in right now.',
            button('Sign out everywhere'),
          ),
        ],
      );
      break;
    case 'members':
      content = h.div(
        [],
        [
          ...[
            ['Jane Doe', 'jane@acme.com', 'owner'],
            ['Sam Park', 'sam@acme.com', 'admin'],
            ['Ravi Patel', 'ravi@acme.com', 'member'],
          ].map(([name, email, role]) =>
            row(
              name!,
              email!,
              picker(
                `member-${email}`,
                `Role for ${name}`,
                role!,
                options([
                  ['owner', 'Owner'],
                  ['admin', 'Admin'],
                  ['member', 'Member'],
                ]),
                'borderless',
              ),
            ),
          ),
          h.div([h.Class('ff-settings-invite')], [button('Invite people')]),
        ],
      );
      break;
    default:
      content = h.div(
        [h.Class('ff-settings-general')],
        [
          InputGroup.view(
            {
              size,
              radius,
              children: [
                InputField.view(
                  {
                    id: `${model.dialog.id}-name`,
                    label: 'Workspace name',
                    size,
                    radius,
                    value: model.values.name ?? 'Acme Inc',
                    placeholder: 'Acme Inc',
                    onInput: (value) => Message.FieldChanged({ value }),
                  },
                  h,
                ),
              ],
            },
            h,
          ),
          h.div(
            [],
            [
              row(
                'Language',
                'Used for the interface and emails.',
                picker(
                  'language',
                  'Language',
                  'en',
                  options([
                    ['en', 'English'],
                    ['fr', 'Français'],
                    ['de', 'Deutsch'],
                    ['ja', '日本語'],
                  ]),
                ),
              ),
              row(
                'Timezone',
                'Dates and reminders follow it.',
                picker(
                  'timezone',
                  'Timezone',
                  'utc+1',
                  options([
                    ['utc-8', '(UTC−8) Pacific'],
                    ['utc-5', '(UTC−5) Eastern'],
                    ['utc+0', '(UTC+0) London'],
                    ['utc+1', '(UTC+1) Paris'],
                    ['utc+9', '(UTC+9) Tokyo'],
                  ]),
                ),
              ),
            ],
          ),
        ],
      );
  }
  return h.submodel({
    slotId: 'dialog',
    model: model.dialog,
    view: Dialog.view,
    toParentMessage: (message) => Message.Dialog({ message }),
    viewInputs: {
      title: 'Settings',
      description: 'Workspace and account settings.',
      hideHeader: true,
      triggerLabel: 'Open settings',
      triggerVariant: 'secondary',
      hideTrigger: props.hideTrigger,
      width: 'xl',
      size,
      radius,
      icons: props.icons,
      className: 'ff-settings-dialog',
      renderContent: () =>
        Sidebar.provider(
          model.sidebar,
          { shortcut: null, mobileBreakpoint: 640, className: 'ff-settings-shell' },
          [
            ...Sidebar.sidebar(
              model.sidebar,
              {
                collapsible: 'none',
                height: 'h-full',
                className: 'ff-settings-sidebar hidden sm:flex',
              },
              [
                h.div([h.Class('ff-settings-sidebar-heading')], [h.h2([], ['Settings'])]),
                Sidebar.content(
                  model.sidebar,
                  [
                    Sidebar.group(
                      model.sidebar,
                      { label: 'Workspace' },
                      [
                        Sidebar.menu(
                          sections.map((section) => ({
                            key: section.value,
                            label: section.label,
                            icon: section.icon,
                            active: section.value === model.section,
                            onClick: Message.SectionSelected({ value: section.value }),
                          })),
                          { label: 'Settings sections', focusRing: false },
                          kit,
                        ),
                      ],
                      kit,
                    ),
                  ],
                  kit,
                ),
              ],
              kit,
            ),
            h.div(
              [h.Class('ff-settings-main')],
              [
                h.div(
                  [h.Class('ff-settings-panel-heading')],
                  [
                    h.div(
                      [h.Class('ff-settings-mobile')],
                      [
                        h.h2([], ['Settings']),
                        picker('section', 'Section', model.section, choices),
                      ],
                    ),
                    h.h3([h.Class('ff-settings-desktop')], [current.label]),
                    h.p([h.Class('ff-settings-desktop')], [current.description]),
                  ],
                ),
                ScrollArea.view(
                  {
                    label: `${current.label} settings`,
                    className: 'ff-settings-scroll',
                    radius,
                    children: [h.div([h.Class('ff-settings-panel')], [content])],
                  },
                  h,
                ),
              ],
            ),
          ],
          kit,
        ),
    },
  });
});
