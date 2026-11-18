import { Stream, type Effect, type Schema, type Scope } from 'effect';
import type { Mount } from 'foldkit';

type RuntimeInput = Readonly<{
  element: Element;
  viewStateChanges: Stream.Stream<Mount.ViewState>;
}>;

// Foldkit's named constructors require a result Message as of 0.171.
// Generic visual effects have no parent Message to emit. Build a lifecycle
// action whose stream cannot emit and let Foldkit own its scope and cleanup.
export function defineSilentMount<const Name extends string>(
  name: Name,
  config: { execute: (input: RuntimeInput) => Effect.Effect<never, never, Scope.Scope> },
) {
  const create = (): Mount.MountAction<never> => ({
    name,
    f: (element, viewStateChanges) =>
      Stream.scoped(Stream.fromEffect(config.execute({ element, viewStateChanges }))),
  });
  return Object.defineProperty(create, 'name', { value: name });
}

export function defineSilentMountWithArgs<
  const Name extends string,
  const Fields extends Schema.Struct.Fields,
>(
  name: Name,
  config: {
    args: Fields;
    execute: (
      input: RuntimeInput & Schema.Struct.Type<Fields>,
    ) => Effect.Effect<never, never, Scope.Scope>;
  },
) {
  const create = (args: Schema.Struct.Type<Fields>): Mount.MountAction<never> => ({
    name,
    args,
    f: (element, viewStateChanges) =>
      Stream.scoped(Stream.fromEffect(config.execute({ ...args, element, viewStateChanges }))),
  });
  return Object.defineProperty(create, 'name', { value: name });
}
