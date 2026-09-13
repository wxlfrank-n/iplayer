/**
 * Formats a duration in seconds to "M:SS" format.
 * Used for display in progress bars and duration labels.
 *
 * @param seconds - Duration in seconds
 * @returns Formatted string like "1:23" or "0:45"
 * @example
 *   formatTime(83) => "1:23"
 *   formatTime(5) => "0:05"
 */
export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Formats a duration with fractional second precision.
 * Used for detailed time displays in clip markers and precise seeking.
 *
 * @param seconds - Duration in seconds
 * @param digits - Number of decimal places to show (default: 2)
 * @returns Formatted string like "1:23.45" or "0:05.12"
 * @example
 *   formatTimePrecise(83.456, 2) => "1:23.45"
 *   formatTimePrecise(5.1) => "0:05.10"
 */
export function formatTimePrecise(seconds: number, digits: number = 2): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const frac = Math.round((seconds - Math.floor(seconds)) * 10 ** digits);
  const f = frac.toString().padStart(digits, "0");
  return `${m}:${s.toString().padStart(2, "0")}.${f}`;
}
