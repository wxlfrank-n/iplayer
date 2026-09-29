import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Dispatch, RefObject, PointerEvent as ReactPointerEvent, SetStateAction } from "react";
import { clampWindowAnchor, getWindowSecs } from "../utils/rowWaveform";
import type { Clip } from "../utils/clips";
import { panTarget } from "../utils/pan";

const HS_FOLLOW_FRAC = 0.6;
const HS_PAN_DECIDE_PX = 8;
const CURSOR_CLICK_HOLD_MS = 400;
const VB_W = 500;
const VB_H = 100;
const PAD = 4;

export const BARS_TAIL_SEC = 0;

// Waveform virtualization. The visible viewport is one window; the rendered
// waveform buffer is three windows. It is rebuilt only when the viewport gets
// within 0.4 window of either buffer edge.
export const WAVE_BUFFER_WINDOWS = 3;
export const WAVE_BUFFER_MARGIN_WINDOWS = 0.4;

export interface UseRowWaveformScrollArgs {
  waveformDuration: number;
  displayClips: Clip[];
  currentTime: number;
  onSeek: (time: number) => void;
  onPlayRange: (
    start: number,
    end: number,
    repetitions: number,
    onComplete?: () => void,
  ) => void;
  repetitions: number;
  onStopPlayback?: () => void;
  activeClip: number;
  onActiveClipChange: (idx: number) => void;
  onSwipeClip?: (idx: number, direction: "up" | "down") => void;
  getCurrentTime: () => number;
  playing: boolean;
  scrolling: boolean;
  setScrolling: Dispatch<SetStateAction<boolean>>;
  scrollTimeoutRef: RefObject<number | undefined>;
  cursorElRef?: RefObject<HTMLDivElement | null>;
  playedElRef?: RefObject<HTMLDivElement | null>;
}

type FollowEpoch = {
  anchor: number;
  time: number;
  align: boolean;
};

type FollowMode =
  | { type: "follow"; epoch: FollowEpoch }
  | { type: "manual" }
  | { type: "cursor"; epoch: FollowEpoch; holdUntil: number }
  | {
    type: "clip";
    start: number;
    end: number;
    playbackStart: number;
    anchorStart: number;
    followEnd: number | null;
    userMoved: boolean;
  };

function makeFollowEpoch(anchor: number, windowLength: number, time: number): FollowEpoch {
  return {
    anchor,
    time,
    align: !(time > anchor && time <= anchor + windowLength),
  };
}

function resolveFollow(
  epoch: FollowEpoch,
  time: number,
  windowLength: number,
  maxStart: number,
): number {
  const target = epoch.align
    ? time - HS_FOLLOW_FRAC * windowLength
    : epoch.anchor + (time - epoch.time);
  return clampWindowAnchor(target, maxStart);
}

/**
 * Pure viewport policy. Events change FollowMode; this function is the only
 * place that decides where the visible window should be during animation.
 */
function resolveAnchor(
  mode: FollowMode,
  anchor: number,
  time: number,
  windowLength: number,
  maxStart: number,
  now: number,
): number {
  switch (mode.type) {
    case "manual":
      return anchor;

    case "cursor":
      return now < mode.holdUntil
        ? anchor
        : resolveFollow(mode.epoch, time, windowLength, maxStart);

    case "clip": {
      if (mode.userMoved || mode.followEnd == null) return anchor;
      if (anchor + windowLength >= mode.followEnd) return anchor;
      if (time < anchor || time > anchor + windowLength) return anchor;

      return clampWindowAnchor(
        Math.min(
          mode.anchorStart + (time - mode.playbackStart),
          Math.max(0, mode.followEnd - windowLength),
        ),
        maxStart,
      );
    }

    case "follow":
      return resolveFollow(mode.epoch, time, windowLength, maxStart);
  }
}

export function useRowWaveformScroll({
  waveformDuration,
  displayClips,
  currentTime,
  onSeek,
  onPlayRange,
  onActiveClipChange,
  getCurrentTime,
  playing,
  scrolling,
  setScrolling,
  scrollTimeoutRef,
  cursorElRef,
  playedElRef,
}: UseRowWaveformScrollArgs) {
  const innerH = VB_H - PAD * 2;
  const hsRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  // ---------------------------------------------------------------------------
  // Viewport model
  // ---------------------------------------------------------------------------
  const initialWidth =
    typeof window === "undefined"
      ? VB_W
      : window.innerWidth;

  const hsWinLenRef = useRef(
    Math.min(
      getWindowSecs(
        initialWidth,
        displayClips,
      ),
      waveformDuration,
    ),
  );
  const hsMaxStartRef = useRef(Math.max(0, waveformDuration - hsWinLenRef.current));

  // Two independent coordinate systems:
  // - viewportAnchorRef: what the user is looking at; changes every frame/pan.
  // - bufferAnchorRef: where the rendered waveform data starts; changes rarely.
  const viewportAnchorRef = useRef(0);
  const bufferAnchorRef = useRef(0);
  const pendingBufferAnchorRef = useRef<number | null>(null);
  const bufferLengthRef = useRef(
    Math.min(waveformDuration, hsWinLenRef.current * WAVE_BUFFER_WINDOWS),
  );
  const cursorLeftPctRef = useRef(0);

  // React only sees buffer changes. Components that generate bars should use
  // hsAnchor as the buffer start and bufferLengthRef as the rendered duration.
  const [renderedBufferAnchor, setRenderedBufferAnchor] = useState(0);

  const playingRef = useRef(playing);
  const draggingRef = useRef(false);
  const scrollingRef = useRef(scrolling);
  const previousTimeRef = useRef(currentTime);
  const suppressClickRef = useRef(false);

  const modeRef = useRef<FollowMode>(
    { type: "follow", epoch: makeFollowEpoch(0, hsWinLenRef.current, getCurrentTime()) },
  );

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    scrollingRef.current = scrolling;
  }, [scrolling]);

  const setModeFollow = useCallback((time = getCurrentTime()) => {
    modeRef.current = {
      type: "follow",
      epoch: makeFollowEpoch(viewportAnchorRef.current, hsWinLenRef.current, time),
    };
  }, [getCurrentTime]);

  const isTimeInViewport = useCallback((time: number) => {
    const start = viewportAnchorRef.current;
    const end = start + hsWinLenRef.current;
    return time >= start && time <= end;
  }, []);

  const calculateBufferStart = useCallback((viewportStart: number) => {
    const win = hsWinLenRef.current;
    const bufferLength = Math.min(waveformDuration, win * WAVE_BUFFER_WINDOWS);
    bufferLengthRef.current = bufferLength;

    // Keep one full viewport before the visible window when possible.
    const desired = viewportStart - win;
    const maxBufferStart = Math.max(0, waveformDuration - bufferLength);
    return Math.max(0, Math.min(desired, maxBufferStart));
  }, [waveformDuration]);

  const ensureWaveBuffer = useCallback((viewportStart: number, force = false) => {
    const win = hsWinLenRef.current;
    const viewportEnd = viewportStart + win;

    // A pending buffer is useful for deciding whether another request is needed,
    // but it must NOT become the coordinate origin until React commits it.
    const effectiveBufferStart =
      pendingBufferAnchorRef.current ?? bufferAnchorRef.current;
    const bufferEnd = effectiveBufferStart + bufferLengthRef.current;
    const margin = win * WAVE_BUFFER_MARGIN_WINDOWS;

    const nearLeftEdge =
      effectiveBufferStart > 0 &&
      viewportStart < effectiveBufferStart + margin;

    const nearRightEdge =
      bufferEnd < waveformDuration &&
      viewportEnd > bufferEnd - margin;

    if (!force && !nearLeftEdge && !nearRightEdge) return;

    const nextBufferStart = calculateBufferStart(viewportStart);

    if (Math.abs(nextBufferStart - effectiveBufferStart) < 1e-6) return;

    pendingBufferAnchorRef.current = nextBufferStart;

    setRenderedBufferAnchor((current) =>
      Math.abs(current - nextBufferStart) < 1e-6
        ? current
        : nextBufferStart,
    );
  }, [calculateBufferStart, waveformDuration]);

  /**
   * Moving the viewport is cheap: update one ref and translate the existing
   * waveform buffer. React is touched only when ensureWaveBuffer decides that
   * the pre-rendered buffer is too close to an edge.
   */
  const setLiveAnchor = useCallback((target: number, forceRedraw = false) => {
    const next = clampWindowAnchor(target, hsMaxStartRef.current);
    viewportAnchorRef.current = next;
    ensureWaveBuffer(next, forceRedraw);
  }, [ensureWaveBuffer]);

  const applyWidth = useCallback(
    (width: number) => {
      const nextWindowSecs = Math.min(
        getWindowSecs(
          width,
          displayClips,
        ),
        waveformDuration,
      );

      /*
       * Avoid rebuilding everything when the calculated
       * window length hasn't actually changed.
       */
      if (
        Math.abs(
          nextWindowSecs -
          hsWinLenRef.current,
        ) < 1e-6
      ) {
        return;
      }

      hsWinLenRef.current =
        nextWindowSecs;

      hsMaxStartRef.current =
        Math.max(
          0,
          waveformDuration -
          nextWindowSecs,
        );

      bufferLengthRef.current =
        Math.min(
          waveformDuration,
          nextWindowSecs *
          WAVE_BUFFER_WINDOWS,
        );

      /*
       * The old viewport anchor might no longer be valid
       * after zooming in/out.
       */
      const nextAnchor =
        clampWindowAnchor(
          viewportAnchorRef.current,
          hsMaxStartRef.current,
        );

      viewportAnchorRef.current =
        nextAnchor;

      /*
       * Window scale changed, so the existing waveform
       * buffer geometry is no longer valid.
       */
      setLiveAnchor(
        nextAnchor,
        true,
      );

      /*
       * Rebuild follow geometry using the new window size.
       */
      if (
        modeRef.current.type === "follow"
      ) {
        setModeFollow();
      }
    },
    [
      displayClips,
      setLiveAnchor,
      setModeFollow,
      waveformDuration,
    ],
  );

  useEffect(() => {
    const el = hsRef.current;

    const width =
      el?.clientWidth ||
      window.innerWidth;

    applyWidth(width);
  }, [displayClips, applyWidth]);

  useEffect(() => {
    const el = hsRef.current;
    const onResize = () => applyWidth(el?.clientWidth || window.innerWidth);

    window.addEventListener("resize", onResize);
    if (!el || typeof ResizeObserver === "undefined") {
      onResize();
      return () => window.removeEventListener("resize", onResize);
    }

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) applyWidth(entry.contentRect.width);
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, [applyWidth]);


  // ---------------------------------------------------------------------------
  // Renderer: no playback/follow policy lives here.
  // ---------------------------------------------------------------------------
  const renderFrame = useCallback((time: number, anchor: number) => {
    const track = trackRef.current;
    if (!track) return;

    const viewport = track.parentElement;
    if (!viewport) return;

    const win = hsWinLenRef.current || 1;
    const viewportWidthPx = viewport.clientWidth || 1;
    const pxPerSec = viewportWidthPx / win;

    const bufferStart = bufferAnchorRef.current;
    const bufferLen = bufferLengthRef.current || win;

    track.style.width = `${(bufferLen / win) * 100}%`;
    const trackX =
      -(anchor - bufferStart) * pxPerSec;

    track.style.transform =
      `translate3d(${trackX}px, 0, 0)`;

    // Played waveform represents the real playback position.
    const playheadFraction =
      bufferLen > 0 ? (time - bufferStart) / bufferLen : 0;
    const playheadPct = playheadFraction * 100;

    cursorLeftPctRef.current = playheadFraction;

    const played = playedElRef?.current;
    if (played) {
      const clampedPct = Math.max(0, Math.min(100, playheadPct));
      played.style.clipPath =
        `inset(0 ${(100 - clampedPct).toFixed(5)}% 0 0)`;
    }

    const cursor = cursorElRef?.current;
    if (!cursor) return;

    const viewportStart = anchor;
    const viewportEnd = Math.min(waveformDuration, anchor + win);

    let cursorTime = time;
    let cursorEdge: "left" | "right" | null = null;

    if (time < viewportStart) {
      cursorTime = viewportStart;
      cursorEdge = "left";
    } else if (time > viewportEnd) {
      cursorTime = viewportEnd;
      cursorEdge = "right";
    } else if (
      Math.abs(time - waveformDuration) < 1e-6 &&
      Math.abs(viewportEnd - waveformDuration) < 1e-6
    ) {
      // Exact end-of-track is the visual right boundary.
      cursorTime = viewportEnd;
      cursorEdge = "right";
    }

    // Use pixel coordinates, matching the track transform exactly.
    // Keep edge cursors slightly inside the clipping box.
    let cursorX = (cursorTime - bufferStart) * pxPerSec;

    if (cursorEdge === "right") {
      cursorX -= cursor.offsetWidth;
    }

    cursor.style.left = "0";
    cursor.style.transform = `translate3d(${cursorX}px, 0, 0)`;

    const label = cursor.firstElementChild as HTMLElement | null;
    if (!label) return;

    if (cursorEdge === "left") {
      label.style.left = "6px";
      label.style.right = "auto";
      label.style.transform = "translateX(0)";
    } else if (cursorEdge === "right") {
      label.style.left = "auto";
      label.style.right = "6px";
      label.style.transform = "translateX(0)";
    } else {
      const viewFraction = (time - viewportStart) / win;

      if (viewFraction <= 0.02) {
        label.style.left = "6px";
        label.style.right = "auto";
        label.style.transform = "translateX(0)";
      } else if (viewFraction >= 0.98) {
        label.style.left = "auto";
        label.style.right = "6px";
        label.style.transform = "translateX(0)";
      } else {
        label.style.left = "auto";
        label.style.right = "auto";
        label.style.transform = "translateX(-50%)";
      }
    }
  }, [cursorElRef, playedElRef, waveformDuration]);

  // React has now committed WaveformCanvas + Clip for renderedBufferAnchor.
  // Only here do we switch the imperative coordinate origin. The viewport
  // anchor is intentionally preserved, preventing a buffer refresh from
  // snapping the visible window backward.
  useLayoutEffect(() => {
    bufferAnchorRef.current = renderedBufferAnchor;
    pendingBufferAnchorRef.current = null;

    renderFrame(
      getCurrentTime(),
      viewportAnchorRef.current,
    );
  }, [getCurrentTime, renderFrame, renderedBufferAnchor]);

  // ---------------------------------------------------------------------------
  // Single animation owner
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let raf = 0;

    const frame = () => {
      const time = getCurrentTime();
      let anchor = viewportAnchorRef.current;

      if (playingRef.current && !draggingRef.current && !scrollingRef.current) {
        anchor = resolveAnchor(
          modeRef.current,
          anchor,
          time,
          hsWinLenRef.current,
          hsMaxStartRef.current,
          performance.now(),
        );
        setLiveAnchor(anchor);
      }

      renderFrame(time, viewportAnchorRef.current);
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [getCurrentTime, renderFrame, setLiveAnchor]);

  // ---------------------------------------------------------------------------
  // External seek / playback lifecycle -> controller state transitions
  // ---------------------------------------------------------------------------
  const previousPlayingRef = useRef(playing);

  useEffect(() => {
    const wasPlaying = previousPlayingRef.current;
    previousPlayingRef.current = playing;

    if (!wasPlaying && playing) {
      if (modeRef.current.type !== "clip") setModeFollow();
      return;
    }

    if (wasPlaying && !playing && modeRef.current.type === "clip") {
      const clip = modeRef.current;
      modeRef.current = clip.userMoved
        ? { type: "manual" }
        : {
          type: "follow",
          epoch: makeFollowEpoch(
            viewportAnchorRef.current,
            hsWinLenRef.current,
            getCurrentTime(),
          ),
        };
      setScrolling(false);
    }
  }, [getCurrentTime, playing, setModeFollow, setScrolling]);

  useEffect(() => {
    const previous = previousTimeRef.current;
    previousTimeRef.current = currentTime;

    if (playingRef.current || draggingRef.current) return;
    if (Math.abs(currentTime - previous) < 1e-6) return;

    if (modeRef.current.type === "clip" || modeRef.current.type === "manual") {
      // Keep the manually chosen viewport, but still render an external paused
      // seek immediately (especially currentTime === waveformDuration).
      renderFrame(currentTime, viewportAnchorRef.current);
      return;
    }

    const next = resolveAnchor(
      modeRef.current,
      viewportAnchorRef.current,
      currentTime,
      hsWinLenRef.current,
      hsMaxStartRef.current,
      performance.now(),
    );

    setLiveAnchor(next);
    setModeFollow(currentTime);

    // Render the exact external seek value immediately rather than waiting for
    // getCurrentTime()/rAF after the media element has entered its ended state.
    renderFrame(currentTime, next);
  }, [currentTime, renderFrame, setLiveAnchor, setModeFollow]);

  // ---------------------------------------------------------------------------
  // Clip playback
  // ---------------------------------------------------------------------------
  const playClip = useCallback((start: number, end: number, reps: number) => {
    const anchor = viewportAnchorRef.current;
    const win = hsWinLenRef.current;

    // Preserve the user's current view whenever any part of the clip is visible.
    // Only jump when the entire clip lies outside the viewport.
    if (end < anchor || start > anchor + win) {
      setLiveAnchor(start);
    }

    const clipAnchor = viewportAnchorRef.current;
    modeRef.current = {
      type: "clip",
      start,
      end,
      playbackStart: start,
      anchorStart: clipAnchor,
      followEnd: end > clipAnchor + win ? end : null,
      userMoved: false,
    };

    onPlayRange(start, end, reps, () => {
      const mode = modeRef.current;
      if (mode.type !== "clip") return;

      modeRef.current = mode.userMoved
        ? { type: "manual" }
        : {
          type: "follow",
          epoch: makeFollowEpoch(
            viewportAnchorRef.current,
            hsWinLenRef.current,
            getCurrentTime(),
          ),
        };
      setScrolling(false);
    });
  }, [getCurrentTime, onPlayRange, setLiveAnchor, setScrolling]);

  // ---------------------------------------------------------------------------
  // Manual navigation
  // ---------------------------------------------------------------------------
  const bumpScrolling = useCallback(() => {
    scrollingRef.current = true;
    setScrolling(true);
    window.clearTimeout(scrollTimeoutRef.current);

    if (modeRef.current.type === "clip") {
      modeRef.current = { ...modeRef.current, userMoved: true };
      return;
    }

    modeRef.current = { type: "manual" };
    scrollTimeoutRef.current = window.setTimeout(() => {
      scrollingRef.current = false;
      setScrolling(false);

      const time = getCurrentTime();

      // If the user has manually moved playback outside the visible viewport,
      // remain detached. Playback must not pull the viewport/buffer back.
      // renderFrame() will keep the cursor pinned to the appropriate edge.
      if (playingRef.current && !isTimeInViewport(time)) {
        modeRef.current = { type: "manual" };
        return;
      }

      // Playback is still visible, so normal following can resume.
      setModeFollow(time);
    }, 1500);
  }, [
    getCurrentTime,
    isTimeInViewport,
    scrollTimeoutRef,
    setModeFollow,
    setScrolling,
  ]);

  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startAnchor: number;
    panned: boolean;
  } | null>(null);

  const onHsPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;

    const downTarget = e.target as Element;
    if (!hsRef.current?.contains(downTarget)) return;
    if (downTarget.closest(".clip-label, .stacked-clip-label")) return;
    if (dragRef.current?.pointerId === e.pointerId) return;

    suppressClickRef.current = false;
    const element = e.currentTarget;
    const drag = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startAnchor: viewportAnchorRef.current,
      panned: false,
    };
    dragRef.current = drag;
    draggingRef.current = true;

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== drag.pointerId) return;
      const dx = ev.clientX - drag.startX;
      const dy = ev.clientY - drag.startY;

      if (!drag.panned) {
        if (Math.abs(dx) < HS_PAN_DECIDE_PX && Math.abs(dy) < HS_PAN_DECIDE_PX) return;
        if (Math.abs(dy) >= Math.abs(dx)) return;
      }

      ev.preventDefault();
      drag.panned = true;

      setLiveAnchor(
        panTarget(
          drag.startAnchor,
          dx,
          hsWinLenRef.current,
          element.clientWidth,
          hsMaxStartRef.current,
        ),
      );
      bumpScrolling();
    };

    const onEnd = (ev: PointerEvent) => {
      if (ev.pointerId !== drag.pointerId) return;
      ev.preventDefault();
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onEnd, true);
      window.removeEventListener("pointercancel", onEnd, true);
      dragRef.current = null;
      draggingRef.current = false;
      if (drag.panned) suppressClickRef.current = true;
    };

    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", onEnd, true);
    window.addEventListener("pointercancel", onEnd, true);
  }, [bumpScrolling, setLiveAnchor]);

  useEffect(() => {
    const element = hsRef.current;
    if (!element) return;

    const onWheel = (e: WheelEvent) => {
      const target = e.target as Node;
      if (!trackRef.current?.contains(target)) return;
      e.preventDefault();

      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      const scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1;
      const dSec = Math.max(
        -2,
        Math.min(
          2,
          ((delta * scale) / (element.clientWidth || 1)) * hsWinLenRef.current,
        ),
      );

      setLiveAnchor(viewportAnchorRef.current + dSec);
      bumpScrolling();
    };

    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [bumpScrolling, setLiveAnchor]);

  // ---------------------------------------------------------------------------
  // Seeking
  // ---------------------------------------------------------------------------
  const onWaveformClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (modeRef.current.type === "clip") return;

    const rect = e.currentTarget.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const target = viewportAnchorRef.current + fraction * hsWinLenRef.current;

    onSeek(target);
    onActiveClipChange(-1);

    modeRef.current = {
      type: "cursor",
      epoch: makeFollowEpoch(viewportAnchorRef.current, hsWinLenRef.current, target),
      holdUntil: performance.now() + CURSOR_CLICK_HOLD_MS,
    };
  }, [onActiveClipChange, onSeek]);

  const onRootClickCapture = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!suppressClickRef.current) return;
    suppressClickRef.current = false;
    e.stopPropagation();
  }, []);

  const getStripPlayedPct = useCallback(() => {
    const bufferLen = bufferLengthRef.current;
    if (bufferLen <= 0) return 0;

    return (
      getCurrentTime() - bufferAnchorRef.current
    ) / bufferLen;
  }, [getCurrentTime]);

  return {
    hsRef,
    trackRef,
    // React render source for the buffer start. Use this for WaveWindow.
    renderedBufferAnchor,
    // Compatibility alias.
    hsAnchor: renderedBufferAnchor,
    // Duration of the visible viewport.
    hsWinLenRef,
    // Duration/start of the pre-rendered waveform buffer. Wave drawing code
    // should render [hsAnchor, hsAnchor + bufferLengthRef.current].
    bufferLengthRef,
    bufferAnchorRef,
    // Live visible-window start; changes cheaply during manual/auto scrolling.
    viewportAnchorRef,
    // Compatibility alias used by existing callers for the live viewport.
    hsSmoothRef: viewportAnchorRef,
    innerH,
    onHsPointerDown,
    onRootClickCapture,
    onWaveformClick,
    getStripPlayedPct,
    playClip,
  };
}

export { VB_H, VB_W, PAD };
