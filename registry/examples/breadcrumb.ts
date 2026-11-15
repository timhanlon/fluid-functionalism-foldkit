import { Command, type Update } from 'foldkit';
import { Schema } from 'effect';
import type { HtmlBuilder } from 'foldkit/html';
import * as Breadcrumb from './fluid/components/breadcrumb';

export const Model = Schema.Struct({ trail: Breadcrumb.Model, selected: Schema.String });
export interface Model extends Schema.Schema.Type<typeof Model> {}
export type Message = Breadcrumb.Message;
export const init = () => ({
  model: { trail: Breadcrumb.init({ id: 'project-trail' }), selected: '' },
});
export function update(model: Model, message: Message): Update.Return<Model, Message> {
  const result = Breadcrumb.update(model.trail, message);
  return {
    model: { trail: result.model, selected: result.outMessage?.value ?? model.selected },
    commands: result.commands?.map((command) => Command.mapMessage(command, (message) => message)),
  };
}
export function view(model: Model, h: HtmlBuilder<Message>) {
  return {
    title: 'Breadcrumb example',
    body: h.main(
      [h.Style({ maxWidth: '640px', margin: '40px auto' })],
      [
        h.h1([], ['Breadcrumb']),
        h.submodel({
          slotId: 'trail',
          model: model.trail,
          view: Breadcrumb.view,
          toParentMessage: (message) => message,
          viewInputs: {
            items: [
              { value: 'home', label: 'Home', href: '/', icon: 'home', iconOnly: true },
              { value: 'workspace', label: 'Workspace', href: '#workspace' },
              { value: 'projects', label: 'Projects', href: '#projects' },
              { value: 'website', label: 'Website', href: '#website' },
              {
                value: 'design',
                label: 'Design',
                items: [
                  { value: 'design', label: 'Design' },
                  { value: 'engineering', label: 'Engineering' },
                ],
              },
              { value: 'roadmap', label: 'Roadmap.md', icon: 'file' },
            ],
            collapse: 'overflow',
            reveal: 'menu',
            openOnHover: true,
          },
        }),
        h.p(
          [h.Role('status')],
          [model.selected ? `Selected ${model.selected}` : 'Open a step to choose a destination.'],
        ),
      ],
    ),
  };
}
