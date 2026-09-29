export function getCssVar(
  name: string,
  element: Element = document.documentElement,
  fallback = "",
): string {
  return (
    getComputedStyle(element)
      .getPropertyValue(name)
      .trim() || fallback
  );
}