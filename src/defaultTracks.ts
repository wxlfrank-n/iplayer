/**
 * Default sample tracks included with the app.
 * These are loaded on startup to give users something to listen to immediately.
 *
 * Format: Array of { filename, title } objects that are converted to Track objects
 * in useAudioPlayer.ts by constructing the full URL path.
 */
export const DEFAULT_TRACKS = [{ filename: "01A.mp3", title: "01A" }] as const;
