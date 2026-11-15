import { Effect, Stream, Queue } from 'effect';
import { Slider as Primitive } from '@foldkit/ui';
import { Message } from './state';
import { nearestIndex } from './values';
import { Mount } from 'foldkit';
import { animate, type AnimationPlaybackControls } from 'motion';

export const Mounted = Mount.defineStream('Slider.Visuals', {
  messages: [Message.HoveredValue, Message.LeftHover],
  execute: ({ element }) =>
    Stream.callback<typeof Message.HoveredValue.Type | typeof Message.LeftHover.Type>((queue) =>
      Effect.acquireRelease(
        Effect.sync(() => {
          if (!(element instanceof HTMLElement)) return () => {};
          const root = element,
            track = root.querySelector<HTMLElement>('.ff-slider-track'),
            handle = root.querySelector<HTMLElement>('.ff-slider-handle'),
            highHandle = root.querySelector<HTMLElement>('.ff-slider-handle[data-thumb="1"]');
          if (!track || !handle) return () => {};
          const reduced = matchMedia('(prefers-reduced-motion: reduce)');
          let motion: AnimationPlaybackControls | undefined,
            fillMotion: AnimationPlaybackControls | undefined,
            highMotion: AnimationPlaybackControls | undefined,
            highFillMotion: AnimationPlaybackControls | undefined,
            initialized = false,
            compactWidth: number | undefined;
          const sync = () => {
            const compact = root.dataset.engine === 'compact';
            const min = Number(root.dataset.min),
              max = Number(root.dataset.max),
              value = Number(root.dataset.value);
            const fraction =
              max === min ? 0 : Math.max(0, Math.min(1, (value - min) / (max - min)));
            // ResizeObserver preserves fractional layout widths without ancestor transforms.
            const width = compact ? (compactWidth ?? track.clientWidth) : track.clientWidth;
            const x = compact
              ? fraction * (width - 20)
              : root.dataset.engine === 'scrubber'
                ? fraction * width - 9 + (value === min ? 17 : 0)
                : fraction * width + 11 - 24 * fraction;
            motion?.stop();
            fillMotion?.stop();
            highMotion?.stop();
            highFillMotion?.stop();
            const direct =
              !initialized ||
              reduced.matches ||
              (root.hasAttribute('data-dragging') && root.dataset.engine !== 'pips');
            if (highHandle) {
              const highFraction = Primitive.fractionOfValue(
                Number(root.dataset.highValue),
                min,
                max,
              );
              const highX = highFraction * (width - 20);
              if (direct) {
                highHandle.style.transform = `translateX(${highX}px)`;
                track.style.setProperty('--slider-high-fraction', String(highFraction));
              } else {
                highMotion = animate(
                  highHandle,
                  { x: highX },
                  { type: 'spring', duration: 0.16, bounce: 0 },
                );
                highFillMotion = animate(
                  track,
                  { '--slider-high-fraction': highFraction },
                  { type: 'spring', duration: 0.16, bounce: 0 },
                );
              }
            }
            if (direct) {
              handle.style.transform = `translateX(${x}px)`;
              track.style.setProperty('--slider-visual-fraction', String(fraction));
            } else {
              motion = animate(handle, { x }, { type: 'spring', duration: 0.16, bounce: 0 });
              fillMotion = animate(
                track,
                { '--slider-visual-fraction': fraction },
                { type: 'spring', duration: 0.16, bounce: 0 },
              );
            }
            initialized = true;
          };
          let hoverFrame = 0;
          const move = (event: PointerEvent) => {
            if (
              event.pointerType !== 'mouse' ||
              root.hasAttribute('data-disabled') ||
              root.hasAttribute('data-dragging')
            )
              return;
            cancelAnimationFrame(hoverFrame);
            hoverFrame = requestAnimationFrame(() => {
              const min = Number(root.dataset.min),
                max = Number(root.dataset.max),
                step = Number(root.dataset.step);
              const width = track.clientWidth,
                bounds = track.getBoundingClientRect();
              const scale = bounds.width / track.offsetWidth || 1;
              const x = Math.max(
                0,
                Math.min(width, (event.clientX - bounds.left) / scale - track.clientLeft),
              );
              const compact = root.dataset.engine === 'compact';
              const fraction = compact
                ? Math.max(0, Math.min(1, (x - 10) / Math.max(1, width - 20)))
                : x / Math.max(1, width);
              const steps = root.dataset.steps ? root.dataset.steps.split(',').map(Number) : [];
              const raw = min + fraction * (max - min);
              const value = steps.length
                ? steps[nearestIndex(raw, steps)]!
                : Primitive.snapAndClamp(raw, min, max, step);
              const snapped = Primitive.fractionOfValue(value, min, max);
              const cursor = compact ? 10 + snapped * (width - 20) : snapped * width;
              const edge = value === min ? 0 : value === max ? width : cursor;
              const current =
                Number(getComputedStyle(track).getPropertyValue('--slider-visual-fraction')) || 0;
              let handleX = compact
                ? new DOMMatrixReadOnly(getComputedStyle(handle).transform).m41 + 10
                : root.dataset.engine === 'pips'
                  ? current * width + (Number(root.dataset.value) === min ? 0 : 20 - 20 * current)
                  : current * width;
              if (highHandle) {
                const highX =
                  new DOMMatrixReadOnly(getComputedStyle(highHandle).transform).m41 + 10;
                if (Math.abs(cursor - highX) < Math.abs(cursor - handleX)) handleX = highX;
              }
              root.style.setProperty('--slider-hover-x', `${cursor}px`);
              root.style.setProperty('--slider-tooltip-x', `${track.offsetLeft + cursor}px`);
              root.style.setProperty('--slider-tooltip-y', `${track.offsetTop - 20}px`);
              root.style.setProperty('--slider-hover-left', `${Math.min(handleX, edge)}px`);
              root.style.setProperty('--slider-hover-width', `${Math.abs(edge - handleX)}px`);
              root.dataset.hoverDirection = cursor > handleX ? 'right' : 'left';
              Queue.offerUnsafe(queue, Message.HoveredValue({ value }));
            });
          };
          const leave = () => {
            cancelAnimationFrame(hoverFrame);
            Queue.offerUnsafe(queue, Message.LeftHover());
          };
          // A press ends the hover preview, and drag moves don't restart it:
          // after release it waits for the next move, as upstream's does.
          const press = () => leave();
          const hoverMove = (event: PointerEvent) => {
            if (root.hasAttribute('data-dragging') || event.buttons) return;
            move(event);
          };
          track.addEventListener('pointerenter', hoverMove);
          track.addEventListener('pointermove', hoverMove);
          track.addEventListener('pointerleave', leave);
          track.addEventListener('pointerdown', press);
          // A slider unmounted mid-hover (inside a closing popover) never saw
          // its pointerleave: a remount not under the pointer clears it.
          if (!track.matches(':hover')) Queue.offerUnsafe(queue, Message.LeftHover());
          const change = new MutationObserver(sync);
          change.observe(root, {
            attributes: true,
            attributeFilter: [
              'data-value',
              'data-high-value',
              'data-engine',
              'data-min',
              'data-max',
              'data-dragging',
            ],
          });
          const resize = new ResizeObserver(([entry]) => {
            if (entry) compactWidth = entry.contentRect.width;
            sync();
          });
          resize.observe(track);
          sync();
          return () => {
            motion?.stop();
            fillMotion?.stop();
            highMotion?.stop();
            highFillMotion?.stop();
            cancelAnimationFrame(hoverFrame);
            track.removeEventListener('pointerenter', hoverMove);
            track.removeEventListener('pointermove', hoverMove);
            track.removeEventListener('pointerleave', leave);
            track.removeEventListener('pointerdown', press);
            change.disconnect();
            resize.disconnect();
          };
        }),
        (dispose) => Effect.sync(dispose),
      ).pipe(Effect.andThen(Effect.never)),
    ),
});
