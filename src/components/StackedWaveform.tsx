/**
 * Stacked waveform view - renders each clip row as a separate row of bars.
 *
 * Features:
 * - Groups silence-split clips into rows of ~STACK_ROW_TARGET_SECS
 * - Auto-scrolls the enclosing progress container to keep the playhead visible
 * - rAF-updated cursor + time label per row
 * - Reports manual scrolling (so the horizontal view can park auto-follow)
 * - Clip click/range playback via the shared Clip overlay
 */

import { memo, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Clip } from "./Clip";
import { ClipLabel } from "./ClipLabel";
import { WaveformCursor } from "./WaveformCursor";
import { WaveformBars } from "./Waveform";
import { type WaveformData } from "../types";
import type { Clip as ClipData } from "../utils/clips";

const STACK_ROW_TARGET_SECS = 10;
const VB_W = 1000;
const VB_H = 200;
const PAD = 4;

const formatTime = (sec: number) => {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  const h = Math.floor(m / 60);
  if (h > 0)
    return `${h}:${(m % 60).toString().padStart(2, "0")}:${r.toString().padStart(2, "0")}`;
  return `${m}:${r.toString().padStart(2, "0")}`;
};

interface StackedWaveformProps {
  waveform: WaveformData;
  displayClips: ClipData[];
  currentTime: number;
  activeClip: number;
  repetitions: number;
  onSeek: (time: number) => void;
  onActiveClipChange: (idx: number) => void;
  onPlayRange: (
    start: number,
    end: number,
    repetitions: number,
    onComplete?: () => void,
  ) => void;
  onClipPlayActiveChange?: (active: boolean) => void;
  getCurrentTime?: () => number;
  onScrollChange?: (scrolling: boolean) => void;
}

type StackedRow = {
  start: number;
  end: number;
  clips: { clip: ClipData; idx: number }[];
};

export const StackedWaveform = memo(function StackedWaveform({
  waveform,
  displayClips,
  currentTime,
  activeClip,
  repetitions,
  onSeek,
  onActiveClipChange,
  onPlayRange,
  onClipPlayActiveChange,
  getCurrentTime,
  onScrollChange,
}: StackedWaveformProps) {
  const innerH = VB_H - PAD * 2;

  const stackedRows = useMemo<StackedRow[]>(() => {
    const rows: StackedRow[] = [];
    let cur: StackedRow | null = null;
    displayClips.forEach((s, idx) => {
      const dur = s.end - s.start;
      if (!cur || dur + (cur.end - cur.start) <= STACK_ROW_TARGET_SECS) {
        if (!cur) cur = { start: s.start, end: s.end, clips: [] };
        cur.end = s.end;
        cur.clips.push({ clip: s, idx });
      } else {
        rows.push(cur);
        cur = { start: s.start, end: s.end, clips: [{ clip: s, idx }] };
      }
    });
    if (cur) rows.push(cur);
    return rows;
  }, [displayClips]);

  const stackedContainerRef = useRef<HTMLDivElement>(null);
  const stackedCursorRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const stackedTimeRefs = useRef<Array<HTMLSpanElement | null>>([]);

  // Scroll state. `scrolling` is reported up (shared with the horizontal view's
  // follow behavior); auto-scroll marks `autoScrollPendingRef` so the listener
  // ignores programmatic scrolls from the playhead-follow effect.
  const [scrolling, setScrolling] = useState(false);
  const scrollTimeoutRef = useRef<number | undefined>(undefined);
  const autoScrollPendingRef = useRef(false);
  useEffect(() => {
    onScrollChange?.(scrolling);
  }, [scrolling, onScrollChange]);

  const activeRowIdx = stackedRows.findIndex(
    (r) => currentTime >= r.start && currentTime <= r.end,
  );
  useEffect(() => {
    const scrollEl =
      stackedContainerRef.current?.closest(".progress-container") ?? null;
    if (!scrollEl || activeRowIdx < 0) return;
    const container = stackedContainerRef.current;
    const child = container?.children[activeRowIdx] as HTMLElement | undefined;
    if (!child) return;
    const cTop = scrollEl.getBoundingClientRect().top;
    const cBot = scrollEl.getBoundingClientRect().bottom;
    const rTop = child.getBoundingClientRect().top;
    const rBot = child.getBoundingClientRect().bottom;
    if (rTop < cTop) {
      autoScrollPendingRef.current = true;
      scrollEl.scrollTop += rTop - cTop;
    } else if (rBot > cBot) {
      autoScrollPendingRef.current = true;
      scrollEl.scrollTop += rBot - cBot;
    }
  }, [activeRowIdx]);

  // Cursor rAF.
  useEffect(() => {
    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (!getCurrentTime) return;
      const t = getCurrentTime();
      for (let r = 0; r < stackedRows.length; r++) {
        const el = stackedCursorRefs.current[r];
        const timeLabel = stackedTimeRefs.current[r];
        if (!el) continue;
        const rs = stackedRows[r].start;
        const rl = stackedRows[r].end - rs;
        if (rl > 0 && t >= rs && t <= stackedRows[r].end) {
          el.style.display = "block";
          el.style.left = `${(((t - rs) / rl) * 100).toFixed(3)}%`;
          if (timeLabel) {
            timeLabel.style.display = "block";
            timeLabel.textContent = formatTime(t);
            timeLabel.style.left = `${Math.max(4, Math.min(96, ((t - rs) / rl) * 100)).toFixed(2)}%`;
          }
        } else {
          el.style.display = "none";
          if (timeLabel) timeLabel.style.display = "none";
        }
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [getCurrentTime, stackedRows]);

  // Distinguish manual scrolling from auto-follow so the playhead keeps tracking.
  useEffect(() => {
    const el = stackedContainerRef.current?.closest(".progress-container");
    if (!el) return;
    const onScroll = () => {
      if (autoScrollPendingRef.current) {
        autoScrollPendingRef.current = false;
        return;
      }
      setScrolling(true);
      window.clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = window.setTimeout(
        () => setScrolling(false),
        1500,
      );
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  const [clipPlayActive, setClipPlayActive] = useState(false);
  useEffect(() => {
    onClipPlayActiveChange?.(clipPlayActive);
  }, [clipPlayActive, onClipPlayActiveChange]);

  const stackedPlayClip = useCallback(
    (start: number, end: number, reps: number) => {
      setClipPlayActive(true);
      onPlayRange(start, end, reps, () => setClipPlayActive(false));
    },
    [onPlayRange],
  );

  return (
    <div className="stacked-waveform" ref={stackedContainerRef}>
      {stackedRows.map((row, r) => {
        const rowStart = row.start;
        const rowLen = Math.max(0, row.end - row.start);
        if (rowLen <= 0) return null;
        const rowFrac = Math.max(
          0,
          Math.min(1, (currentTime - rowStart) / rowLen),
        );
        return (
          <div
            key={r}
            className="stacked-waveform__row"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const f = Math.max(
                0,
                Math.min(1, (e.clientX - rect.left) / rect.width),
              );
              onSeek(rowStart + f * rowLen);
              onActiveClipChange(-1);
            }}
          >
            <svg
              className="stacked-waveform__svg"
              viewBox={`0 0 ${VB_W} ${VB_H}`}
              preserveAspectRatio="none"
            >
              <WaveformBars
                data={waveform.data}
                sampleRate={waveform.sampleRate}
                window={{
                  windowStartSec: rowStart,
                  windowLen: rowLen,
                  innerH,
                  vbW: VB_W,
                  vbH: VB_H,
                }}
                fracPlayed={rowFrac}
                idPrefix={`stack-${r}`}
              />
              <Clip
                clips={displayClips}
                window={{
                  windowStartSec: rowStart,
                  windowLen: rowLen,
                  innerH,
                  vbW: VB_W,
                  vbH: VB_H,
                }}
                onPlayRange={stackedPlayClip}
                repetitions={repetitions}
                activeClip={activeClip}
                onActivate={(idx) => {
                  onActiveClipChange(idx);
                }}
              />
            </svg>
            <WaveformCursor
              view="stacked"
              left={rowFrac}
              time={formatTime(currentTime)}
              cursorRef={(el) => {
                stackedCursorRefs.current[r] = el;
              }}
              timeRef={(el) => {
                stackedTimeRefs.current[r] = el;
              }}
            />
            {row.clips.map(({ clip: s, idx }) => {
              const center =
                ((s.start + (s.end - s.start) / 2 - rowStart) / rowLen) * 100;
              return (
                <ClipLabel
                  key={`lbl-${idx}`}
                  index={idx}
                  duration={s.end - s.start}
                  left={center}
                  active={idx === activeClip}
                  minLeft={5}
                  maxLeft={95}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
});