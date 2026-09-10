import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { Sector } from "./Sector";
import { WaveformBars } from "./Waveform";
import { type WaveformData, type WaveformStatus } from "../hooks/useWaveform";
import { type WaveformView } from "../hooks/useConfig";
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
  waveformView?: WaveformView;
  onWaveformViewChange?: (value: WaveformView) => void;
  getAnalyser?: () => AnalyserNode | null;
  getCurrentTime?: () => number;
  playing?: boolean;
}

// Sectors are packed into wrapped rows that span the full track — each row aims
// for roughly this many seconds but never splits a sector across rows.
const STACK_ROW_TARGET_SECS = 10;
// Window width (seconds) of the single-row ("horizontal") view.
const HS_WINDOW_SECS = 8;
// While playing, the playhead is kept at this fraction of the window so the
// strip glides along with the music instead of paging when it exits.
const HS_FOLLOW_FRAC = 0.6;
const HS_PAN_DECIDE_PX = 8;
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

export function ProgressBar({ currentTime, onSeek, waveform, waveformStatus, onPlayRange, onSectorActiveChange, onSectorPlayActiveChange, onWaveformScrollChange, onToolbarActiveChange, sectorToolbarRef, waveformView = "stacked", onWaveformViewChange, getAnalyser, getCurrentTime, playing = false }: ProgressBarProps) {
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
  const stackedCursorRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const stackedTimeRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const activeRowIdx = stackedRows.findIndex((r) => currentTime >= r.start && currentTime <= r.end);
  useEffect(() => {
    if (waveformView !== "stacked") return;
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
  }, [activeRowIdx, waveformView]);

  // Drive the stacked playhead from the audio clock every frame (same smooth
  // behavior as the row view) instead of the coarse timeupdate ticks. Each
  // frame the cursor lands in whichever row contains the playhead and slides
  // within it; cursors in other rows stay hidden.
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

  // Single-row ("horizontal") view: instead of squeezing the whole track into
  // one fixed row, a fixed-duration window is shown and the user pans (drag or
  // wheel) to scroll the window across the track and navigate sectors.
  const hsRef = useRef<HTMLDivElement>(null);
  const totalDuration = sectors.length > 0 ? sectors[sectors.length - 1].end : 1;
  const hsWinLen = Math.min(HS_WINDOW_SECS, totalDuration);
  const hsMaxStart = Math.max(0, totalDuration - hsWinLen);
  const [hsAnchor, setHsAnchor] = useState(0);
  const hsAnchorRef = useRef(0);
  useEffect(() => {
    hsAnchorRef.current = hsAnchor;
    hsSmoothRef.current = hsAnchor;
  }, [hsAnchor]);

  // Auto-follow the playhead across the window: while playback is active the
// window glides so the playhead stays at the follow fraction, showing what is
// being played as time advances. Skipped while the user is panning.
useEffect(() => {
    if (waveformView !== "horizontal") return;
    if (scrolling) return;
    if (!playing) return;
    const target = Math.max(0, Math.min(currentTime - HS_FOLLOW_FRAC * hsWinLen, hsMaxStart));
    const id = requestAnimationFrame(() => {
      setHsAnchor((a) => (Math.abs(target - a) > 0.05 ? target : a));
    });
    return () => cancelAnimationFrame(id);
  }, [currentTime, hsWinLen, hsMaxStart, waveformView, scrolling, playing]);

  // When a sector is selected via keyboard, reveal it by panning the window so
  // the sector is fully inside if it was off-screen. (Click with the pointer
  // only ever selects a sector that is already visible in the window.)
  const revealSector = useCallback(
    (s: SectorData) => {
      if (waveformView !== "horizontal") return;
      if (s.start < hsAnchorRef.current || s.end > hsAnchorRef.current + hsWinLen) {
        setHsAnchor(Math.max(0, Math.min(s.start, hsMaxStart)));
      }
    },
    [waveformView, hsWinLen, hsMaxStart],
  );

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
        if (s) {
          playSector(s.start, s.end, repetitions);
          revealSector(s);
        }
        return next;
      });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [displaySectors, onPlayRange, repetitions, playSector, revealSector]);

  // Live values for gesture handlers attached once in an effect.
  const hsWinLenRef = useRef(hsWinLen);
  const hsMaxStartRef = useRef(hsMaxStart);
  const sectorsRef = useRef(displaySectors);
  useEffect(() => {
    hsWinLenRef.current = hsWinLen;
  }, [hsWinLen]);
  useEffect(() => {
    hsMaxStartRef.current = hsMaxStart;
  }, [hsMaxStart]);
  useEffect(() => {
    sectorsRef.current = displaySectors;
  }, [displaySectors]);

  // Panning state: drag start info plus a flag the click handler uses to drop
  // the click that naturally follows a drag.
  const hsDragRef = useRef<{ pointerId: number; startX: number; startAnchor: number; panned: boolean } | null>(null);
  const hsSuppressClickRef = useRef(false);
  const bumpScrolling = useCallback(() => {
    setScrolling(true);
    window.clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = window.setTimeout(() => setScrolling(false), 1500);
  }, []);

  // Wheel pan: continuous 1:1 mapping of the wheel delta to seconds, so
  // scrolling moves the window as if dragging it.
  useEffect(() => {
    if (waveformView !== "horizontal") return;
    const el = hsRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const elNow = hsRef.current;
      if (!elNow) return;
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      const scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1;
      const dSec = Math.max(-2, Math.min(2, (delta * scale) / (elNow.clientWidth || 1) * (hsWinLenRef.current || 1)));
      setHsAnchor((a) => Math.max(0, Math.min(a + dSec, hsMaxStartRef.current)));
      bumpScrolling();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [waveformView, bumpScrolling]);

  // Dancing lines in the single-row view: read the analyser's frequency data
  // every frame and draw a soft equalizer strip on top of the sector line.
  // Always visible — flat baseline bars when idle, dancing while playing.
  const danceCanvasRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);
  const timeLabelRef = useRef<HTMLSpanElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const hsSmoothRef = useRef(0);
  useEffect(() => {
    if (waveformView !== "horizontal") return;
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

      // Glide the playhead smoothly: the rendered window only rebases on the
      // coarse ~250ms timeupdate ticks, so between rebases we shift the whole
      // track by a sub-render horizontal offset to keep the playhead exactly on
      // the audio clock every frame instead of jumping.
      const innerEl = canvas.parentElement;
      const track = trackRef.current;
      if (innerEl && track && getCurrentTime) {
        const t = getCurrentTime();
        const win = hsWinLenRef.current || 1;
        const s =
          playing && !scrolling
            ? Math.max(0, Math.min(t - HS_FOLLOW_FRAC * win, hsMaxStartRef.current))
            : hsAnchorRef.current;
        hsSmoothRef.current = s;
        const pxPerSec = (innerEl.clientWidth || 1) / win;
        track.style.transform = `translateX(${(-(s - hsAnchorRef.current) * pxPerSec).toFixed(2)}px)`;
        const cur = cursorRef.current;
        if (cur) cur.style.left = `${(((t - s) / win) * 100).toFixed(3)}%`;
        const timeLabel = timeLabelRef.current;
        if (timeLabel) {
          timeLabel.textContent = formatTime(t);
          timeLabel.style.left = `${Math.max(4, Math.min(96, ((t - s) / win) * 100)).toFixed(2)}%`;
        }
      }

      const analyser = getAnalyser ? getAnalyser() : null;
      const len = analyser ? analyser.frequencyBinCount : 0;
      if (analyser) {
        if (data.length !== len) data = new Uint8Array(len);
        analyser.getByteFrequencyData(data);
      }

      if (!color) {
        const v = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
        color = v || "#58a6ff";
      }
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = color;
      const bw = rect.width / N;
      const base = rect.height - 4;
      const maxH = rect.height - 8;
      for (let i = 0; i < N; i++) {
        const bin = len > 0 ? Math.min(len - 1, Math.floor((1 - Math.pow(1 - i / N, 1.5)) * (len - 1))) : 0;
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
  }, [waveformView, getAnalyser, getCurrentTime, playing, scrolling]);

  const onHsPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    if (hsDragRef.current) return;
    const el = e.currentTarget;
    const drag = { pointerId: e.pointerId, startX: e.clientX, startAnchor: hsAnchorRef.current, panned: false };
    hsDragRef.current = drag;

    // Drag tracking happens on the window (no pointer capture, which would
    // retarget the trailing click away from the sector rect and break clicks).
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
      // Sitting in the middle of silence after a drag is annoying, so snap the
      // window's left edge to the nearest sector start.
      hsSuppressClickRef.current = true;
      const sectors = sectorsRef.current;
      if (sectors.length === 0) return;
      const now = hsAnchorRef.current;
      let best = 0;
      let bestDist = Infinity;
      for (let i = 0; i < sectors.length; i++) {
        const d = Math.abs(sectors[i].start - now);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      setHsAnchor(Math.max(0, Math.min(sectors[best].start, hsMaxStartRef.current)));
      setActiveSector(best);
      navIndexRef.current = best;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
    bumpScrolling();
  };

  const hsFrac = hsWinLen > 0 ? Math.max(0, Math.min(1, (currentTime - hsAnchor) / hsWinLen)) : 0;

  return (
    <div className="progress-container">
      <button
        type="button"
        className="waveview-switcher"
        title={waveformView === "stacked" ? "Show waveform as one row" : "Show waveform as stacked rows"}
        aria-label="Switch waveform view"
        onClick={() => onWaveformViewChange?.(waveformView === "stacked" ? "horizontal" : "stacked")}
      >
        {waveformView === "stacked" ? (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M4 12h16" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>
      <div className={`progress-row ${waveformView === "horizontal" ? "progress-row--horizontal" : ""}`}>
        {waveformStatus === "loading" || waveformStatus === "idle" ? (
          <div className="waveform-loading waveform-loading--stacked">Loading waveform…</div>
        ) : waveformStatus === "error" ? (
          <div className="waveform-loading waveform-loading--error waveform-loading--stacked">
            Waveform unavailable
          </div>
        ) : hasWaveform && waveformView === "horizontal" ? (
          <div
            className="waveform-hs"
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
              className="waveform-hs__inner"
              onClick={(e) => {
                if (hsSuppressClickRef.current) {
                  hsSuppressClickRef.current = false;
                  return;
                }
                const rect = e.currentTarget.getBoundingClientRect();
                const f = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                onSeek(hsSmoothRef.current + f * hsWinLen);
                setActiveSector(-1);
                navIndexRef.current = -1;
                keepToolbarShown();
              }}
            >
              <canvas className="waveform-hs__dance" ref={danceCanvasRef} />
              <div className="waveform-hs__track" ref={trackRef}>
              <svg
                className="waveform-hs__svg"
                viewBox={`0 0 ${VB_W} ${VB_H}`}
                preserveAspectRatio="none"
              >
                <WaveformBars
                  data={waveform.data}
                  sampleRate={waveform.sampleRate}
                  windowStartSec={hsAnchor}
                  windowLen={hsWinLen}
                  innerH={innerH}
                  vbW={VB_W}
                  vbH={VB_H}
                  fracPlayed={hsFrac}
                  idPrefix="hs"
                  strokeWidth={1.6}
                />
                <Sector
                  sectors={displaySectors}
                  windowStartSec={hsAnchor}
                  windowLen={hsWinLen}
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
              <span
                className="waveform-hs__cursor"
                ref={cursorRef}
                style={{ left: `${hsFrac * 100}%` }}
              />
              <span
                className="waveform-hs__time"
                ref={timeLabelRef}
                style={{ left: `${Math.max(4, Math.min(96, hsFrac * 100))}%` }}
              >
                {formatTime(currentTime)}
              </span>
              {displaySectors.map((s, idx) => {
                if (s.end <= hsAnchor || s.start >= hsAnchor + hsWinLen) return null;
                const center = ((s.start + (s.end - s.start) / 2 - hsAnchor) / hsWinLen) * 100;
                const clamped = Math.max(0, Math.min(100, center));
                return (
                  <span
                    key={`hlbl-${idx}`}
                    className={`stacked-sector-label ${idx === activeSector ? "stacked-sector-label--active" : ""}`}
                    style={{ left: `${clamped}%` }}
                  >
                    {idx + 1}
                    <span className="stacked-sector-dur">{(s.end - s.start).toFixed(1)}s</span>
                  </span>
                );
              })}
            </div>
            </div>
          </div>
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
