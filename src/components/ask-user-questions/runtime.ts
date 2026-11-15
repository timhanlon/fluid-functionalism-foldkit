import { shapeRadius } from '../shape';
import { Effect, Queue, Stream } from 'effect';
import { Mount } from 'foldkit';
import { animate, type AnimationPlaybackControls } from 'motion';
import { mountHover, type HoverEngine } from '../../fluid-hover/engine';
import { Message } from './state';
import { bindKeyboard } from './keyboard';
type Emitted =
  | typeof Message.Chose.Type
  | typeof Message.Submitted.Type
  | typeof Message.WentBack.Type
  | typeof Message.Skipped.Type;
/** The flow's DOM half: the morphing height, the fluid-hover spotlight over
 * the rows, autosizing fields, and the keyboard (1–9 picks, arrows move,
 * ⌘↵ submits). With several flows on a page, keys go to the focused one,
 * else the last mounted. */
export const Runtime = Mount.defineStream('AskUserQuestions.Runtime', {
  messages: [Message.Chose, Message.Submitted, Message.WentBack, Message.Skipped],
  execute: ({ element }) =>
    Stream.callback<Emitted>((queue) =>
      Effect.acquireRelease(
        Effect.sync(() => {
          if (!(element instanceof HTMLElement)) return () => {};
          const send = (message: Emitted) => Queue.offerUnsafe(queue, message);
          const reduced = matchMedia('(prefers-reduced-motion: reduce)');
          let hover: HoverEngine | undefined,
            previousStep = '',
            animation: AnimationPlaybackControls | undefined;
          let first = true,
            restoreKeyboardFocus = false;
          const rows = () => [...element.querySelectorAll<HTMLElement>('[data-auq-option]')];
          const fieldSize = () => {
            for (const field of element.querySelectorAll<HTMLTextAreaElement>('textarea')) {
              field.style.height = '0px';
              field.style.height = `${field.scrollHeight}px`;
            }
            hover?.measure();
          };
          const measure = () => {
            const region = element.querySelector<HTMLElement>('[data-auq-morph]');
            const body = element.querySelector<HTMLElement>('[data-auq-body]');
            if (!region || !body) return;
            const height = body.offsetHeight;
            const from = region.offsetHeight;
            animation?.stop();
            if (first || reduced.matches || from === height) region.style.height = `${height}px`;
            else
              animation = animate(from, height, {
                type: 'spring',
                duration: 0.4,
                bounce: 0,
                onUpdate: (n) => {
                  region.style.height = `${n}px`;
                },
              });
            first = false;
          };
          const sync = () => {
            if (previousStep !== element.dataset.auqStep) {
              previousStep = element.dataset.auqStep ?? '';
              hover?.dispose();
              const options = element.querySelector<HTMLElement>('.auq-options');
              hover = options
                ? mountHover(options, {
                    itemSelector: '[data-auq-option],.auq-other',
                    nearest: true,
                    axis: 'y',
                    followLayout: true,
                    radius: () => `${shapeRadius(element.dataset.radius, 8, 20, 1)}px`,
                  })
                : undefined;
              element
                .querySelector<HTMLTextAreaElement>('[data-auq-field=free]')
                ?.focus({ preventScroll: true });
              if (restoreKeyboardFocus) rows()[0]?.focus({ preventScroll: true });
              restoreKeyboardFocus = false;
            }
            fieldSize();
            measure();
          };
          const unbindKeyboard = bindKeyboard(element, {
            send,
            activeIndex: () => hover?.active ?? null,
            markFocusRestore: () => {
              if (element.querySelector('.auq-options')?.contains(document.activeElement))
                restoreKeyboardFocus = true;
            },
          });
          const observer = new MutationObserver(sync);
          const pointerdown = (event: PointerEvent) => {
            element.dataset.auqPointer = 'true';
            const row =
              event.target instanceof Element
                ? event.target.closest<HTMLElement>('[data-auq-option]')
                : null;
            row?.focus({ preventScroll: true });
          };
          observer.observe(element, {
            attributes: true,
            attributeFilter: ['data-auq-step'],
            childList: true,
            subtree: true,
          });
          const resize = new ResizeObserver(measure);
          const body = element.querySelector('[data-auq-body]');
          if (body) resize.observe(body);
          element.addEventListener('input', fieldSize);
          element.addEventListener('pointerdown', pointerdown);
          sync();
          return () => {
            unbindKeyboard();
            observer.disconnect();
            resize.disconnect();
            hover?.dispose();
            animation?.stop();
            element.removeEventListener('input', fieldSize);
            element.removeEventListener('pointerdown', pointerdown);
          };
        }),
        (cleanup) => Effect.sync(cleanup),
      ),
    ),
});
