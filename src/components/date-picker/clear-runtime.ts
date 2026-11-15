import { Effect, Queue, Stream } from 'effect';
import { Mount } from 'foldkit';
import { animate, type AnimationPlaybackControls } from 'motion';
import { Message } from './state';
export const ClearMounted = Mount.defineStream('DatePicker.ClearPresence', {
  messages: [Message.ClearExited, Message.Noop],
  execute: ({ element }) =>
    Stream.callback<typeof Message.ClearExited.Type>((queue) =>
      Effect.acquireRelease(
        Effect.sync(() =>
          element instanceof HTMLElement
            ? mountClearButton(element, (generation) =>
                Queue.offerUnsafe(queue, Message.ClearExited({ generation })),
              )
            : () => {},
        ),
        (cleanup) => Effect.sync(cleanup),
      ),
    ),
});
/** The actual button remains in Foldkit's tree through its exit, preserving
 * its layout and focus until the model acknowledges the matching generation. */
export function mountClearButton(
  element: HTMLElement,
  exited: (generation: number) => void,
): () => void {
  let previous = '',
    motion: AnimationPlaybackControls | undefined,
    timer: ReturnType<typeof setTimeout> | undefined;
  if (element.dataset.clearState === 'hidden') element.style.opacity = '0';
  const sync = () => {
    const state = element.dataset.clearState ?? 'initial',
      generation = Number(element.dataset.clearGeneration),
      key = `${state}:${generation}`;
    if (key === previous) return;
    const initial = previous === '' || previous.startsWith('initial:');
    previous = key;
    const opacity =
      initial && state === 'visible' && generation > 0
        ? 0
        : parseFloat(getComputedStyle(element).opacity) || 0;
    motion?.stop();
    clearTimeout(timer);
    if (state === 'initial' || (initial && state === 'visible' && generation === 0)) {
      element.style.opacity = '1';
      return;
    }
    if (state === 'hidden') {
      element.style.opacity = '0';
      return;
    }
    const leaving = state === 'leaving';
    let done = false;
    const complete = () => {
      if (done) return;
      done = true;
      if (leaving && previous === key) exited(generation);
    };
    motion = animate(
      element,
      { opacity: [opacity, leaving ? 0 : 1] },
      leaving
        ? { duration: 0.06, onComplete: complete }
        : { type: 'spring', duration: 0.08, bounce: 0 },
    );
    if (leaving) timer = setTimeout(complete, 160);
  };
  const observer = new MutationObserver(sync);
  observer.observe(element, {
    attributes: true,
    attributeFilter: ['data-clear-state', 'data-clear-generation'],
  });
  sync();
  return () => {
    observer.disconnect();
    motion?.stop();
    clearTimeout(timer);
  };
}
