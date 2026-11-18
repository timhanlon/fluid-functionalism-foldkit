import { Effect, Queue, Stream } from 'effect';
import { hasModifier, matchesShortcut, parseShortcut } from './shortcuts';

export interface ShortcutOptions {
  /** The same id passed to CommandDialog.init; locates its nonportalled view anchor. */
  readonly id?: string;
  /** Explicit opening scope. An already open peer answers regardless of scope. */
  readonly inScope?: () => boolean;
}
interface Peer {
  readonly combo: string;
  readonly isOpen: () => boolean;
  readonly inScope: () => boolean;
}
const peers: Peer[] = [];

/** Bind in a parent Subscription. An open peer answers first, else the last
 * mounted eligible peer. Without an explicit scope, a palette leaves keys in
 * a keyboard scope outside its view anchor alone. A bare key stays out of fields.
 * The callback form retains the existing explicit opening-scope contract. */
export function shortcut(
  combo: string,
  options: ShortcutOptions | (() => boolean) = {},
): Stream.Stream<KeyboardEvent> {
  const parsed = parseShortcut(combo);
  if (parsed.key === '') return Stream.empty;
  const config = typeof options === 'function' ? { inScope: options } : options;
  return Stream.callback<KeyboardEvent>((queue) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        const anchor = () =>
          config.id ? document.getElementById(`${config.id}-shortcut-anchor`) : null;
        const entry: Peer = {
          combo: JSON.stringify(parsed),
          isOpen: () => anchor()?.dataset.commandMenuOpen === 'true',
          inScope: () => {
            if (config.inScope) return config.inScope();
            const scope = document.activeElement?.closest('[data-keyboard-scope]');
            return !scope || !!(anchor() && scope.contains(anchor()));
          },
        };
        peers.push(entry);
        const listener = (event: KeyboardEvent) => {
          if (event.repeat || event.defaultPrevented || !matchesShortcut(event, parsed)) return;
          const target = event.target;
          if (
            !hasModifier(parsed) &&
            target instanceof HTMLElement &&
            (target.closest('input,textarea,select') || target.isContentEditable)
          )
            return;
          const matching = peers.filter((peer) => peer.combo === entry.combo);
          const answer =
            matching.find((peer) => peer.isOpen()) ??
            matching
              .slice()
              .reverse()
              .find((peer) => peer.inScope());
          if (answer !== entry) return;
          // Must happen before a downstream Stream stage: the native action
          // (such as printing) has already run by the time it receives the event.
          event.preventDefault();
          Queue.offerUnsafe(queue, event);
        };
        document.addEventListener('keydown', listener, true);
        return () => {
          document.removeEventListener('keydown', listener, true);
          const index = peers.indexOf(entry);
          if (index !== -1) peers.splice(index, 1);
        };
      }),
      (dispose) => Effect.sync(dispose),
    ),
  );
}
