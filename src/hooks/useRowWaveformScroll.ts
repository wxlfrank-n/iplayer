import { useCallback, useEffect, useLayoutEffect, useRef, useState, } from "react";
import type { Dispatch, PointerEvent as ReactPointerEvent, RefObject, SetStateAction, } from "react";
import { clampWindowAnchor, getWindowSecs, } from "../utils/rowWaveform";
import type { Clip } from "../utils/clips";
import { panTarget } from "../utils/pan";
const HS_FOLLOW_FRAC = 0.8;
const HS_PAN_DECIDE_PX = 8;
const CURSOR_CLICK_HOLD_MS = 400;
const VB_W = 500;
const VB_H = 100;
const PAD = 4;
export const BARS_TAIL_SEC = 0;
export const WAVE_BUFFER_WINDOWS = 3;
export const WAVE_BUFFER_MARGIN_WINDOWS = 0.4;
export interface UseRowWaveformScrollArgs {
  waveformDuration: number;
  displayClips: Clip[];
  currentTime: number;
  onSeek: (time: number) => void;
  onPlayRange: (start: number, end: number, repetitions: number, onComplete?: () => void, onRepeat?: () => void) => void;
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
type FollowMode = {
  type: "follow";
  epoch: FollowEpoch;
} | {
  type: "manual";
} | {
  type: "cursor";
  epoch: FollowEpoch;
  holdUntil: number;
} | {
  type: "clip";
  start: number;
  end: number;
  autoFollow: boolean;
  userMoved: boolean;
};
function makeFollowEpoch(anchor: number, windowLength: number, time: number): FollowEpoch {
  return {
    anchor,
    time,
    align: !(time >= anchor &&
      time <=
      anchor + windowLength),
  };
}
function resolveFollow(epoch: FollowEpoch, anchor: number, time: number, windowLength: number, maxStart: number): number {
  const threshold = anchor +
    HS_FOLLOW_FRAC *
    windowLength;
  if (epoch.align) {
    return clampWindowAnchor(time -
      HS_FOLLOW_FRAC *
      windowLength, maxStart);
  }
  if (time < threshold) {
    return anchor;
  }
  return clampWindowAnchor(time -
    HS_FOLLOW_FRAC *
    windowLength, maxStart);
}
function getClipPlaybackViewport(start: number, end: number, currentAnchor: number, windowLength: number, maxStart: number): {
  anchor: number;
  autoFollow: boolean;
} {
  const isFullyVisible = (anchor: number) => start >= anchor &&
    end <=
    anchor + windowLength;
  if (isFullyVisible(currentAnchor)) {
    return {
      anchor: currentAnchor,
      autoFollow: false,
    };
  }
  if (start < currentAnchor) {
    const anchor = clampWindowAnchor(start, maxStart);
    return {
      anchor,
      autoFollow: !isFullyVisible(anchor),
    };
  }
  return {
    anchor: currentAnchor,
    autoFollow: true,
  };
}
function resolveAnchor(mode: FollowMode, anchor: number, time: number, windowLength: number, maxStart: number, now: number): number {
  switch (mode.type) {
    case "manual":
      return anchor;
    case "cursor":
      return now <
        mode.holdUntil
        ? anchor
        : resolveFollow(mode.epoch, anchor, time, windowLength, maxStart);
    case "clip": {
      if (mode.userMoved) {
        return anchor;
      }
      if (!mode.autoFollow) {
        return anchor;
      }
      const clipLength = mode.end -
        mode.start;
      if (clipLength <=
        windowLength) {
        const wholeClipVisible = mode.start >= anchor &&
          mode.end <=
          anchor +
          windowLength;
        if (wholeClipVisible) {
          return anchor;
        }
      }
      const threshold = anchor +
        HS_FOLLOW_FRAC *
        windowLength;
      if (time < threshold) {
        return anchor;
      }
      return clampWindowAnchor(time -
        HS_FOLLOW_FRAC *
        windowLength, maxStart);
    }
    case "follow":
      return resolveFollow(mode.epoch, anchor, time, windowLength, maxStart);
  }
}
export function useRowWaveformScroll({ waveformDuration, displayClips, currentTime, onSeek, onPlayRange, onActiveClipChange, getCurrentTime, playing, scrolling, setScrolling, scrollTimeoutRef, cursorElRef, playedElRef, }: UseRowWaveformScrollArgs) {
  const innerH = VB_H - PAD * 2;
  const hsRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const hsWinLenRef = useRef(0);
  const hsMaxStartRef = useRef(0);
  const [windowSecs, setWindowSecs] = useState(0);
  const viewportAnchorRef = useRef(0);
  const bufferAnchorRef = useRef(0);
  const pendingBufferAnchorRef = useRef<number | null>(null);
  const bufferLengthRef = useRef(0);
  const cursorLeftPctRef = useRef(0);
  const [renderedBufferAnchor, setRenderedBufferAnchor] = useState(0);
  const playingRef = useRef(playing);
  const draggingRef = useRef(false);
  const scrollingRef = useRef(scrolling);
  const previousTimeRef = useRef(currentTime);
  const suppressClickRef = useRef(false);
  const modeRef = useRef<FollowMode>({
    type: "follow",
    epoch: makeFollowEpoch(0, 0, getCurrentTime()),
  });
  useEffect(() => {
    playingRef.current =
      playing;
  }, [playing]);
  useEffect(() => {
    scrollingRef.current =
      scrolling;
  }, [scrolling]);
  const setModeFollow = useCallback((time = getCurrentTime()) => {
    modeRef.current = {
      type: "follow",
      epoch: makeFollowEpoch(viewportAnchorRef.current, hsWinLenRef.current, time),
    };
  }, [getCurrentTime]);
  const isTimeInViewport = useCallback((time: number) => {
    const start = viewportAnchorRef.current;
    const end = start +
      hsWinLenRef.current;
    return (time >= start &&
      time <= end);
  }, []);
  const calculateBufferStart = useCallback((viewportStart: number) => {
    const win = hsWinLenRef.current;
    const bufferLength = Math.min(waveformDuration, win *
      WAVE_BUFFER_WINDOWS);
    bufferLengthRef.current =
      bufferLength;
    const desired = viewportStart -
      win;
    const maxBufferStart = Math.max(0, waveformDuration -
      bufferLength);
    return Math.max(0, Math.min(desired, maxBufferStart));
  }, [waveformDuration]);
  const ensureWaveBuffer = useCallback((viewportStart: number, force = false) => {
    const win = hsWinLenRef.current;
    const viewportEnd = viewportStart +
      win;
    const effectiveBufferStart = pendingBufferAnchorRef.current ??
      bufferAnchorRef.current;
    const bufferEnd = effectiveBufferStart +
      bufferLengthRef.current;
    const margin = win *
      WAVE_BUFFER_MARGIN_WINDOWS;
    const nearLeftEdge = effectiveBufferStart >
      0 &&
      viewportStart <
      effectiveBufferStart +
      margin;
    const nearRightEdge = bufferEnd <
      waveformDuration &&
      viewportEnd >
      bufferEnd -
      margin;
    if (!force &&
      !nearLeftEdge &&
      !nearRightEdge) {
      return;
    }
    const nextBufferStart = calculateBufferStart(viewportStart);
    if (Math.abs(nextBufferStart -
      effectiveBufferStart) < 1e-6) {
      return;
    }
    pendingBufferAnchorRef.current =
      nextBufferStart;
    setRenderedBufferAnchor(current => Math.abs(current -
      nextBufferStart) < 1e-6
      ? current
      : nextBufferStart);
  }, [
    calculateBufferStart,
    waveformDuration,
  ]);
  const setLiveAnchor = useCallback((target: number, forceRedraw = false) => {
    const next = clampWindowAnchor(target, hsMaxStartRef.current);
    viewportAnchorRef.current =
      next;
    ensureWaveBuffer(next, forceRedraw);
  }, [ensureWaveBuffer]);
  const applyWidth = useCallback((width: number) => {
    if (width <= 0 || waveformDuration <= 0)
      return;
    const nextWindowSecs = Math.min(getWindowSecs(width, displayClips), waveformDuration);
    if (!Number.isFinite(nextWindowSecs) || nextWindowSecs <= 0)
      return;
    if (Math.abs(nextWindowSecs - hsWinLenRef.current) < 1e-6)
      return;
    hsWinLenRef.current = nextWindowSecs;
    hsMaxStartRef.current = Math.max(0, waveformDuration - nextWindowSecs);
    bufferLengthRef.current = Math.min(waveformDuration, nextWindowSecs * WAVE_BUFFER_WINDOWS);
    const nextAnchor = clampWindowAnchor(viewportAnchorRef.current, hsMaxStartRef.current);
    viewportAnchorRef.current = nextAnchor;
    // This state update is intentional: refs alone do not cause the initial
    // clips/waveform to rerender after the real element width is measured.
    setWindowSecs(nextWindowSecs);
    setLiveAnchor(nextAnchor, true);
    if (modeRef.current.type === "follow") {
      setModeFollow(getCurrentTime());
    }
  }, [displayClips, getCurrentTime, setLiveAnchor, setModeFollow, waveformDuration]);
  useLayoutEffect(() => {
    const element = hsRef.current;
    if (!element)
      return;
    applyWidth(element.clientWidth);
  }, [applyWidth]);
  useEffect(() => {
    const element = hsRef.current;
    if (!element)
      return;
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(entries => {
        const entry = entries[0];
        if (entry)
          applyWidth(entry.contentRect.width);
      });
      observer.observe(element);
      return () => observer.disconnect();
    }
    const onResize = () => applyWidth(element.clientWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [applyWidth]);
  const renderFrame = useCallback((time: number, anchor: number) => {
    const track = trackRef.current;
    if (!track)
      return;
    const viewport = track.parentElement;
    if (!viewport)
      return;
    const win = hsWinLenRef.current ||
      1;
    const viewportWidthPx = viewport.clientWidth ||
      1;
    const pxPerSec = viewportWidthPx /
      win;
    const bufferStart = bufferAnchorRef.current;
    const bufferLen = bufferLengthRef.current ||
      win;
    track.style.width =
      `${(bufferLen / win) *
      100}%`;
    const trackX = -(anchor -
      bufferStart) *
      pxPerSec;
    track.style.transform =
      `translate3d(${trackX}px, 0, 0)`;
    const playheadFraction = bufferLen > 0
      ? (time -
        bufferStart) /
      bufferLen
      : 0;
    const playheadPct = playheadFraction *
      100;
    cursorLeftPctRef.current =
      playheadFraction;
    const played = playedElRef?.current;
    if (played) {
      const clampedPct = Math.max(0, Math.min(100, playheadPct));
      played.style.clipPath =
        `inset(0 ${100 - clampedPct}% 0 0)`;
    }
    const cursor = cursorElRef?.current;
    if (!cursor)
      return;
    const viewportStart = anchor;
    const viewportEnd = Math.min(waveformDuration, anchor + win);
    let cursorTime = time;
    let cursorEdge: "left" | "right" | null = null;
    if (time <
      viewportStart) {
      cursorTime =
        viewportStart;
      cursorEdge =
        "left";
    }
    else if (time >
      viewportEnd) {
      cursorTime =
        viewportEnd;
      cursorEdge =
        "right";
    }
    else if (Math.abs(time -
      waveformDuration) < 1e-6 &&
      Math.abs(viewportEnd -
        waveformDuration) < 1e-6) {
      cursorTime =
        viewportEnd;
      cursorEdge =
        "right";
    }
    let cursorX = (cursorTime -
      bufferStart) *
      pxPerSec;
    if (cursorEdge ===
      "right") {
      cursorX -=
        cursor.offsetWidth;
    }
    cursor.style.left =
      "0";
    cursor.style.transform =
      `translate3d(${cursorX}px, 0, 0)`;
    const label = cursor.firstElementChild as HTMLElement | null;
    if (!label)
      return;
    if (cursorEdge ===
      "left") {
      label.style.left =
        "6px";
      label.style.right =
        "auto";
      label.style.transform =
        "translateX(0)";
    }
    else if (cursorEdge ===
      "right") {
      label.style.left =
        "auto";
      label.style.right =
        "6px";
      label.style.transform =
        "translateX(0)";
    }
    else {
      const viewFraction = (time -
        viewportStart) /
        win;
      if (viewFraction <=
        0.02) {
        label.style.left =
          "6px";
        label.style.right =
          "auto";
        label.style.transform =
          "translateX(0)";
      }
      else if (viewFraction >=
        0.98) {
        label.style.left =
          "auto";
        label.style.right =
          "6px";
        label.style.transform =
          "translateX(0)";
      }
      else {
        label.style.left =
          "auto";
        label.style.right =
          "auto";
        label.style.transform =
          "translateX(-50%)";
      }
    }
  }, [
    cursorElRef,
    playedElRef,
    waveformDuration,
  ]);
  useLayoutEffect(() => {
    bufferAnchorRef.current =
      renderedBufferAnchor;
    pendingBufferAnchorRef.current =
      null;
    renderFrame(getCurrentTime(), viewportAnchorRef.current);
  }, [
    getCurrentTime,
    renderFrame,
    renderedBufferAnchor,
  ]);
  useEffect(() => {
    let raf = 0;
    const frame = () => {
      const time = getCurrentTime();
      let anchor = viewportAnchorRef.current;
      if (playingRef.current &&
        !draggingRef.current &&
        !scrollingRef.current) {
        anchor =
          resolveAnchor(modeRef.current, anchor, time, hsWinLenRef.current, hsMaxStartRef.current, performance.now());
        setLiveAnchor(anchor);
      }
      renderFrame(time, viewportAnchorRef.current);
      raf =
        requestAnimationFrame(frame);
    };
    raf =
      requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [
    getCurrentTime,
    renderFrame,
    setLiveAnchor,
  ]);
  const previousPlayingRef = useRef(playing);
  useEffect(() => {
    const wasPlaying = previousPlayingRef.current;
    previousPlayingRef.current =
      playing;
    if (!wasPlaying &&
      playing) {
      if (modeRef.current.type !==
        "clip") {
        setModeFollow();
      }
      return;
    }
    if (wasPlaying &&
      !playing &&
      modeRef.current.type ===
      "clip") {
      const clip = modeRef.current;
      modeRef.current =
        clip.userMoved
          ? {
            type: "manual",
          }
          : {
            type: "follow",
            epoch: makeFollowEpoch(viewportAnchorRef.current, hsWinLenRef.current, getCurrentTime()),
          };
      setScrolling(false);
    }
  }, [
    getCurrentTime,
    playing,
    setModeFollow,
    setScrolling,
  ]);
  useEffect(() => {
    const previous = previousTimeRef.current;
    previousTimeRef.current =
      currentTime;
    if (playingRef.current ||
      draggingRef.current) {
      return;
    }
    if (Math.abs(currentTime -
      previous) < 1e-6) {
      return;
    }
    if (modeRef.current.type ===
      "clip" ||
      modeRef.current.type ===
      "manual") {
      renderFrame(currentTime, viewportAnchorRef.current);
      return;
    }
    const next = resolveAnchor(modeRef.current, viewportAnchorRef.current, currentTime, hsWinLenRef.current, hsMaxStartRef.current, performance.now());
    setLiveAnchor(next);
    setModeFollow(currentTime);
    renderFrame(currentTime, next);
  }, [
    currentTime,
    renderFrame,
    setLiveAnchor,
    setModeFollow,
  ]);
  const completeClipPlayback = useCallback((end: number) => {
    modeRef.current = {
      type: "manual",
    };
    scrollingRef.current =
      false;
    setScrolling(false);
    renderFrame(end, viewportAnchorRef.current);
  }, [
    renderFrame,
    setScrolling,
  ]);
  const playClip = useCallback((start: number, end: number, reps: number) => {
    const positionForRoundStart = (firstRound: boolean) => {
      const existing = modeRef.current;
      if (!firstRound &&
        existing.type ===
        "clip" &&
        existing.userMoved) {
        return;
      }
      const windowLength = hsWinLenRef.current;
      const clipLength = end - start;
      if (clipLength >
        windowLength) {
        const anchor = clampWindowAnchor(start, hsMaxStartRef.current);
        modeRef.current = {
          type: "clip",
          start,
          end,
          autoFollow: true,
          userMoved: false,
        };
        setLiveAnchor(anchor, true);
        renderFrame(start, anchor);
        return;
      }
      const result = getClipPlaybackViewport(start, end, viewportAnchorRef.current, windowLength, hsMaxStartRef.current);
      modeRef.current = {
        type: "clip",
        start,
        end,
        autoFollow: result.autoFollow,
        userMoved: false,
      };
      setLiveAnchor(result.anchor, true);
      renderFrame(start, result.anchor);
    };
    positionForRoundStart(true);
    onPlayRange(start, end, reps, () => {
      completeClipPlayback(end);
    }, () => {
      positionForRoundStart(false);
    });
  }, [
    completeClipPlayback,
    onPlayRange,
    renderFrame,
    setLiveAnchor,
  ]);
  const bumpScrolling = useCallback(() => {
    scrollingRef.current =
      true;
    setScrolling(true);
    window.clearTimeout(scrollTimeoutRef.current);
    if (modeRef.current.type ===
      "clip") {
      modeRef.current = {
        ...modeRef.current,
        userMoved: true,
      };
      return;
    }
    modeRef.current = {
      type: "manual",
    };
    scrollTimeoutRef.current =
      window.setTimeout(() => {
        scrollingRef.current =
          false;
        setScrolling(false);
        const time = getCurrentTime();
        if (playingRef.current &&
          !isTimeInViewport(time)) {
          modeRef.current = {
            type: "manual",
          };
          return;
        }
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
    if (e.button !== 0 &&
      e.pointerType ===
      "mouse") {
      return;
    }
    const downTarget = e.target as Element;
    if (!hsRef.current?.contains(downTarget)) {
      return;
    }
    if (!trackRef.current?.contains(downTarget)) {
      return;
    }
    if (downTarget.closest(".clip-label, .stacked-clip-label")) {
      return;
    }
    if (dragRef.current
      ?.pointerId ===
      e.pointerId) {
      return;
    }
    suppressClickRef.current =
      false;
    const element = e.currentTarget;
    const drag = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startAnchor: viewportAnchorRef.current,
      panned: false,
    };
    dragRef.current =
      drag;
    draggingRef.current =
      true;
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !==
        drag.pointerId) {
        return;
      }
      const dx = ev.clientX -
        drag.startX;
      const dy = ev.clientY -
        drag.startY;
      if (!drag.panned) {
        if (Math.abs(dx) <
          HS_PAN_DECIDE_PX &&
          Math.abs(dy) <
          HS_PAN_DECIDE_PX) {
          return;
        }
        if (Math.abs(dy) >=
          Math.abs(dx)) {
          return;
        }
      }
      ev.preventDefault();
      drag.panned =
        true;
      setLiveAnchor(panTarget(drag.startAnchor, dx, hsWinLenRef.current, element.clientWidth, hsMaxStartRef.current));
      bumpScrolling();
    };
    const onEnd = (ev: PointerEvent) => {
      if (ev.pointerId !==
        drag.pointerId) {
        return;
      }
      ev.preventDefault();
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onEnd, true);
      window.removeEventListener("pointercancel", onEnd, true);
      dragRef.current =
        null;
      draggingRef.current =
        false;
      if (drag.panned) {
        suppressClickRef.current =
          true;
      }
    };
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", onEnd, true);
    window.addEventListener("pointercancel", onEnd, true);
  }, [
    bumpScrolling,
    setLiveAnchor,
  ]);
  useEffect(() => {
    const element = hsRef.current;
    if (!element)
      return;
    const onWheel = (e: WheelEvent) => {
      const target = e.target as Node;
      if (!trackRef.current?.contains(target)) {
        return;
      }
      e.preventDefault();
      const delta = Math.abs(e.deltaX) >
        Math.abs(e.deltaY)
        ? e.deltaX
        : e.deltaY;
      const scale = e.deltaMode === 1
        ? 16
        : e.deltaMode === 2
          ? 100
          : 1;
      const dSec = Math.max(-2, Math.min(2, ((delta * scale) /
        (element.clientWidth ||
          1)) *
        hsWinLenRef.current));
      setLiveAnchor(viewportAnchorRef.current +
        dSec);
      bumpScrolling();
    };
    element.addEventListener("wheel", onWheel, {
      passive: false,
    });
    return () => element.removeEventListener("wheel", onWheel);
  }, [
    bumpScrolling,
    setLiveAnchor,
  ]);
  const onWaveformClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (suppressClickRef.current) {
      suppressClickRef.current =
        false;
      return;
    }
    if (modeRef.current.type ===
      "clip") {
      return;
    }
    const rect = e.currentTarget
      .getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (e.clientX -
      rect.left) /
      rect.width));
    const target = viewportAnchorRef.current +
      fraction *
      hsWinLenRef.current;
    onSeek(target);
    onActiveClipChange(-1);
    modeRef.current = {
      type: "cursor",
      epoch: makeFollowEpoch(viewportAnchorRef.current, hsWinLenRef.current, target),
      holdUntil: performance.now() +
        CURSOR_CLICK_HOLD_MS,
    };
  }, [
    onActiveClipChange,
    onSeek,
  ]);
  const onRootClickCapture = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!suppressClickRef.current) {
      return;
    }
    suppressClickRef.current =
      false;
    e.stopPropagation();
  }, []);
  const getStripPlayedPct = useCallback(() => {
    const bufferLen = bufferLengthRef.current;
    if (bufferLen <= 0) {
      return 0;
    }
    return ((getCurrentTime() -
      bufferAnchorRef.current) /
      bufferLen);
  }, [getCurrentTime]);
  return {
    hsRef,
    trackRef,
    renderedBufferAnchor,
    hsAnchor: windowSecs,
    hsWinLenRef,
    bufferLengthRef,
    bufferAnchorRef,
    viewportAnchorRef,
    hsSmoothRef: viewportAnchorRef,
    innerH,
    onHsPointerDown,
    onRootClickCapture,
    onWaveformClick,
    getStripPlayedPct,
    playClip,
  };
}
export { VB_H, VB_W, PAD, };
