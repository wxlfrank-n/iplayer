import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Sector } from "./Sector";
import { WaveformBars } from "./Waveform";
import { type WaveformData, type WaveformStatus } from "../hooks/useWaveform";
import { splitBySilence, mergeSectorsByGap, sectorGaps, MERGE_GAP_SEC } from "../utils/sectors";
import { formatTime, formatTimePrecise } from "../utils/time";

interface ProgressBarProps {
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  onPlay: () => void;
  waveform: WaveformData | null;
  waveformStatus: WaveformStatus;
  onPlayRange: (start: number, end: number, repetitions: number) => void;
}

const WINDOW_SECONDS = 30;
const VB_W = 1000;
const VB_H = 200;
const PAD = 4;
const SWIPE_DECIDE_PX = 8;
const WHEEL_MIN_DX = 3;
const WHEEL_BURST_MS = 100;
const WHEEL_STEP_PX = 40;

export function ProgressBar({ currentTime, duration, onSeek, onPlay, waveform, waveformStatus, onPlayRange }: ProgressBarProps) {
  const hasWaveform = waveform !== null && waveform.data.length > 0;
  const sectors = useMemo(
    () => splitBySilence(waveform?.data ?? null, waveform?.sampleRate ?? 0),
    [waveform],
  );

  const [anchorStartSec, setAnchorStartSec] = useState<number>(0);
  // Last currentTime we've already anchored the follow-window for. Kept in a ref
  // (no re-render) so the anchor only advances once per new playhead position.
  const lastAnchoredTimeRef = useRef<number>(-1);
  const [activeSector, setActiveSector] = useState<number>(-1);
  const [hoverFrac, setHoverFrac] = useState<number | null>(null);
  const [mergeGap, setMergeGap] = useState(MERGE_GAP_SEC);
  // Raw slider position (continuous) — the thumb and bubble follow this while
  // dragging; `mergeGap` snaps it to the nearest real sector gap for merging.
  const [sliderValue, setSliderValue] = useState(MERGE_GAP_SEC);
  const [repetitions, setRepetitions] = useState(3);

  const gapValues = useMemo(() => sectorGaps(sectors), [sectors]);
  const displaySectors = useMemo(
    () => mergeSectorsByGap(sectors, mergeGap),
    [sectors, mergeGap],
  );
  const gapMin = gapValues.length > 0 ? gapValues[0] : 0;
  const gapMax = gapValues.length > 0 ? gapValues[gapValues.length - 1] : 0;
  const mergePct =
    gapMax > gapMin ? Math.min(1, Math.max(0, (sliderValue - gapMin) / (gapMax - gapMin))) : 0;

  // Slider geometry (width + thumb size) so the value bubble can be placed
  // exactly over the thumb center in pixels (calc() cannot multiply lengths,
  // so the position is computed here instead of in CSS).
  const sliderWrapRef = useRef<HTMLDivElement>(null);
  const [sliderMetrics, setSliderMetrics] = useState({ width: 200, thumbW: 10 });
  useEffect(() => {
    const el = sliderWrapRef.current;
    if (!el) return;
    const update = () => {
      const tw =
        parseFloat(getComputedStyle(el).getPropertyValue("--thumb-w")) || 10;
      setSliderMetrics({ width: el.clientWidth, thumbW: tw });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Slider is mirrored (max on the left, min on the right), so the bubble sits
  // at the mirrored position of the thumb center.
  const bubbleLeft =
    sliderMetrics.width -
    (sliderMetrics.thumbW / 2 + (sliderMetrics.width - sliderMetrics.thumbW) * mergePct);

  // Page/follow the 30s window along with the playhead, once per new position.
  // Uses a ref guard + functional setState and runs as an effect (after commit)
  // rather than during render, so it can never trigger a render-phase stall.
  const isPanningRef = useRef(false);
  useEffect(() => {
    if (!hasWaveform || lastAnchoredTimeRef.current === currentTime || isPanningRef.current) return;
    lastAnchoredTimeRef.current = currentTime;
    setAnchorStartSec((a) => {
      if (currentTime >= a + WINDOW_SECONDS) {
        return Math.max(0, currentTime - WINDOW_SECONDS);
      }
      if (currentTime < a) return currentTime;
      return a;
    });
  }, [hasWaveform, currentTime]);

  const innerH = VB_H - PAD * 2;
  const windowStartSec = Math.max(0, Math.min(anchorStartSec, Math.max(0, duration - WINDOW_SECONDS)));
  const windowEndSec = Math.min(duration, windowStartSec + WINDOW_SECONDS);
  const windowLen = windowEndSec - windowStartSec;

  // Live refs so the (once-attached) touch listeners always read current values
  // without re-binding on every render. Synced in effects (not during render).
  const anchorRef = useRef(anchorStartSec);
  const windowLenRef = useRef(windowLen);
  const durationRef = useRef(duration);
  const sectorsRef = useRef(displaySectors);
  useEffect(() => {
    anchorRef.current = anchorStartSec;
  }, [anchorStartSec]);
  useEffect(() => {
    windowLenRef.current = windowLen;
  }, [windowLen]);
  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);
  useEffect(() => {
    sectorsRef.current = displaySectors;
  }, [displaySectors]);

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
  const panAnchorStart = useRef(0);
  const barRectW = useRef(0);
  const panning = useRef(false);
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
      panning.current = false;
      touchEnded.current = false;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      reset();
      isPanningRef.current = false;
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
      // Record where the window would start if the gesture becomes a pan, plus
      // the bar width so we can convert px deltas to seconds 1:1.
      panAnchorStart.current = anchorRef.current;
      barRectW.current = el.getBoundingClientRect().width;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (touchEnded.current) return;
      if (touchStartX.current === null || touchStartY.current === null) return;
      const dx = e.touches[0].clientX - touchStartX.current;
      const dy = e.touches[0].clientY - touchStartY.current;
      const ax = Math.abs(dx);
      const ay = Math.abs(dy);

      if (!panning.current) {
        if (ax <= SWIPE_DECIDE_PX && ay <= SWIPE_DECIDE_PX) return;
        if (ax > ay) {
          // Clearly horizontal: claim the gesture so the page never moves.
          e.preventDefault();
          panning.current = true;
          isPanningRef.current = true;
        } else {
          // Clearly vertical: hand the gesture back to the browser.
          touchEnded.current = true;
          return;
        }
      }

      // Continuous 1:1 pan: dragging by one bar pixel moves the window start by
      // windowLen/barWidth seconds in the opposite direction, so the audio that
      // sits under the finger stays under the finger while dragging.
      const secPerPx = (windowLenRef.current || WINDOW_SECONDS) / (barRectW.current || 1);
      const maxStart = Math.max(0, durationRef.current - WINDOW_SECONDS);
      const target = panAnchorStart.current - dx * secPerPx;
      setAnchorStartSec(Math.max(0, Math.min(target, maxStart)));
    };

    const onTouchEnd = () => {
      const wasPan = panning.current;
      isPanningRef.current = false;

      // Snap the window so its left edge lands in the middle of the nearest
      // sector, instead of wherever the finger stopped mid-silence.
      if (wasPan) {
        const sectors = sectorsRef.current;
        if (sectors.length > 0) {
          const now = anchorRef.current;
          let best = 0;
          let bestDist = Infinity;
          for (let i = 0; i < sectors.length; i++) {
            const d = Math.abs(sectors[i].start - now);
            if (d < bestDist) {
              bestDist = d;
              best = i;
            }
          }
          const durMax = Math.max(0, durationRef.current - WINDOW_SECONDS);
          const s = sectors[best];
          if (s) {
            navIndexRef.current = best;
            setActiveSector(best);
            setAnchorStartSec(Math.max(0, Math.min(s.start, durMax)));
          }
        }
      }
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
          {(waveformStatus === "loading" || waveformStatus === "idle") && (
            <div className="waveform-loading">Loading waveform…</div>
          )}
          {waveformStatus === "error" && (
            <div className="waveform-loading waveform-loading--error">Waveform unavailable</div>
          )}
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
            <div className="sector-merge__stepper">
              <button
                type="button"
                aria-label="Increase merge gap"
                title="Fewer sectors"
                disabled={mergeGap >= gapValues[gapValues.length - 1]}
                onClick={() => {
                  const i = gapValues.indexOf(mergeGap);
                  const next = gapValues[i >= 0 && i < gapValues.length - 1 ? i + 1 : gapValues.length - 1];
                  if (next !== undefined) {
                    setMergeGap(next);
                    setSliderValue(next);
                  }
                }}
              >
                -
              </button>
              <div className="sector-merge__slider" ref={sliderWrapRef}>
                <span
                  className="sector-merge__bubble"
                  style={{ left: `${bubbleLeft}px` }}
                  title="Sectors separated by a silent gap up to this long are merged into one"
                >
                  {displaySectors.length} {displaySectors.length === 1 ? "sector" : "sectors"}
                </span>
                <input
                  type="range"
                  min={gapValues[0]}
                  max={gapValues[gapValues.length - 1]}
                  step={0.005}
                  value={sliderValue}
                  title={`sectors separated less than ${sliderValue.toFixed(2)}s are combined into one`}
                  onChange={(e) => {
                    const raw = parseFloat(e.target.value);
                    setSliderValue(raw);
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
              </div>
              <button
                type="button"
                aria-label="Decrease merge gap"
                title="more sectors"
                disabled={mergeGap <= gapValues[0]}
                onClick={() => {
                  const i = gapValues.indexOf(mergeGap);
                  const next = gapValues[i > 0 ? i - 1 : 0];
                  if (next !== undefined) {
                    setMergeGap(next);
                    setSliderValue(next);
                  }
                }}
              >
                +
              </button>
            </div>
          </div>
          <div className="sector-reps" title={`Repeat ${repetitions} times when you click a sector`}>
            <span className="sector-reps__label">Repeat:</span>
            <div className="sector-reps__stepper">
              <button
                type="button"
                aria-label="Decrease repeats"
                title="Play each sector fewer times"
                onClick={() => setRepetitions((r) => Math.max(1, r - 1))}
              >
                −
              </button>
              <span className="sector-reps__value">{repetitions}</span>
              <button
                type="button"
                aria-label="Increase repeats"
                title="Play each sector more times"
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
