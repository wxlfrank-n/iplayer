/**
 * Lightweight dialog focus management.
 *
 * While `active`, focuses the returned container and keeps Tab focus inside it.
 * Pressing Escape calls `onEscape`. Used by the Settings and Playlist overlays
 * so keyboard users aren't stuck tabbing into the background app.
 */

import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

export function useFocusTrap<T extends HTMLElement = HTMLElement>(
  active: boolean,
  onEscape: () => void,
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    if (!node) return;

    node.focus();

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onEscape();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter(
        (el) => el.getClientRects().length > 0 || el === document.activeElement,
      );
      if (focusable.length === 0) {
        event.preventDefault();
        node.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKey, true);
    return () => document.removeEventListener("keydown", handleKey, true);
  }, [active, onEscape]);

  return ref;
}