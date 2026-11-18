import { Animation } from '@foldkit/ui';
import { Effect, Queue, Schema, Stream } from 'effect';
import { Mount } from 'foldkit';
import { animate, type AnimationPlaybackControls } from 'motion';
import { spring } from '../motion';
import { Message } from './state';

const scrollKeys = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ']);
const maxTop = (viewport: HTMLElement) => viewport.scrollHeight - viewport.clientHeight;

/** Native geometry and observer ownership stay in this scoped Mount, never in Model. */
export function mountScroller(root: HTMLElement, send: (atEnd: boolean) => void): () => void {
  const owns = (element: Element) => element.closest('[data-message-scroller]') === root;
  const viewport = [...root.querySelectorAll<HTMLElement>('[data-ms-viewport]')].find(owns);
  const spacer = [...root.querySelectorAll<HTMLElement>('[data-ms-spacer]')].find(owns);
  if (!viewport || !spacer) return () => {};
  let content: HTMLElement | undefined;
  let anchor: HTMLElement | undefined;
  let known = new Set<HTMLElement>();
  let follow = true,
    writtenTop = -1,
    atEnd = true,
    disposed = false;
  let glide: AnimationPlaybackControls | undefined;
  let generation = 0;
  let request = root.dataset.msRequest;
  const writeTop = (top: number) => {
    viewport.scrollTop = top;
    writtenTop = viewport.scrollTop;
  };
  const syncAtEnd = () => {
    const next = maxTop(viewport) - viewport.scrollTop <= 24;
    if (next !== atEnd) {
      atEnd = next;
      send(next);
    }
  };
  const sizeSpacer = () => {
    let height = 0;
    if (anchor && content?.contains(anchor)) {
      let anchorTop = 0;
      let node: HTMLElement | null = anchor;
      while (node && node !== viewport) {
        anchorTop += node.offsetTop;
        node = node.offsetParent as HTMLElement | null;
      }
      const bottom = parseFloat(getComputedStyle(viewport).paddingBottom) || 0;
      height = Math.max(
        0,
        anchorTop -
          Number(root.dataset.msPeek ?? 16) +
          viewport.clientHeight -
          (content.offsetTop + content.offsetHeight + bottom),
      );
    }
    const value = `${height}px`;
    if (spacer.style.height !== value) spacer.style.height = value;
  };
  const stop = () => {
    generation++;
    glide?.stop();
    glide = undefined;
  };
  const glideToEnd = () => {
    stop();
    follow = true;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      writeTop(maxTop(viewport));
      syncAtEnd();
      return;
    }
    const start = viewport.scrollTop,
      version = generation;
    glide = animate(0, 1, {
      ...spring.slow,
      bounce: 0,
      onUpdate: (progress) => {
        if (!disposed && version === generation)
          writeTop(start + (maxTop(viewport) - start) * progress);
      },
      onComplete: () => {
        if (disposed || version !== generation) return;
        glide = undefined;
        writeTop(maxTop(viewport));
        syncAtEnd();
      },
    });
  };
  const resize = () => {
    if (disposed) return;
    sizeSpacer();
    if (root.dataset.msAutoScroll !== 'false' && follow && !glide) writeTop(maxTop(viewport));
    syncAtEnd();
  };
  const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(resize);
  const scan = (initial = false) => {
    const next = [...viewport.querySelectorAll<HTMLElement>('[data-ms-content]')].find(owns);
    if (content !== next) {
      if (content) observer?.unobserve(content);
      content = next;
      if (content) observer?.observe(content);
    }
    const anchors = new Set(
      content
        ? [...content.querySelectorAll<HTMLElement>('[data-ms-anchor="true"]')].filter(owns)
        : [],
    );
    if (anchor && !anchors.has(anchor)) {
      anchor = undefined;
      spacer.style.height = '0px';
    }
    const arrivals = [...anchors].filter((row) => !known.has(row));
    known = anchors;
    if (!initial && arrivals.length) {
      anchor = arrivals.at(-1);
      sizeSpacer();
      glideToEnd();
    }
  };
  const mutations = new MutationObserver(() => scan());
  scan(true);
  observer?.observe(viewport);
  mutations.observe(viewport, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-ms-anchor'],
  });
  const requests = new MutationObserver(() => {
    if (request === root.dataset.msRequest) return;
    request = root.dataset.msRequest;
    glideToEnd();
  });
  requests.observe(root, { attributes: true, attributeFilter: ['data-ms-request'] });
  const scroll = () => {
    if (Math.abs(viewport.scrollTop - writtenTop) < 1) return;
    follow = maxTop(viewport) - viewport.scrollTop <= 24;
    syncAtEnd();
  };
  const interrupt = () => {
    if (!glide) return;
    stop();
    follow = maxTop(viewport) - viewport.scrollTop <= 24;
    syncAtEnd();
  };
  const key = (event: KeyboardEvent) => {
    if (scrollKeys.has(event.key)) interrupt();
  };
  viewport.addEventListener('scroll', scroll);
  viewport.addEventListener('wheel', interrupt, { passive: true });
  viewport.addEventListener('touchstart', interrupt, { passive: true });
  viewport.addEventListener('pointerdown', interrupt);
  viewport.addEventListener('keydown', key);
  // Existing anchors are history. Opening always starts at the end, even with autoScroll=false.
  writeTop(maxTop(viewport));
  return () => {
    disposed = true;
    stop();
    observer?.disconnect();
    mutations.disconnect();
    requests.disconnect();
    viewport.removeEventListener('scroll', scroll);
    viewport.removeEventListener('wheel', interrupt);
    viewport.removeEventListener('touchstart', interrupt);
    viewport.removeEventListener('pointerdown', interrupt);
    viewport.removeEventListener('keydown', key);
  };
}
export const Mounted = Mount.defineStream('MessageScroller.Geometry', {
  args: { lifetime: Schema.Number },
  messages: [Message.AtEndChanged],
  execute: ({ element, lifetime }) =>
    Stream.callback<typeof Message.AtEndChanged.Type>((queue) =>
      Effect.acquireRelease(
        Effect.sync(() =>
          element instanceof HTMLElement
            ? mountScroller(element, (atEnd) =>
                Queue.offerUnsafe(queue, Message.AtEndChanged({ atEnd, lifetime })),
              )
            : () => {},
        ),
        (cleanup) => Effect.sync(cleanup),
      ),
    ),
});
export const ButtonMounted = Mount.defineStream('MessageScroller.ButtonMotion', {
  args: { lifetime: Schema.Number },
  messages: [Message.Animation],
  execute: ({ element, lifetime }) =>
    Stream.callback<typeof Message.Animation.Type>((queue) =>
      Effect.acquireRelease(
        Effect.sync(() => {
          if (!(element instanceof HTMLElement)) return () => {};
          const root = element;
          let phase = '',
            generation = -1,
            progress = root.dataset.msPhase === 'EnterStart' ? 0 : 1;
          let motion: AnimationPlaybackControls | undefined,
            disposed = false;
          const paint = () => {
            root.style.opacity = String(progress);
            root.style.transform = `translateY(${(1 - progress) * 4}px) scale(${0.9 + progress * 0.1})`;
          };
          const sync = () => {
            const next = root.dataset.msPhase ?? 'Idle',
              version = Number(root.dataset.msGeneration);
            if (next === phase && version === generation) return;
            phase = next;
            generation = version;
            motion?.stop();
            if (phase === 'EnterStart') {
              progress = 0;
              paint();
            }
            if (!['EnterAnimating', 'LeaveAnimating'].includes(phase)) return;
            motion = animate(progress, phase === 'EnterAnimating' ? 1 : 0, {
              ...(phase === 'EnterAnimating' ? spring.moderate : spring.moderate.exit),
              onUpdate: (value) => {
                progress = value;
                paint();
              },
              onComplete: () => {
                if (!disposed && generation === version)
                  Queue.offerUnsafe(
                    queue,
                    Message.Animation({
                      lifetime,
                      message: Animation.Message.EndedAnimation({ generation: version }),
                    }),
                  );
              },
            });
          };
          const observer = new MutationObserver(sync);
          observer.observe(root, {
            attributes: true,
            attributeFilter: ['data-ms-phase', 'data-ms-generation'],
          });
          paint();
          sync();
          return () => {
            disposed = true;
            motion?.stop();
            observer.disconnect();
          };
        }),
        (cleanup) => Effect.sync(cleanup),
      ),
    ),
});
