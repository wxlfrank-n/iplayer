import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { Sector } from "./Sector";
import { WaveformBars } from "./Waveform";
import { type WaveformData, type WaveformStatus } from "../hooks/useWaveform";
import { splitBySilence, mergeSectorsByGap, sectorGaps, MERGE_GAP_SEC } from "../utils/sectors";
import type { Sector as SectorData } from "../utils/sectors";

interface ProgressBarProps {
  currentTime: number;
  onSeek: (time: number) => void;
  waveform: WaveformData | null;
  waveformStatus: WaveformStatus;
  onPlayRange: (start: number, end: number, repetitions: number, onComplete?: () => void) => void;
  onSectorActiveChange?: (idx: number) => void;
  onSectorPlayActiveChange?: (active: boolean) => void;
  onWaveformScrollChange?: (scrolling: boolean) => void;
  onToolbarActiveChange?: (active: boolean) => void;
  sectorToolbarRef?: React.RefObject<HTMLDivElement | null>;
}

// Sectors are packed into wrapped rows that span the full track — each row aims
// for roughly this many seconds but never splits a sector across rows.
const STACK_ROW_TARGET_SECS = 10;
const VB_W = 1000;
const VB_H = 200;
const PAD = 4;

export function ProgressBar({ currentTime, onSeek, waveform, waveformStatus, onPlayRange, onSectorActiveChange, onSectorPlayActiveChange, onWaveformScrollChange, onToolbarActiveChange, sectorToolbarRef }: ProgressBarProps) {
  const hasWaveform = waveform !== null && waveform.data.length > 0;
  const sectors = useMemo(
    () => splitBySilence(waveform?.data ?? null, waveform?.sampleRate ?? 0),
    [waveform],
  );

  const [activeSector, setActiveSector] = useState<number>(-1);
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

  // Pack sectors into stacked rows for small screens: each row holds whole
  // sectors totalling ~STACK_ROW_TARGET_SECS (variable length, and a sector is
  // never split across two rows).
  type StackedRow = { start: number; end: number; sectors: { sector: SectorData; idx: number }[] };
  const stackedRows = useMemo<StackedRow[]>(() => {
    const rows: StackedRow[] = [];
    let cur: StackedRow | null = null;
    displaySectors.forEach((s, idx) => {
      const dur = s.end - s.start;
      if (!cur || dur + (cur.end - cur.start) <= STACK_ROW_TARGET_SECS) {
        if (!cur) cur = { start: s.start, end: s.end, sectors: [] };
        cur.end = s.end;
        cur.sectors.push({ sector: s, idx });
      } else {
        rows.push(cur);
        cur = { start: s.start, end: s.end, sectors: [{ sector: s, idx }] };
      }
    });
    if (cur) rows.push(cur);
    return rows;
  }, [displaySectors]);

  // Auto-scroll the stacked waveform so the row currently playing is never
  // half-covered or below the visible window. Fires only when that row index
  // changes, so it does not fight the user while scrolling inside a row.
  const stackedContainerRef = useRef<HTMLDivElement>(null);
  const activeRowIdx = stackedRows.findIndex((r) => currentTime >= r.start && currentTime <= r.end);
  useEffect(() => {
    // The `.progress-container` is the single scrollable region (the player-card
    // middle section); scroll it so the row being played is fully visible.
    const scrollEl = stackedContainerRef.current?.closest(".progress-container") ?? null;
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

  // The merge/repeat toolbar is portaled into the `.sector-toolbar-slot` in the
  // player bottom (the same place the traditional progress bar occupies) and is
  // shown only while a sector is selected.
  const [toolbarTarget, setToolbarTarget] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    setToolbarTarget(sectorToolbarRef?.current ?? null);
  }, [sectorToolbarRef]);

  // Whether a sector is currently being played back (started but not yet
  // finished). The selected sector itself is kept after playback completes so
  // its highlight stays visible; only the toolbar reverts to the traditional
  // progress bar.
  const [sectorPlayActive, setSectorPlayActive] = useState(false);

  useEffect(() => {
    onSectorPlayActiveChange?.(sectorPlayActive);
  }, [sectorPlayActive, onSectorPlayActiveChange]);

  // Also show the toolbar while the stacked waveform is being scrolled so the
  // merge/gap controls are reachable during scrubbing, and stay visible while
  // the user is actually operating the controls. It only hides after the last
  // interaction/scroll goes idle (or immediately if a sector is not playing).
  const [scrolling, setScrolling] = useState(false);
  const [toolbarActive, setToolbarActive] = useState(false);
  const scrollTimeoutRef = useRef<number | undefined>(undefined);
  const toolbarIdleRef = useRef<number | undefined>(undefined);
  // Auto-scroll (following the current row) also fires scroll events; those are
  // programmatic, so they must not be treated as the user scrolling (which
  // would flash the toolbar on every row boundary during playback).
  const autoScrollPendingRef = useRef(false);
  const keepToolbarShown = useCallback(() => {
    setToolbarActive(true);
    window.clearTimeout(toolbarIdleRef.current);
    toolbarIdleRef.current = window.setTimeout(() => setToolbarActive(false), 2000);
  }, []);
  useEffect(() => {
    onWaveformScrollChange?.(scrolling);
  }, [scrolling, onWaveformScrollChange]);
  useEffect(() => {
    onToolbarActiveChange?.(toolbarActive);
  }, [toolbarActive, onToolbarActiveChange]);
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
      scrollTimeoutRef.current = window.setTimeout(() => setScrolling(false), 1500);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.clearTimeout(scrollTimeoutRef.current);
    };
  }, [waveform]);

  // Slider geometry (width + thumb size) so the value bubble can be placed
  // exactly over the thumb center in pixels (calc() cannot multiply lengths,
  // so the position is computed here instead of in CSS). Must re-measure every
  // time the toolbar becomes visible — the toolbar element does not exist at
  // mount, so a one-time measurement would keep the default (wrong) width.
  const sliderWrapRef = useRef<HTMLDivElement>(null);
  const [sliderMetrics, setSliderMetrics] = useState({ width: 200, thumbW: 10 });
  const toolbarShown = toolbarTarget && (sectorPlayActive || scrolling || toolbarActive) && gapValues.length > 0;
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
  }, [toolbarShown]);
  // Slider is mirrored (max on the left, min on the right), so the bubble sits
  // at the mirrored position of the thumb center.
  const bubbleLeft =
    sliderMetrics.width -
    (sliderMetrics.thumbW / 2 + (sliderMetrics.width - sliderMetrics.thumbW) * mergePct);

  const innerH = VB_H - PAD * 2;

  // Cursor for keyboard navigation; kept in sync with the sector activation.
  const navIndexRef = useRef(-1);

  const playSector = useCallback(
    (start: number, end: number, reps: number) => {
      setSectorPlayActive(true);
      onPlayRange(start, end, reps, () => setSectorPlayActive(false));
    },
    [onPlayRange],
  );

  useEffect(() => {
    onSectorActiveChange?.(activeSector);
  }, [activeSector, onSectorActiveChange]);

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
        if (s) playSector(s.start, s.end, repetitions);
        return next;
      });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
}, [displaySectors, onPlayRange, repetitions, playSector]);

  return (
    <div className="progress-container">
      <div className="progress-row">
        {waveformStatus === "loading" || waveformStatus === "idle" ? (
          <div className="waveform-loading waveform-loading--stacked">Loading waveform…</div>
        ) : waveformStatus === "error" ? (
          <div className="waveform-loading waveform-loading--error waveform-loading--stacked">
            Waveform unavailable
          </div>
        ) : hasWaveform ? (
          <div className="stacked-waveform" ref={stackedContainerRef}>
            {stackedRows.map((row, r) => {
              const rowStart = row.start;
              const rowLen = Math.max(0, row.end - row.start);
              if (rowLen <= 0) return null;
              const rowFrac = Math.max(0, Math.min(1, (currentTime - rowStart) / rowLen));
              return (
                <div
                    key={r}
                    className="stacked-waveform__row"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const f = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                      onSeek(rowStart + f * rowLen);
                      setActiveSector(-1);
                      navIndexRef.current = -1;
                      keepToolbarShown();
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
                        windowStartSec={rowStart}
                        windowLen={rowLen}
                        innerH={innerH}
                        vbW={VB_W}
                        vbH={VB_H}
                        fracPlayed={rowFrac}
                        idPrefix={`stack-${r}`}
                      />
                      <Sector
                        sectors={displaySectors}
                        windowStartSec={rowStart}
                        windowLen={rowLen}
                        innerH={innerH}
                        vbW={VB_W}
                        vbH={VB_H}
                        onPlayRange={playSector}
                        repetitions={repetitions}
                        activeSector={activeSector}
                        onActivate={(idx) => {
                          setActiveSector(idx);
                          navIndexRef.current = idx;
                        }}
                      />
                    </svg>
                    {currentTime >= rowStart && currentTime <= row.end && (
                      <span
                        className="stacked-waveform__cursor"
                        style={{
                          left: `${(currentTime - rowStart) / rowLen * 100}%`,
                          top: `${(VB_H / 2 - innerH / 4) / VB_H  * 100}%`,
                          height: `${(innerH / 2) / VB_H * 100}%`,
                        }}
                      />
                    )}
                    {row.sectors.map(({ sector: s, idx }) => {
                      const center = ((s.start + (s.end - s.start) / 2) - rowStart) / rowLen * 100;
                      const clamped = Math.max(5, Math.min(95, center));
                      return (
                        <span
                          key={`lbl-${idx}`}
                          className={`stacked-sector-label ${idx === activeSector ? "stacked-sector-label--active" : ""}`}
                          style={{ left: `${clamped}%` }}
                        >
                          {idx + 1}
                          <span className="stacked-sector-dur">{(s.end - s.start).toFixed(1)}s</span>
                        </span>
                      );
                    })}
                  </div>
                );
              })}
</div>
            ) : null}
</div>
      {toolbarShown &&
        createPortal(
<div
            className="sector-toolbar"
            onPointerDown={keepToolbarShown}
            onKeyDown={keepToolbarShown}
          >
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
                  onInput={keepToolbarShown}
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
        </div>,
          toolbarTarget,
        )}
    </div>
  );
}
