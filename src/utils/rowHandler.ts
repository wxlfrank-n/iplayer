export function calculateWheelChange(e: WheelEvent, listenElement: HTMLElement | null, topElement: HTMLElement, windowLen: number) {
    const target = e.target as Node;
    if (!listenElement?.contains(target)) {
        return;
      }
      e.preventDefault();
      const delta = Math.abs(e.deltaX) >
        Math.abs(e.deltaY)
        ? e.deltaX
        : e.deltaY;
      const scale = e.deltaMode === 1
        ? 16
        : e.deltaMode === 2
          ? 100
          : 1;
      return Math.max(-2, Math.min(2, ((delta * scale) / (topElement.clientWidth || 1)) * windowLen));
}