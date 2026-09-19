/**
 * Horizontal scrolling single-row waveform view.
 *
 * Features:
 * - Displays waveform in a horizontally scrollable container
 * - Auto-scrolls to keep playhead visible (configurable follow distance)
 * - Shows detected clips (silent boundaries)
 * - Interactive clip selection and range playback
 * - Responsive window size with dynamic zoom level
 * - Pan/drag support for manual navigation
 */

import { memo, useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { Clip } from "./Clip";
import { ClipLabel } from "./ClipLabel";
import { DancingLines } from "./DancingLines";
import { WaveformCursor } from "./WaveformCursor";
import { WaveformBars } from "./Waveform";
import { type WaveformData } from "../hooks/useWaveform";
import type { Clip as ClipData } from "../utils/clips";
import { panTarget } from "../utils/pan";

const getWindowSecs = (w: number) => {
  if (w >= 1600) return 32;
  if (w >= 1200) return 16;
  if (w >= 800) return 12;
  return 8;
};
const HS_FOLLOW_FRAC = 0.6;
const HS_PAN_DECIDE_PX = 8;
// VB = viewBox: the SVG coordinate space the waveform is drawn in.
// VB_W/VB_H = fixed viewBox width/height (1000 x 200 units), scaled by the
// container; only VB_H can vary based on the waveform bar height.
const VB_W = 1000;
const VB_H = 200;
const PAD = 4;

export interface RowWaveformProps {
  waveform: WaveformData;
  displayClips: ClipData[];
  currentTime: number;
  onSeek: (time: number) => void;
  onPlayRange: (
    start: number,
    end: number,
    repetitions: number,
    onComplete?: () => void,
  ) => void;
  onClipPlayActiveChange?: (active: boolean) => void;
  repetitions: number;
  activeClip: number;
  onActiveClipChange: (idx: number) => void;
  getAnalyser?: (resume: boolean) => AnalyserNode | null;
  getCurrentTime: () => number;
  playing: boolean;
  scrolling: boolean;
  setScrolling: React.Dispatch<React.SetStateAction<boolean>>;
  scrollTimeoutRef: React.MutableRefObject<number | undefined>;
}

export const RowWaveform = memo(function RowWaveform({
  waveform,
  displayClips,
  currentTime,
  onSeek,
  onPlayRange,
  onClipPlayActiveChange,
  repetitions,
  activeClip,
  onActiveClipChange,
  getAnalyser,
  getCurrentTime,
  playing,
  scrolling,
  setScrolling,
  scrollTimeoutRef,
}: RowWaveformProps) {
  const innerH = VB_H - PAD * 2;
  const hsRef = useRef<HTMLDivElement>(null);

  // `hs` = horizontal scroll window: the visible slice of the full waveform
  // that the user pans across. `anchor` = window start time (secs), `winLen` =
  // window length (secs), `maxStart` = largest allowed anchor (dur - winLen).
  // Live-value refs (kept in sync below) so gesture/resize handlers never go stale.
  const [winWidth, setWinWidth] = useState(window.innerWidth);
  const hsWinLenRef = useRef(Math.min(getWindowSecs(winWidth), waveform.duration));
  const hsMaxStartRef = useRef(Math.max(0, waveform.duration - hsWinLenRef.current));
  const hsAnchorRef = useRef(0);
  // Frame-by-frame paint targets, written by `drawFrame` every rAF tick.
  const hsSmoothRef = useRef(0);
  const trackRef = useRef<HTMLDivElement>(null);

  const [hsAnchor, setHsAnchor] = useState(0);
  const applyWidth = useCallback((width: number) => {
    setWinWidth(width);
    hsWinLenRef.current = Math.min(getWindowSecs(width), waveform.duration);
    const maxStart = Math.max(0, waveform.duration - hsWinLenRef.current);
    hsMaxStartRef.current = maxStart;
    setHsAnchor((a) => Math.min(a, maxStart));
  }, []);
  useEffect(() => {
    const el = hsRef.current;
    const onResize = () => {
      applyWidth(window.innerWidth);
    };
    window.addEventListener("resize", onResize);
    if (!el || typeof ResizeObserver === "undefined") {
      applyWidth(el?.clientWidth || window.innerWidth);
      return () => window.removeEventListener("resize", onResize);
    }
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        applyWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, [applyWidth]);

  // Clip play tracking.
  const [clipPlayActive, setClipPlayActiveLocal] = useState(false);
  const prevClipPlayActiveRef = useRef(false);
  const clipPlayFollowEndRef = useRef(0);
  const clipPlayStartRef = useRef(0);
  const clipPlayAnchorStartRef = useRef(0);

  useEffect(() => {
    onClipPlayActiveChange?.(clipPlayActive);
  }, [clipPlayActive, onClipPlayActiveChange]);

  // Live mirrors of props/locals for the 60fps draw pass (refs never go stale).
  const playingRef = useRef(playing);
  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);
  const scrollingRef = useRef(scrolling);
  useEffect(() => {
    scrollingRef.current = scrolling;
  }, [scrolling]);
  const clipPlayActiveRef = useRef(clipPlayActive);
  useEffect(() => {
    clipPlayActiveRef.current = clipPlayActive;
  }, [clipPlayActive]);

  // Single source of truth for the row's frame-by-frame paint: writes the glide
  // transform on the waveform AND the cursor position from the SAME live values.
  // The cursor lives OUTSIDE the transformed track and is positioned in window
  // space, so it can never ride a stale anchor/transform. (Previously the cursor
  // was double-animated — its own rAF loop read an async-synced anchor ref while
  // the track transform was translated imperatively — which flashed on every
  // auto-scroll commit.)
  const drawFrame = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const innerEl = track.parentElement;
    if (!innerEl) return;
    const win = hsWinLenRef.current || 1;
    const t = getCurrentTime ? getCurrentTime() : 0;
    let s = hsAnchorRef.current;
    if (playingRef.current && !scrollingRef.current) {
      if (clipPlayActiveRef.current) {
        const followEnd = clipPlayFollowEndRef.current;
        if (
          followEnd &&
          hsAnchorRef.current + win < followEnd
        ) {
          const target = Math.min(
            clipPlayAnchorStartRef.current + (t - clipPlayStartRef.current),
            Math.max(0, followEnd - win),
          );
          s = Math.max(hsAnchorRef.current, target);
        }
      } else if (clipPlaySkipRef.current) {
        s = hsAnchorRef.current;
      } else {
        s = Math.max(
          0,
          Math.min(t - HS_FOLLOW_FRAC * win, hsMaxStartRef.current),
        );
      }
    }
    hsSmoothRef.current = s;
    const pxPerSec = (innerEl.clientWidth || 1) / win;
    track.style.transform = `translateX(${(-(s - hsAnchorRef.current) * pxPerSec).toFixed(2)}px)`;
  }, [getCurrentTime]);

  // Commits a new window anchor by re-rendering the bars. The ref + transform
  // are then paired with the freshly-rendered bars in the layout effect below,
  // so an auto-follow commit can never leave a frame where the transform leads
  // the bars actually in the DOM.
  const commitAnchor = useCallback((target: number) => {
    setHsAnchor(target);
  }, [setHsAnchor]);

  // Gesture commit: updates the refs synchronously so the transform/cursor
  // follow the pointer immediately (gestures read live values, so a transient
  // React render lag is imperceptible).
  const commitAnchorNow = useCallback(
    (target: number) => {
      hsAnchorRef.current = target;
      hsSmoothRef.current = target;
      setHsAnchor(target);
      drawFrame();
    },
    [drawFrame, setHsAnchor],
  );

  // Runs synchronously right after React swaps in the new bars (before the
  // browser paints), so the transform always matches the bars rendered for the
  // committed anchor — atomic per frame, no 1-frame displacement on commits.
  useLayoutEffect(() => {
    hsAnchorRef.current = hsAnchor;
    drawFrame();
  }, [hsAnchor, drawFrame]);

  // Auto-follow the playhead. `currentTime` (the Redux clock, ~4Hz timeupdate
  // cadence) merely trips re-evaluation; the actual commit target is computed
  // from the LIVE clock inside the rAF so the anchor lands exactly where the
  // glide has already moved `s`. If the commit used the lagging Redux time, the
  // transform would snap forward on every commit and the waveform would shake.
  const clipPlaySkipRef = useRef(false);

  // Live-value refs for gesture handlers (kept in sync so handlers never go stale).
  useEffect(() => {
    if (prevClipPlayActiveRef.current && !clipPlayActive) {
      clipPlaySkipRef.current = true;
    }
    prevClipPlayActiveRef.current = clipPlayActive;
  }, [clipPlayActive]);
  useEffect(() => {
    if (scrolling) return;
    if (!playing) return;
    if (clipPlaySkipRef.current) {
      const t = getCurrentTime();
      if (t <= hsAnchorRef.current + hsWinLenRef.current) return;
      clipPlaySkipRef.current = false;
    }
    const id = requestAnimationFrame(() => {
      const t = getCurrentTime();
      if (clipPlayActive) {
        const followEnd = clipPlayFollowEndRef.current;
        if (!followEnd) return;
        if (hsAnchorRef.current + hsWinLenRef.current >= followEnd) return;
        const elapsed = t - clipPlayStartRef.current;
        const target = Math.min(
          clipPlayAnchorStartRef.current + elapsed,
          Math.max(0, followEnd - hsWinLenRef.current),
        );
        if (Math.abs(target - hsAnchorRef.current) > 0.05) commitAnchor(target);
        return;
      }
      const target = Math.max(
        0,
        Math.min(t - HS_FOLLOW_FRAC * hsWinLenRef.current, hsMaxStartRef.current),
      );
      if (Math.abs(target - hsAnchorRef.current) > 0.05) commitAnchor(target);
    });
    return () => cancelAnimationFrame(id);
  }, [currentTime, scrolling, playing, clipPlayActive, commitAnchor, getCurrentTime]);

  const playClip = useCallback(
    (start: number, end: number, reps: number) => {
      setClipPlayActiveLocal(true);
      clipPlayFollowEndRef.current = 0;
      clipPlayStartRef.current = start;
      const a = hsAnchorRef.current;
      const w = hsWinLenRef.current;
      clipPlayAnchorStartRef.current = a;
      if (start < a) {
        commitAnchor(Math.max(0, Math.min(start, hsMaxStartRef.current)));
      } else if (end > a + w) {
        clipPlayFollowEndRef.current = end;
      }
      onPlayRange(start, end, reps, () => {
        clipPlayFollowEndRef.current = 0;
        setClipPlayActiveLocal(false);
      });
    },
    [onPlayRange, setClipPlayActiveLocal, commitAnchor],
  );

  // Panning.
  const bumpScrolling = useCallback(() => {
    setScrolling(true);
    window.clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = window.setTimeout(
      () => setScrolling(false),
      1500,
    );
  }, [setScrolling, scrollTimeoutRef]);

  // Drag pan (mouse + touch).
  const hsDragRef = useRef<{
    pointerId: number;
    startX: number;
    startAnchor: number;
    panned: boolean;
  } | null>(null);
  const hsSuppressClickRef = useRef(false);
  const onHsPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    if (hsDragRef.current) return;
    // A previous gesture's suppression may never have been consumed by a click
    // (e.g. pointercancel releases with no click); always start fresh so the
    // first real click of this gesture is honored.
    hsSuppressClickRef.current = false;
    const el = e.currentTarget;
    const drag = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startAnchor: hsAnchorRef.current,
      panned: false,
    };
    hsDragRef.current = drag;

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== drag.pointerId) return;
      const dx = ev.clientX - drag.startX;
      if (!drag.panned && Math.abs(dx) < HS_PAN_DECIDE_PX) return;
      drag.panned = true;
      const target = panTarget(
        drag.startAnchor,
        dx,
        hsWinLenRef.current,
        el.clientWidth,
        hsMaxStartRef.current,
      );
      commitAnchorNow(target);
      bumpScrolling();
    };
    const onEnd = (ev: PointerEvent) => {
      if (ev.pointerId !== drag.pointerId) return;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
      hsDragRef.current = null;
      if (!drag.panned) return;
      // A drag is pure navigation: it must never change the active clip (only
      // clicking a clip to play it does). Just swallow the synthetic click the
      // browser fires after pointerup so it can't activate the clip under the
      // finger.
      hsSuppressClickRef.current = true;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
    bumpScrolling();
  };

  // Wheel pan.
  useEffect(() => {
    const el = hsRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const elNow = hsRef.current;
      if (!elNow) return;
      const delta =
        Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      const scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1;
      const dSec = Math.max(
        -2,
        Math.min(
          2,
          ((delta * scale) / (elNow.clientWidth || 1)) *
          (hsWinLenRef.current || 1),
        ),
      );
      commitAnchorNow(
        Math.max(0, Math.min(hsAnchorRef.current + dSec, hsMaxStartRef.current)),
      );
      bumpScrolling();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [bumpScrolling, commitAnchorNow]);

  // Dance loop: drives the waveform glide (track transform) and the cursor
  // position imperatively every frame via `drawFrame` — a single source of
  // truth so neither the cursor nor the bars can desync from a stale anchor.
  useEffect(() => {
    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      drawFrame();
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [drawFrame]);

  const getPlayedPct = useCallback(() => {
    return Math.max(0, Math.min(1, (getCurrentTime() - hsAnchorRef.current) / hsWinLenRef.current));
  }, [getCurrentTime]);
  const getSmoothPlayedPct = useCallback(() => {
    return Math.max(0, Math.min(1, (getCurrentTime() - hsSmoothRef.current) / hsWinLenRef.current));
  }, [getCurrentTime]);
  return (
    <div
      className="row-waveform"
      ref={hsRef}
      onPointerDown={onHsPointerDown}
      onClickCapture={(e) => {
        if (hsSuppressClickRef.current) {
          hsSuppressClickRef.current = false;
          e.stopPropagation();
        }
      }}
    >
      <div
        className="row-waveform__inner"
        onClick={(e) => {
          if (hsSuppressClickRef.current) {
            hsSuppressClickRef.current = false;
            return;
          }
          const rect = e.currentTarget.getBoundingClientRect();
          const f = Math.max(
            0,
            Math.min(1, (e.clientX - rect.left) / rect.width),
          );
          onSeek(hsSmoothRef.current + f * hsWinLenRef.current);
          onActiveClipChange(-1);
        }}
      >
        <DancingLines
          getAnalyser={getAnalyser}
          getCurrentTime={getCurrentTime}
          waveform={waveform}
        />
        <div className="row-waveform__track" ref={trackRef}>
          <svg
            className="row-waveform__svg"
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            preserveAspectRatio="none"
          >
              <WaveformBars
                data={waveform.data}
                sampleRate={waveform.sampleRate}
                window={{
                  windowStartSec: hsAnchor,
                  windowLen: hsWinLenRef.current,
                  innerH,
                  vbW: VB_W,
                  vbH: VB_H,
                }}
                fracPlayed={getPlayedPct()}
                idPrefix="hs"
                strokeWidth={1.6}
              />
              <Clip
                clips={displayClips}
                window={{
                  windowStartSec: hsAnchor,
                  windowLen: hsWinLenRef.current,
                  innerH,
                  vbW: VB_W,
                  vbH: VB_H,
                }}
                onPlayRange={playClip}
                repetitions={repetitions}
                activeClip={activeClip}
                onActivate={(idx) => {
                  onActiveClipChange(idx);
                }}
              />
            </svg>
            {displayClips.map((s, idx) => {
              if (s.vEnd <= hsAnchor || s.vStart >= hsAnchor + hsWinLenRef.current)
                return null;
              const center =
                ((s.vStart + (s.vEnd - s.vStart) / 2 - hsAnchor) /
                  hsWinLenRef.current) *
                100;
              return (
                <ClipLabel
                  key={`hlbl-${idx}`}
                  index={idx}
                  duration={s.vEnd - s.vStart}
                  left={center}
                  active={idx === activeClip}
                />
              );
            })}
          </div>
          <WaveformCursor
            view="row"
            getPlayedPct={getSmoothPlayedPct}
            getCurrentTime={getCurrentTime}
          />
      </div>
    </div>
  );
});
