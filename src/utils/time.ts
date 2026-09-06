export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatTimePrecise(seconds: number, digits: number = 2): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const frac = Math.round((seconds - Math.floor(seconds)) * 10 ** digits);
  const f = frac.toString().padStart(digits, "0");
  return `${m}:${s.toString().padStart(2, "0")}.${f}`;
}