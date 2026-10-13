# Listenoop — Specification Index

> This file used to contain a hand-written feature list that drifted from the
> code (it described waveform zoom, region selection, and old detection
> settings that do not exist). It is now an index. **Authoritative sources:**

- **`ANDROID_SPEC.md`** — full behavior specification: domain models, config
  (every setting, default, range, preset), audio engine + clip-loop state
  machine, clip-detection algorithm, merge/split semantics, waveform
  rendering, row/stacked viewports, gestures, toolbar, playlist, themes, i18n,
  platform integration, testing matrix, constant table, and source map.
- **Vitest suites** (`src/**/*.test.ts(x)`, 22 files) — executable behavior
  locks for detection math, scope semantics, viewport/pan/gesture thresholds,
  toolbar/pinch/clip-play wiring, and locale parity.
- **Playwright e2e** (`e2e/`) — real-browser decode → clips → canvas wiring.

## Feature summary (verified against code)

- Audio playback (MP3, WAV, OGG, M4A, FLAC, WebM) with waveform visualization.
- Automatic silence-based clip detection (block size, silence ratio capped at
  the detector ceiling of 0.01, minimum clip length, minimum split piece).
- Clip looping with repeat count (1–20); merge slider + swipe/pinch
  split-merge editing in clip/global scopes.
- Two waveform views: single horizontally-panning row (default) and stacked
  paged rows; 80%-follow viewport, 3x render buffer, edge-pinned cursor.
- Playlist import/remove, persisted settings, 10 themes, 3 locales (en/zh/no,
  default `no`), toast notices, Media Session lock-screen integration.

## What is intentionally out of scope

Waveform zoom, region selection, streaming, and cloud sync do not exist in any
implementation and are not planned (see `ANDROID_SPEC.md` §1).
