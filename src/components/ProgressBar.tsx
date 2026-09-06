import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Sector } from "./Sector";
import { WaveformBars } from "./Waveform";
import { type WaveformData } from "../hooks/useWaveform";
import { splitBySilence, mergeSectorsByGap, sectorGaps, MERGE_GAP_SEC } from "../utils/sectors";
import { formatTime, formatTimePrecise } from "../utils/time";

interface ProgressBarProps {
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  onPlay: () => void;
  waveform: WaveformData | null;
  onPlayRange: (start: number, end: number, repetitions: number) => void;
}

const WINDOW_SECONDS = 30;
const VB_W = 1000;
const VB_H = 200;
const PAD = 4;
const SWIPE_THRESHOLD_PX = 50;
const SWIPE_DECIDE_PX = 8;
const WHEEL_MIN_DX = 3;
const WHEEL_BURST_MS = 100;
const WHEEL_STEP_PX = 40;

export function ProgressBar({ currentTime, duration, onSeek, onPlay, waveform, onPlayRange }: ProgressBarProps) {
  const hasWaveform = waveform !== null && waveform.data.length > 0;
  const sectors = useMemo(
    () => splitBySilence(waveform?.data ?? null, waveform?.sampleRate ?? 0),
    [waveform],
  );

  const [anchorStartSec, setAnchorStartSec] = useState<number>(0);
  const [prevTime, setPrevTime] = useState<number>(-1);
  const [activeSector, setActiveSector] = useState<number>(-1);
  const [hoverFrac, setHoverFrac] = useState<number | null>(null);
  const [mergeGap, setMergeGap] = useState(MERGE_GAP_SEC);
  const [repetitions, setRepetitions] = useState(3);

  const gapValues = useMemo(() => sectorGaps(sectors), [sectors]);
  const displaySectors = useMemo(
    () => mergeSectorsByGap(sectors, mergeGap),
    [sectors, mergeGap],
  );

  if (hasWaveform && prevTime !== currentTime) {
    setPrevTime(currentTime);
    if (duration > 0) {
      if (currentTime >= anchorStartSec + WINDOW_SECONDS) {
        setAnchorStartSec(Math.max(0, currentTime - WINDOW_SECONDS));
      } else if (currentTime < anchorStartSec) {
        setAnchorStartSec(currentTime);
      }
    }
  }

  const innerH = VB_H - PAD * 2;
  const windowStartSec = Math.max(0, Math.min(anchorStartSec, Math.max(0, duration - WINDOW_SECONDS)));
  const windowEndSec = Math.min(duration, windowStartSec + WINDOW_SECONDS);
  const windowLen = windowEndSec - windowStartSec;

  const fracPlayed = windowLen > 0 ? Math.min(1, Math.max(0, (currentTime - windowStartSec) / windowLen)) : 0;

  const visibleSectors = displaySectors
    .map((s, idx) => ({ start: s.start, end: s.end, idx }))
    .filter((s) => s.end > windowStartSec && s.start < windowStartSec + windowLen);

  // Cursor for touch/wheel window navigation; kept in sync with the keyboard's
  // active sector so mixed input stays consistent.
  const navIndexRef = useRef(-1);

  // Keyboard navigation keeps its original behavior: select and play the sector.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      if (displaySectors.length === 0) return;
      e.preventDefault();
      setActiveSector((prev) => {
        let next = prev < 0 ? (e.key === "ArrowRight" ? 0 : displaySectors.length - 1) : prev + (e.key === "ArrowRight" ? 1 : -1);
        next = Math.max(0, Math.min(next, displaySectors.length - 1));
        navIndexRef.current = next;
        const s = displaySectors[next];
        if (s) onPlayRange(s.start, s.end, repetitions);
        return next;
      });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [displaySectors, onPlayRange, repetitions]);

  // Touch swipe and wheel navigation only move the viewing window.
  const navigateSector = useCallback(
    (direction: 1 | -1) => {
      if (displaySectors.length === 0) return;
      const prev = navIndexRef.current;
      const next = prev < 0
        ? direction > 0 ? 0 : displaySectors.length - 1
        : Math.max(0, Math.min(prev + direction, displaySectors.length - 1));
      navIndexRef.current = next;
      const s = displaySectors[next];
      if (!s) return;
      // Only move the viewing window so the sector starts at the left edge.
      setAnchorStartSec(Math.max(0, Math.min(s.start, Math.max(0, duration - WINDOW_SECONDS))));
    },
    [displaySectors, duration],
  );

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const swipeActive = useRef(false);
  const swipeFired = useRef(false);
  const touchEnded = useRef(false);
  const barRef = useRef<HTMLDivElement | null>(null);

  const wheelLastMs = useRef(0);
  const wheelAccum = useRef(0);

  useEffect(() => {
    const el = barRef.current;
    if (!el) return;

    const reset = () => {
      touchStartX.current = null;
      touchStartY.current = null;
      swipeActive.current = false;
      swipeFired.current = false;
      touchEnded.current = false;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      reset();
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (touchEnded.current) return;
      if (touchStartX.current === null || touchStartY.current === null) return;
      const dx = e.touches[0].clientX - touchStartX.current;
      const dy = e.touches[0].clientY - touchStartY.current;
      const ax = Math.abs(dx);
      const ay = Math.abs(dy);

      if (!swipeActive.current) {
        if (ax <= SWIPE_DECIDE_PX && ay <= SWIPE_DECIDE_PX) return;
        if (ax > ay) {
          // Clearly horizontal: claim the gesture so the page never moves,
          // but don't navigate until the swipe passes the threshold.
          e.preventDefault();
          swipeActive.current = true;
        } else {
          // Clearly vertical: hand the gesture back to the browser for scrolling.
          touchEnded.current = true;
          return;
        }
      }

      if (!swipeFired.current && ax >= SWIPE_THRESHOLD_PX) {
        swipeFired.current = true;
        touchEnded.current = true;
        navigateSector(dx < 0 ? -1 : 1);
      }
    };

    const onTouchEnd = () => {
      reset();
    };

    // Touchpads (Windows/macOS) don't fire touch events; a two-finger horizontal
    // swipe arrives as `wheel` with deltaX. Claim every wheel event on the bar so
    // it never pans the page, then navigate one sector per step so a continuous
    // flick scrolls through sectors quickly.
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      const dx = e.deltaX;
      const dy = e.deltaY;
      const ax = Math.abs(dx);
      const ay = Math.abs(dy);
      if (ax < WHEEL_MIN_DX || ax <= ay) return;

      const now = performance.now();
      if (now - wheelLastMs.current > WHEEL_BURST_MS) {
        wheelAccum.current = 0;
      }
      wheelLastMs.current = now;

      // Normalize line/page-mode deltas to pixels.
      const scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1;
      wheelAccum.current += dx * scale;

      const sign = Math.sign(wheelAccum.current);
      while (Math.abs(wheelAccum.current) >= WHEEL_STEP_PX) {
        navigateSector(sign > 0 ? 1 : -1);
        wheelAccum.current -= sign * WHEEL_STEP_PX;
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
      el.removeEventListener("wheel", onWheel);
    };
  }, [navigateSector]);

  const handleClick = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const frac = x / rect.width;
    const seekTime = windowStartSec + frac * windowLen;
    onSeek(Math.max(0, Math.min(seekTime, duration)));
    onPlay();
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    setHoverFrac(Math.max(0, Math.min(1, x / rect.width)));
  };

  const hoverTime = hoverFrac !== null ? windowStartSec + hoverFrac * windowLen : 0;

  return (
    <div className="progress-container">
      <div className="progress-row">
        <span className="time-label">{formatTime(currentTime)}</span>
        <div
          ref={barRef}
          className="waveform-bar"
          onClick={handleClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverFrac(null)}
        >
          {hasWaveform && (
            <svg className="waveform-svg" viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none">
              <WaveformBars
                data={waveform.data}
                sampleRate={waveform.sampleRate}
                windowStartSec={windowStartSec}
                windowLen={windowLen}
                innerH={innerH}
                vbW={VB_W}
                vbH={VB_H}
                fracPlayed={fracPlayed}
              />
              <Sector
                sectors={displaySectors}
                windowStartSec={windowStartSec}
                windowLen={windowLen}
                innerH={innerH}
                vbW={VB_W}
                vbH={VB_H}
                onPlayRange={onPlayRange}
                repetitions={repetitions}
                activeSector={activeSector}
                onActivate={(idx) => {
                  setActiveSector(idx);
                  navIndexRef.current = idx;
                }}
              />
            </svg>
          )}
          {hasWaveform &&
            visibleSectors.map((s) => {
              const center = ((s.start + (s.end - s.start) / 2 - windowStartSec) / windowLen) * 100;
              return (
                <span
                  key={`label-${s.idx}`}
                  className={`waveform-sector-label ${s.idx === activeSector ? "waveform-sector-label--active" : ""}`}
                  style={{ left: `${center}%` }}
                >
                  {s.idx + 1}
                </span>
              );
            })}
          {hoverFrac !== null && (
            <>
              <div className="waveform-bar__guide" style={{ left: `${hoverFrac * 100}%` }} />
              <div
                className={`waveform-bar__tooltip ${hoverFrac > 0.9 ? "waveform-bar__tooltip--edge" : ""}`}
                style={{ left: `${hoverFrac * 100}%` }}
              >
                {formatTimePrecise(hoverTime)}
              </div>
            </>
          )}
        </div>
        <span className="time-label">{formatTime(duration)}</span>
      </div>
      {gapValues.length > 0 && (
        <div className="sector-toolbar">
          <div className="sector-merge">
            <input
              type="range"
              min={gapValues[0]}
              max={gapValues[gapValues.length - 1]}
              step={0.005}
              value={mergeGap}
              onChange={(e) => {
                const raw = parseFloat(e.target.value);
                let best = 0;
                let bestDist = Infinity;
                for (const g of gapValues) {
                  const d = Math.abs(g - raw);
                  if (d < bestDist) {
                    bestDist = d;
                    best = g;
                  }
                }
                setMergeGap(best);
              }}
            />
            <span className="sector-merge__label">
              {mergeGap.toFixed(2)}s · {displaySectors.length} sectors
            </span>
          </div>
          <div className="sector-reps">
            <span className="sector-reps__label">Repeat:</span>
            <div className="sector-reps__stepper">
              <button
                type="button"
                aria-label="Decrease repeats"
                onClick={() => setRepetitions((r) => Math.max(1, r - 1))}
              >
                −
              </button>
              <span className="sector-reps__value">{repetitions}</span>
              <button
                type="button"
                aria-label="Increase repeats"
                onClick={() => setRepetitions((r) => Math.min(20, r + 1))}
              >
                +
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
