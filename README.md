# <img src="public/favicon.svg" width="28" height="28" alt="Listeenoop icon" style="vertical-align: middle;"> Listenoop

A browser-based music player for MP3 files that automatically breaks each track into **clips** (segments separated by silence) so you can practice, loop, and repeat specific parts.

![GitHub language](https://img.shields.io/badge/react-19-blue) ![typescript](https://img.shields.io/badge/typescript-6-blue) ![vite](https://img.shields.io/badge/vite-8-purple)

## Features

- **MP3 playback** with waveform visualization
- **Automatic clip detection** — the player splits each track at silent gaps and highlights the resulting clips on the waveform
- **Clip looping** — click any clip to play it, repeating it up to 20 times
- **Merge control** — combine neighboring clips into one with a single slider
- **Two waveform views** — a stacked multi-row overview or a single horizontally-scrollable row
- **Configurable skip** — jump forward/back by 5–60 seconds
- **Drag-and-drop and file picker** — load multiple MP3 files at once
- **Live frequency visualizer** ("dancing lines")
- **Settings persist** automatically in your browser's local storage

---

## Getting started

### Running locally (development)

```bash
npm install
npm run dev
```

This starts the Vite dev server (default: <http://localhost:5173>). Open that URL in your browser.

### Building for production

```bash
npm run build        # compiles TypeScript, builds to docs/ (VITE_OUT_DIR)
npm run build:local  # builds and copies the output into the deploy folder set by VITE_BASE_URL
npm run preview      # serves the built app to verify it
```

### Project scripts

| Command              | Purpose                                             |
| -------------------- | --------------------------------------------------- |
| `npm run dev`        | Start the development server with hot reload        |
| `npm run build`      | Type-check and build the production bundle          |
| `npm run build:local`| Build and copy output into the configured folder    |
| `npm run preview`    | Preview the production build                        |
| `npm run serve`      | Alias for `preview`                                 |
| `npm run test`       | Run the unit test suite (Vitest)                    |
| `npm run lint`       | Lint the codebase (Oxlint)                          |

---

## Loading music

1. Click the **playlist** button in the top-left corner to open the playlist panel.
2. Click the **`+`** button and select one or more MP3 files, **or**
3. Simply **drag and drop** MP3 files anywhere onto the app window.

Notes:

- Only **MP3** files are supported. Non-MP3 files are skipped and a notice tells you how many were ignored.
- A built-in sample track (`01A.mp3`) is loaded on startup so you can explore the player immediately.
- All files are processed locally in your browser — nothing is uploaded.

---

## The player

### Now Playing

The large card shows the current track's title, artist, and audio metadata (channels, sample rate, bitrate). The music-note icon animates while audio is playing.

### Playback controls

The bottom button row provides:

| Control            | Action                                                       |
| ------------------ | ------------------------------------------------------------ |
| **Back** (large)   | Skip backward by the configured interval (default 10s)        |
| **Previous**       | Jump to the previous track, or restart the current one if more than 3 seconds have played |
| **Play / Pause**   | The main play/pause toggle (shows a loading state while decoding) |
| **Next**           | Jump to the next track (wraps to the start of the playlist)   |
| **Forward** (large)| Skip forward by the configured interval (default 10s)        |

The large skip buttons display the current skip interval (e.g. `10`), and all controls are disabled until a track has loaded.

### Waveform

The waveform is drawn from the decoded audio and shows:

- the wave shape in gray, with **played** audio highlighted in blue,
- the **playhead cursor** with a floating time label,
- **clip regions** — highlighted rectangles over each detected clip, with a numbered badge and duration label above each one.

#### Seeking

- **Click anywhere on the waveform** to jump the playhead to that position.

#### Two views

- **Stacked** — each ~10-second group of clips is shown as its own row so you can see the whole track at once. The container scrolls to keep the playhead in view while playing.
- **Single row** — one horizontally-scrollable row you can **pan** (drag), **wheel** horizontally, or **resize**; it automatically follows the playhead during playback (auto-follow pauses for 1.5s after you manually navigate).

Switch views in **Settings → Waveform view**.

---

## Clips & looping

This is the heart of Listeenoop. The player detects quiet gaps in the audio and splits the track into **clips** — ideal for practice segments, exercise cues, or listening to specific parts on repeat.

### Playing a clip on repeat

1. Make sure **playback is stopped** (the clip toolbar is disabled while playing).
2. Set how many times the clip should play with the **Repeat** stepper (`1`–`20`).
3. **Click a clip** on the waveform. It plays from that clip's start to its end, then restarts until the repeat count is reached.

- Clicking anywhere on the waveform (outside a clip) seeks the playhead. Clicking an empty clip area during playback just stops it.
- While a clip is looping, the toolbar (merge slider + repeat stepper) is locked; pause/stop to change settings.

### Merging clips

Suppose two neighboring clips are really one phrase. Use the **merge slider**:

- Drag the slider thumb, or use the **`–` / `+`** steppers on either side, to choose the *maximum silent gap* that should be treated as a single clip.
- A floating bubble shows the resulting clip count (e.g. `4 clips`).
- The slider snaps to the actually-detected gap lengths in your track, so you always end up with a real (not arbitrary) grouping.

### Fine-tuning with swipes

On the **active clip**, two arrows may appear above the label:

- **Swipe up** — split a merged clip back into its individual sub-clips (available when the active clip contains multiple children).
- **Swipe down** — merge the active clip with its neighbor (available when there is a neighbor).

Swiping updates the merge threshold automatically and keeps the active clip in view.

---

## Settings

Open the **Settings** panel with the gear button in the top-right. Every option is saved to local storage automatically and restored next time you open the app.

| Setting                | Options                     | Default | Description |
| ---------------------- | --------------------------- | ------- | ----------- |
| **Waveform view**      | Stacked / Single row        | Stacked | How clips and audio are displayed |
| **Skip forward / back**| 5, 10, 15, 20, 30s (or 1–60s custom) | 10s | Interval used by the large skip buttons |
| **Silence threshold**  | 0.005 / 0.01 / 0.02 / 0.05 (or 0.001–0.1) | 0.01 | How quiet a block must be to count as silence. **Lower** values only treat very quiet parts as silence |
| **Analysis detail**    | 64 / 128 / 256 / 512 (or 32–1024) blocks | 512 | Audio chunk size used for detection. **Smaller** = more precise splits, **larger** = faster processing |
| **Minimum gap between clips** | 0.01 / 0.02 / 0.05 / 0.1 / 0.2s (or 0.001–0.5s) | 0.05s | Shortest silence that splits two clips apart. **Lower** = more granular splits |

> Tip: after changing **silence threshold**, **analysis detail**, or **minimum gap**, a new track must be (re)loaded for the splits to recompute.

---

## Playlist

- Open the playlist from the **playlist** button (top-left).
- Click a row to play that track (the current track is highlighted).
- Remove a track with the **✕** button on its row.
- The track count is shown in the panel header.

---

## Notes & troubleshooting

- **MP3 only** — non-MP3 files are silently skipped (a notice shows the count).
- **Data stays on your device** — music and settings are processed and stored locally in the browser. Clearing site data removes your settings and uploaded files.
- **iOS / iPhone** — WebKit's audio-routing limitation means the live frequency visualizer has no live analyser data; as a fallback the dancing lines are derived from the decoded waveform around the playhead, so they still animate.
- **Audio playback** may require a user gesture (browser autoplay policy) — tap Play to start.

---

## Support

Report issues or give feedback at the project's issue tracker.