/** Touch pointers must stay available to the scroll container. */
export function shouldCaptureClipPointer(pointerType: string): boolean {
  return pointerType !== "touch";
}
