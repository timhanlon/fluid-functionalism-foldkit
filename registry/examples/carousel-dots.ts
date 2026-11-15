import { Schema } from 'effect';
import type { Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import type { HtmlBuilder } from 'foldkit/html';
import * as CarouselDots from './fluid/components/carousel-dots';

export const Model = Schema.Struct({
  value: Schema.Number,
  source: Schema.String,
  playing: Schema.Boolean,
  paused: Schema.Boolean,
  shown: Schema.Boolean,
});
export interface Model extends Schema.Schema.Type<typeof Model> {}
export const Message = defineMessageUnion({
  Changed: { value: Schema.Number, source: Schema.String },
  PlaybackToggled: {},
  PauseToggled: {},
  VisibilityToggled: {},
});
export type Message = typeof Message.Type;
export const init = () => ({
  model: { value: 0, source: 'initial', playing: false, paused: false, shown: true },
});
export function update(model: Model, message: Message): Update.Return<Model, Message> {
  switch (message._tag) {
    case 'Changed':
      return { model: { ...model, value: message.value, source: message.source } };
    case 'PlaybackToggled':
      return { model: { ...model, playing: !model.playing, value: 0 } };
    case 'PauseToggled':
      return { model: { ...model, paused: !model.paused } };
    case 'VisibilityToggled':
      return { model: { ...model, shown: !model.shown } };
  }
}
export function view(model: Model, h: HtmlBuilder<Message>) {
  return {
    title: 'CarouselDots example',
    body: h.main(
      [],
      [
        h.h1([], ['CarouselDots']),
        model.shown
          ? CarouselDots.view(
              {
                count: 3,
                value: model.value,
                label: 'Preview slides',
                radius: 'sharp',
                onValueChange: (value, source) => Message.Changed({ value, source }),
                autoplay: model.playing ? { duration: 600, paused: model.paused } : false,
              },
              h,
            )
          : null,
        h.p([], [`Slide: ${model.value + 1}; source: ${model.source}`]),
        h.button(
          [h.Type('button'), h.OnClick(Message.PlaybackToggled())],
          [model.playing ? 'Stop autoplay' : 'Start autoplay'],
        ),
        h.button(
          [h.Type('button'), h.OnClick(Message.PauseToggled())],
          [model.paused ? 'Resume autoplay' : 'Pause autoplay'],
        ),
        h.button(
          [h.Type('button'), h.OnClick(Message.VisibilityToggled())],
          [model.shown ? 'Hide carousel' : 'Show carousel'],
        ),
      ],
    ),
  };
}
