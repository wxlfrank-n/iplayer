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

import { memo, useState, useEffect, useRef, useCallback } from "react";
import { Clip } from "./Clip";
import { ClipLabel } from "./ClipLabel";
import { WaveformCursor } from "./WaveformCursor";
import { WaveformBars } from "./Waveform";
import { type WaveformData } from "../hooks/useWaveform";
import type { Clip as ClipData } from "../utils/clips";

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

const formatTime = (sec: number) => {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  const h = Math.floor(m / 60);
  if (h > 0)
    return `${h}:${(m % 60).toString().padStart(2, "0")}:${r.toString().padStart(2, "0")}`;
  return `${m}:${r.toString().padStart(2, "0")}`;
};

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
  getCurrentTime?: () => number;
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
  const navIndexRef = useRef(-1);
  const hsRef = useRef<HTMLDivElement>(null);

  // `hs` = horizontal scroll window: the visible slice of the full waveform
  // that the user pans across. `anchor` = window start time (secs), `winLen` =
  // window length (secs), `maxStart` = largest allowed anchor (dur - winLen).
  // Live-value refs (kept in sync below) so gesture/resize handlers never go stale.
  const winWidthRef = useRef(window.innerWidth);
  const clipsRef = useRef(displayClips);
  const hsMaxStartRef = useRef(0);
  const hsAnchorRef = useRef(0);

  const [hsAnchor, setHsAnchor] = useState(0);
  const [winWidth, setWinWidth] = useState(window.innerWidth);
  const applyWidth = useCallback((width: number) => {
    winWidthRef.current = width;
    setWinWidth(width);
    const clips = clipsRef.current;
    const dur = clips.length > 0 ? clips[clips.length - 1].end : 1;
    const maxStart = Math.max(0, dur - Math.min(getWindowSecs(width), dur));
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

  // Window state.
  const totalDuration =
    displayClips.length > 0 ? displayClips[displayClips.length - 1].end : 1;
  const hsWinLen = Math.min(getWindowSecs(winWidth), totalDuration);
  const hsMaxStart = Math.max(0, totalDuration - hsWinLen);
  useEffect(() => {
    hsAnchorRef.current = hsAnchor;
    hsSmoothRef.current = hsAnchor;
  }, [hsAnchor]);

  // Clip play tracking.
  const [clipPlayActive, setClipPlayActiveLocal] = useState(false);
  const prevClipPlayActiveRef = useRef(false);
  const clipPlayFollowEndRef = useRef(0);
  const clipPlayStartRef = useRef(0);
  const clipPlayAnchorStartRef = useRef(0);

  useEffect(() => {
    onClipPlayActiveChange?.(clipPlayActive);
  }, [clipPlayActive, onClipPlayActiveChange]);

  // Auto-follow the playhead.
  const clipPlaySkipRef = useRef(false);

  // Live-value refs for gesture handlers (kept in sync so handlers never go stale).
  const hsWinLenRef = useRef(hsWinLen);
  useEffect(() => {
    hsWinLenRef.current = hsWinLen;
  }, [hsWinLen]);
  useEffect(() => {
    hsMaxStartRef.current = hsMaxStart;
  }, [hsMaxStart]);
  useEffect(() => {
    clipsRef.current = displayClips;
  }, [displayClips]);
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
      clipPlaySkipRef.current = false;
      return;
    }
    if (clipPlayActive) {
      const followEnd = clipPlayFollowEndRef.current;
      if (!followEnd) return;
      if (hsAnchorRef.current + hsWinLenRef.current >= followEnd) return;
      const elapsed = currentTime - clipPlayStartRef.current;
      const target = Math.min(
        clipPlayAnchorStartRef.current + elapsed,
        Math.max(0, followEnd - hsWinLen),
      );
      if (target <= hsAnchorRef.current) return;
      const id = requestAnimationFrame(() => {
        setHsAnchor((a) => (Math.abs(target - a) > 0.05 ? target : a));
      });
      return () => cancelAnimationFrame(id);
    }
    const target = Math.max(
      0,
      Math.min(currentTime - HS_FOLLOW_FRAC * hsWinLen, hsMaxStart),
    );
    const id = requestAnimationFrame(() => {
      setHsAnchor((a) => (Math.abs(target - a) > 0.05 ? target : a));
    });
    return () => cancelAnimationFrame(id);
  }, [currentTime, hsWinLen, hsMaxStart, scrolling, playing, clipPlayActive]);

  const playClip = useCallback(
    (start: number, end: number, reps: number) => {
      setClipPlayActiveLocal(true);
      clipPlayFollowEndRef.current = 0;
      clipPlayStartRef.current = start;
      const a = hsAnchorRef.current;
      const w = hsWinLenRef.current;
      clipPlayAnchorStartRef.current = a;
      if (start < a) {
        setHsAnchor(Math.max(0, Math.min(start, hsMaxStartRef.current)));
      } else if (end > a + w) {
        clipPlayFollowEndRef.current = end;
      }
      onPlayRange(start, end, reps, () => {
        clipPlayFollowEndRef.current = 0;
        setClipPlayActiveLocal(false);
      });
    },
    [onPlayRange, setClipPlayActiveLocal, setHsAnchor],
  );

  const revealClip = useCallback(
    (s: ClipData) => {
      if (
        s.start < hsAnchorRef.current ||
        s.end > hsAnchorRef.current + hsWinLenRef.current
      ) {
        setHsAnchor(Math.max(0, Math.min(s.start, hsMaxStartRef.current)));
      }
    },
    [setHsAnchor],
  );

  // Keyboard navigation.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement
      )
        return;
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      if (displayClips.length === 0) return;
      e.preventDefault();
      const prev = activeClip;
      let next =
        prev < 0
          ? e.key === "ArrowRight"
            ? 0
            : displayClips.length - 1
          : prev + (e.key === "ArrowRight" ? 1 : -1);
      next = Math.max(0, Math.min(next, displayClips.length - 1));
      navIndexRef.current = next;
      const s = displayClips[next];
      if (s) {
        playClip(s.start, s.end, repetitions);
        revealClip(s);
      }
      onActiveClipChange(next);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    displayClips,
    repetitions,
    playClip,
    revealClip,
    onActiveClipChange,
    activeClip,
  ]);

  // Panning.
  const hsDragRef = useRef<{
    pointerId: number;
    startX: number;
    startAnchor: number;
    panned: boolean;
  } | null>(null);
  const hsSuppressClickRef = useRef(false);
  const bumpScrolling = useCallback(() => {
    setScrolling(true);
    window.clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = window.setTimeout(
      () => setScrolling(false),
      1500,
    );
  }, [setScrolling, scrollTimeoutRef]);

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
      setHsAnchor((a) =>
        Math.max(0, Math.min(a + dSec, hsMaxStartRef.current)),
      );
      bumpScrolling();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [bumpScrolling]);

  // Dancing lines canvas.
  const danceCanvasRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);
  const timeLabelRef = useRef<HTMLSpanElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const hsSmoothRef = useRef(0);
  const lastFormattedTimeRef = useRef<string>("");
  useEffect(() => {
    const canvas = danceCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const N = 56;
    const levels = new Float32Array(N);
    let data = new Uint8Array(0);
    let raf = 0;
    let color = "";

    const frame = () => {
      raf = requestAnimationFrame(frame);
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const dpr = window.devicePixelRatio || 1;
      const pw = Math.round(rect.width * dpr);
      const ph = Math.round(rect.height * dpr);
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, rect.width, rect.height);

      const innerEl = canvas.parentElement;
      const track = trackRef.current;
      if (innerEl && track && getCurrentTime) {
        const t = getCurrentTime();
        const win = hsWinLenRef.current || 1;
        const s =
          playing && !scrolling
            ? (() => {
                if (clipPlayActive) {
                  const followEnd = clipPlayFollowEndRef.current;
                  if (
                    !followEnd ||
                    hsAnchorRef.current + (hsWinLenRef.current || 1) >=
                      followEnd
                  ) {
                    return hsAnchorRef.current;
                  }
                  const elapsed = t - clipPlayStartRef.current;
                  const target = Math.min(
                    clipPlayAnchorStartRef.current + elapsed,
                    Math.max(0, followEnd - (hsWinLenRef.current || 1)),
                  );
                  return Math.max(hsAnchorRef.current, target);
                }
                if (clipPlaySkipRef.current) return hsAnchorRef.current;
                return Math.max(
                  0,
                  Math.min(t - HS_FOLLOW_FRAC * win, hsMaxStartRef.current),
                );
              })()
            : hsAnchorRef.current;
        hsSmoothRef.current = s;
        const pxPerSec = (innerEl.clientWidth || 1) / win;
        track.style.transform = `translateX(${(-(s - hsAnchorRef.current) * pxPerSec).toFixed(2)}px)`;
        const cur = cursorRef.current;
        if (cur) cur.style.left = `${(((t - s) / win) * 100).toFixed(3)}%`;
        const timeLabel = timeLabelRef.current;
        if (timeLabel) {
          const formatted = formatTime(t);
          if (formatted !== lastFormattedTimeRef.current) {
            timeLabel.textContent = formatted;
            lastFormattedTimeRef.current = formatted;
          }
          timeLabel.style.left = `${Math.max(4, Math.min(96, ((t - s) / win) * 100)).toFixed(2)}%`;
        }
      }

      const analyser = getAnalyser ? getAnalyser(false) : null;
      const len = analyser ? analyser.frequencyBinCount : 0;
      if (analyser) {
        if (data.length !== len) data = new Uint8Array(len);
        analyser.getByteFrequencyData(data);
      }

      if (!color) {
        const v = getComputedStyle(document.documentElement)
          .getPropertyValue("--accent")
          .trim();
        color = v || "#58a6ff";
      }
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = color;
      const bw = rect.width / N;
      const base = rect.height - 4;
      const maxH = rect.height - 8;
      for (let i = 0; i < N; i++) {
        const bin =
          len > 0
            ? Math.min(
                len - 1,
                Math.floor((1 - Math.pow(1 - i / N, 1.5)) * (len - 1)),
              )
            : 0;
        const v = len > 0 ? data[bin] / 255 : 0;
        const target = Math.pow(v, 1.7);
        levels[i] += (target - levels[i]) * 0.2;
        const h = Math.max(3, levels[i] * maxH) * 3;
        const x = i * bw + bw * 0.25;
        ctx.fillRect(x, base - h, bw * 0.5, h);
      }
      ctx.globalAlpha = 1;
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [getAnalyser, getCurrentTime, playing, scrolling, clipPlayActive]);

  const onHsPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    if (hsDragRef.current) return;
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
      const secPerPx = (hsWinLenRef.current || 1) / (el.clientWidth || 1);
      const target = drag.startAnchor - dx * secPerPx;
      setHsAnchor(Math.max(0, Math.min(target, hsMaxStartRef.current)));
      bumpScrolling();
    };
    const onEnd = (ev: PointerEvent) => {
      if (ev.pointerId !== drag.pointerId) return;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
      hsDragRef.current = null;
      if (!drag.panned) return;
      hsSuppressClickRef.current = true;
      const clips = clipsRef.current;
      if (clips.length === 0) return;
      const now = hsAnchorRef.current;
      let best = 0;
      let bestDist = Infinity;
      for (let i = 0; i < clips.length; i++) {
        const d = Math.abs(clips[i].start - now);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      setHsAnchor(
        Math.max(0, Math.min(clips[best].start, hsMaxStartRef.current)),
      );
      onActiveClipChange(best);
      navIndexRef.current = best;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
    bumpScrolling();
  };

  const hsFrac =
    hsWinLen > 0
      ? Math.max(0, Math.min(1, (currentTime - hsAnchor) / hsWinLen))
      : 0;

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
          onSeek(hsSmoothRef.current + f * hsWinLen);
          onActiveClipChange(-1);
          navIndexRef.current = -1;
        }}
      >
        <canvas className="row-waveform__dance" ref={danceCanvasRef} />
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
                windowLen: hsWinLen,
                innerH,
                vbW: VB_W,
                vbH: VB_H,
              }}
              fracPlayed={hsFrac}
              idPrefix="hs"
              strokeWidth={1.6}
            />
            <Clip
              clips={displayClips}
              window={{
                windowStartSec: hsAnchor,
                windowLen: hsWinLen,
                innerH,
                vbW: VB_W,
                vbH: VB_H,
              }}
              onPlayRange={playClip}
              repetitions={repetitions}
              activeClip={activeClip}
              onActivate={(idx) => {
                onActiveClipChange(idx);
                navIndexRef.current = idx;
              }}
            />
          </svg>
          <WaveformCursor
            view="row"
            left={hsFrac}
            time={formatTime(currentTime)}
            cursorRef={cursorRef}
            timeRef={timeLabelRef}
          />
          {displayClips.map((s, idx) => {
            if (s.end <= hsAnchor || s.start >= hsAnchor + hsWinLen)
              return null;
            const center =
              ((s.start + (s.end - s.start) / 2 - hsAnchor) / hsWinLen) * 100;
            return (
              <ClipLabel
                key={`hlbl-${idx}`}
                index={idx}
                duration={s.end - s.start}
                left={center}
                active={idx === activeClip}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
});
