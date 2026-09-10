import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { RowWaveform } from "./RowWaveform";
import { Clip } from "./Clip";
import { WaveformBars } from "./Waveform";
import { type WaveformData, type WaveformStatus } from "../hooks/useWaveform";
import { type WaveformView } from "../hooks/useConfig";
import { splitBySilence, mergeClipsByGap, clipGaps, MERGE_GAP_SEC } from "../utils/clips";
import type { Clip as ClipType } from "../utils/clips";

interface ProgressBarProps {
  currentTime: number;
  onSeek: (time: number) => void;
  waveform: WaveformData | null;
  waveformStatus: WaveformStatus;
  onPlayRange: (start: number, end: number, repetitions: number, onComplete?: () => void) => void;
  onClipActiveChange?: (idx: number) => void;
  onClipPlayActiveChange?: (active: boolean) => void;
  onWaveformScrollChange?: (scrolling: boolean) => void;
  onToolbarActiveChange?: (active: boolean) => void;
  clipToolbarRef?: React.RefObject<HTMLDivElement | null>;
  waveformView?: WaveformView;
  onWaveformViewChange?: (value: WaveformView) => void;
  getAnalyser?: () => AnalyserNode | null;
  getCurrentTime?: () => number;
  playing?: boolean;
}

const STACK_ROW_TARGET_SECS = 10;
const VB_W = 1000;
const VB_H = 200;
const PAD = 4;

const formatTime = (sec: number) => {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}:${(m % 60).toString().padStart(2, "0")}:${r.toString().padStart(2, "0")}`;
  return `${m}:${r.toString().padStart(2, "0")}`;
};

export function ProgressBar({ currentTime, onSeek, waveform, waveformStatus, onPlayRange, onClipActiveChange, onClipPlayActiveChange, onWaveformScrollChange, onToolbarActiveChange, clipToolbarRef, waveformView = "stacked", onWaveformViewChange, getAnalyser, getCurrentTime, playing = false }: ProgressBarProps) {
  const hasWaveform = waveform !== null && waveform.data.length > 0;
  const clips = useMemo(
    () => splitBySilence(waveform?.data ?? null, waveform?.sampleRate ?? 0),
    [waveform],
  );

  const [activeClip, setActiveClip] = useState<number>(-1);
  const [mergeGap, setMergeGap] = useState(MERGE_GAP_SEC);
  const [sliderValue, setSliderValue] = useState(MERGE_GAP_SEC);
  const [repetitions, setRepetitions] = useState(3);

  const gapValues = useMemo(() => clipGaps(clips), [clips]);
  const displayClips = useMemo(
    () => mergeClipsByGap(clips, mergeGap),
    [clips, mergeGap],
  );
  const gapMin = gapValues.length > 0 ? gapValues[0] : 0;
  const gapMax = gapValues.length > 0 ? gapValues[gapValues.length - 1] : 0;
  const mergePct =
    gapMax > gapMin ? Math.min(1, Math.max(0, (sliderValue - gapMin) / (gapMax - gapMin))) : 0;

  type StackedRow = { start: number; end: number; clips: { clip: ClipType; idx: number }[] };
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

  // Stacked view auto-scroll.
  const stackedContainerRef = useRef<HTMLDivElement>(null);
  const stackedCursorRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const stackedTimeRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const activeRowIdx = stackedRows.findIndex((r) => currentTime >= r.start && currentTime <= r.end);
  useEffect(() => {
    if (waveformView !== "stacked") return;
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
  }, [activeRowIdx, waveformView]);

  // Stacked view cursor rAF.
  useEffect(() => {
    if (waveformView !== "stacked") return;
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
  }, [waveformView, getCurrentTime, stackedRows]);

  // Toolbar portal.
  const [toolbarTarget, setToolbarTarget] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    setToolbarTarget(clipToolbarRef?.current ?? null);
  }, [clipToolbarRef]);

  const [clipPlayActive, setClipPlayActive] = useState(false);
  useEffect(() => {
    onClipPlayActiveChange?.(clipPlayActive);
  }, [clipPlayActive, onClipPlayActiveChange]);

  useEffect(() => {
    onClipActiveChange?.(activeClip);
  }, [activeClip, onClipActiveChange]);

  // Scroll/toolbar state shared with RowWaveform.
  const [scrolling, setScrolling] = useState(false);
  const [toolbarActive, setToolbarActive] = useState(false);
  const scrollTimeoutRef = useRef<number | undefined>(undefined);
  const toolbarIdleRef = useRef<number | undefined>(undefined);
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

  // Slider metrics.
  const sliderWrapRef = useRef<HTMLDivElement>(null);
  const [sliderMetrics, setSliderMetrics] = useState({ width: 200, thumbW: 10 });
  const toolbarShown = toolbarTarget && gapValues.length > 0;
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
  const bubbleLeft =
    sliderMetrics.width -
    (sliderMetrics.thumbW / 2 + (sliderMetrics.width - sliderMetrics.thumbW) * mergePct);

  const innerH = VB_H - PAD * 2;

  const stackedPlayClip = useCallback(
    (start: number, end: number, reps: number) => {
      setClipPlayActive(true);
      onPlayRange(start, end, reps, () => setClipPlayActive(false));
    },
    [onPlayRange],
  );

  return (
    <div className="progress-container">
      <label className="view-switcher" title={waveformView === "stacked" ? "Show waveform as one row" : "Show waveform as stacked rows"}>
        <input
          type="checkbox"
          className="view-switcher__input"
          checked={waveformView === "horizontal"}
          onChange={(e) => onWaveformViewChange?.(e.target.checked ? "horizontal" : "stacked")}
        />
        <span className="view-switcher__track">
          <span className="view-switcher__thumb" />
        </span>
      </label>
      <div className={`progress-row ${waveformView === "horizontal" ? "progress-row--horizontal" : ""}`}>
        {waveformStatus === "loading" || waveformStatus === "idle" ? (
          <div className="waveform-loading waveform-loading--stacked">Loading waveform…</div>
        ) : waveformStatus === "error" ? (
          <div className="waveform-loading waveform-loading--error waveform-loading--stacked">
            Waveform unavailable
          </div>
        ) : hasWaveform && waveformView === "horizontal" ? (
          <RowWaveform
            waveform={waveform!}
            displayClips={displayClips}
            currentTime={currentTime}
            onSeek={onSeek}
            onPlayRange={onPlayRange}
            onClipPlayActiveChange={onClipPlayActiveChange}
            repetitions={repetitions}
            activeClip={activeClip}
            onActiveClipChange={setActiveClip}
            getAnalyser={getAnalyser}
            getCurrentTime={getCurrentTime}
            playing={playing}
            scrolling={scrolling}
            setScrolling={setScrolling}
            scrollTimeoutRef={scrollTimeoutRef}
            keepToolbarShown={keepToolbarShown}
          />
        ) : hasWaveform && waveformView === "stacked" ? (
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
                      setActiveClip(-1);
                      keepToolbarShown();
                    }}
                  >
                    <svg
                      className="stacked-waveform__svg"
                      viewBox={`0 0 ${VB_W} ${VB_H}`}
                      preserveAspectRatio="none"
                    >
                      <WaveformBars
                        data={waveform!.data}
                        sampleRate={waveform!.sampleRate}
                        windowStartSec={rowStart}
                        windowLen={rowLen}
                        innerH={innerH}
                        vbW={VB_W}
                        vbH={VB_H}
                        fracPlayed={rowFrac}
                        idPrefix={`stack-${r}`}
                      />
                      <Clip
                        clips={displayClips}
                        windowStartSec={rowStart}
                        windowLen={rowLen}
                        innerH={innerH}
                        vbW={VB_W}
                        vbH={VB_H}
                        onPlayRange={stackedPlayClip}
                        repetitions={repetitions}
                        activeClip={activeClip}
                        onActivate={(idx) => {
                          setActiveClip(idx);
                        }}
                      />
                    </svg>
                    <span
                      className="stacked-waveform__cursor"
                      ref={(el) => {
                        stackedCursorRefs.current[r] = el;
                      }}
                      style={{ left: `${(rowFrac) * 100}%` }}
                    />
                    <span
                      className="stacked-waveform__time"
                      ref={(el) => {
                        stackedTimeRefs.current[r] = el;
                      }}
                      style={{ left: `${Math.max(4, Math.min(96, rowFrac * 100))}%` }}
                    >
                      {formatTime(currentTime)}
                    </span>
                    {row.clips.map(({ clip: s, idx }) => {
                      const center = ((s.start + (s.end - s.start) / 2) - rowStart) / rowLen * 100;
                      const clamped = Math.max(5, Math.min(95, center));
                      return (
                        <span
                          key={`lbl-${idx}`}
                          className={`stacked-clip-label ${idx === activeClip ? "stacked-clip-label--active" : ""}`}
                          style={{ left: `${clamped}%` }}
                        >
                          {idx + 1}
                          <span className="stacked-clip-dur">{(s.end - s.start).toFixed(1)}s</span>
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
            className="clip-toolbar"
            onPointerDown={keepToolbarShown}
            onKeyDown={keepToolbarShown}
          >
          <div className="clip-merge">
            <div className="clip-merge__stepper">
              <button
                type="button"
                aria-label="Increase merge gap"
                title="Fewer clips"
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
              <div className="clip-merge__slider" ref={sliderWrapRef}>
                <span
                  className="clip-merge__bubble"
                  style={{ left: `${bubbleLeft}px` }}
                  title="Clips separated by a silent gap up to this long are merged into one"
                >
                  {displayClips.length} {displayClips.length === 1 ? "clip" : "clips"}
                </span>
                <input
                  type="range"
                  min={gapValues[0]}
                  max={gapValues[gapValues.length - 1]}
                  step={0.005}
                  value={sliderValue}
                  title={`clips separated less than ${sliderValue.toFixed(2)}s are combined into one`}
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
                title="more clips"
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
          <div className="clip-reps" title={`Repeat ${repetitions} times when you click a clip`}>
            <span className="clip-reps__label">Repeat:</span>
            <div className="clip-reps__stepper">
              <button
                type="button"
                aria-label="Decrease repeats"
                title="Play each clip fewer times"
                onClick={() => setRepetitions((r) => Math.max(1, r - 1))}
              >
                −
              </button>
              <span className="clip-reps__value">{repetitions}</span>
              <button
                type="button"
                aria-label="Increase repeats"
                title="Play each clip more times"
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
