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

interface StackedWaveformProps {
  waveform: WaveformData;
  displayClips: ClipData[];
  currentTime: number;
  playing: boolean;
  activeClip: number;
  repetitions: number;
  onStopPlayback?: () => void;
  onSwipeClip?: (idx: number, direction: "up" | "down") => void;
  onSeek: (time: number) => void;
  onActiveClipChange: (idx: number) => void;
  onPlayRange: (
    start: number,
    end: number,
    repetitions: number,
    onComplete?: () => void,
  ) => void;
onClipPlayActiveChange?: (active: boolean) => void;
  getCurrentTime: () => number;
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
  playing,
  activeClip,
  repetitions,
  onStopPlayback,
  onSwipeClip,
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
      const dur = s.vEnd - s.vStart;
      if (!cur || dur + (cur.end - cur.start) <= STACK_ROW_TARGET_SECS) {
        if (!cur) cur = { start: s.vStart, end: s.vEnd, clips: [] };
        cur.end = s.vEnd;
        cur.clips.push({ clip: s, idx });
      } else {
        rows.push(cur);
        cur = { start: s.vStart, end: s.vEnd, clips: [{ clip: s, idx }] };
      }
    });
    if (cur) rows.push(cur);
    if (rows && rows.length > 0) {
      rows[0].start = 0; // first row always starts at 0
      rows[rows.length - 1].end = Math.max(rows[rows.length - 1].end, waveform.duration); // last row always ends at the waveform end
    }
    return rows;
  }, [displayClips]);

  const stackedContainerRef = useRef<HTMLDivElement>(null);

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
        const getPlayedPct = () => {
          return Math.max(
            0,
            Math.min(1, (getCurrentTime() - rowStart) / rowLen),
          );
        }
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
                fracPlayed={getPlayedPct()}
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
                playing={playing}
                onStopPlayback={onStopPlayback}
                activeClip={activeClip}
                onActivate={(idx) => {
                  onActiveClipChange(idx);
                }}
                onSwipe={onSwipeClip}
              />
            </svg>
            {currentTime >= rowStart && currentTime < row.end && (
<WaveformCursor
              view="stacked"
              getPlayedPct={getPlayedPct}
              getCurrentTime={getCurrentTime}
            />
            )}
            {row.clips.map(({ clip: s, idx }) => {
              const center =
                ((s.vStart + (s.vEnd - s.vStart) / 2 - rowStart) / rowLen) * 100;
              return (
                <ClipLabel
                  key={`lbl-${idx}`}
                  index={idx}
                  duration={s.vEnd - s.vStart}
                  left={center}
                  active={idx === activeClip}
                  canSplit={!playing && !!s.children && s.children.length > 1}
                  canMerge={!playing && (idx > 0 || idx < displayClips.length - 1)}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
});