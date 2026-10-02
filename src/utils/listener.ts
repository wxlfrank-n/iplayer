/**
 * Event listener registration helpers.
 *
 * Every helper here returns a cleanup function, so callers can hand it straight
 * to `useEffect` (or call it imperatively) instead of repeating the matching
 * `removeEventListener` call — which is where option/capture mismatches and
 * leaked listeners come from.
 *
 * These are plain functions with no React dependency; the components and hooks
 * that use them keep their own JSX and logic.
 */

export type ListenerTarget = EventTarget | null | undefined;
export type ListenerOptions = boolean | AddEventListenerOptions;

/** A single listener as accepted by {@link addListeners}. */
export type ListenerSpec = readonly [
  type: string,
  handler: (event: never) => void,
  options?: ListenerOptions,
];

/**
 * Registers one listener and returns its removal.
 *
 * A missing target registers nothing, so callers can pass a possibly-null ref
 * without guarding first.
 */
export function addListener<E extends Event = Event>(
  target: ListenerTarget,
  type: string,
  handler: (event: E) => void,
  options?: ListenerOptions,
): () => void {
  if (!target) return () => {};
  const listener = handler as EventListener;
  target.addEventListener(type, listener, options);
  return () => target.removeEventListener(type, listener, options);
}

/**
 * Registers several listeners on one target and returns a single cleanup that
 * removes all of them. Preferable to stacking `addListener` calls when one
 * effect owns a whole set of handlers for the same target.
 */
export function addListeners(
  target: ListenerTarget,
  specs: readonly ListenerSpec[],
): () => void {
  const removals: Array<() => void> = [];

  if (target) {
    for (const [type, handler, options] of specs) {
      const listener = handler as EventListener;
      target.addEventListener(type, listener, options);
      removals.push(() => target.removeEventListener(type, listener, options));
    }
  }

  return () => removals.forEach(remove => remove());
}

/**
 * True when the event landed outside `container`.
 *
 * A missing container counts as outside, matching the usual
 * `!container?.contains(event.target)` guard: if the element is gone there is
 * nothing left to interact with, so the caller should dismiss.
 */
export function isOutside(container: Node | null, event: Event): boolean {
  const node = event.target;
  if (!container || !(node instanceof Node)) return true;
  return !container.contains(node);
}

/** True for the Escape key, the standard dismiss gesture. */
export function isEscapeKey(event: KeyboardEvent): boolean {
  return event.key === 'Escape';
}

/**
 * Dismisses an overlay, menu or dropdown: calls `onDismiss` on a pointer press
 * outside `container`, or on Escape. Runs until the returned cleanup is called.
 *
 * `container` is captured when this is called, so call it from an effect that
 * runs while the element is mounted.
 */
export function onOutsideDismiss(
  container: Node | null,
  onDismiss: () => void,
  target: ListenerTarget = document,
): () => void {
  return addListeners(target, [
    [
      'pointerdown',
      event => {
        if (isOutside(container, event as Event)) onDismiss();
      },
    ],
    [
      'keydown',
      event => {
        if (isEscapeKey(event as KeyboardEvent)) onDismiss();
      },
    ],
  ]);
}
