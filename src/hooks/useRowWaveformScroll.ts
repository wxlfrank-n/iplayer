import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Dispatch, MutableRefObject, PointerEvent as ReactPointerEvent, SetStateAction } from "react";
import { clampWindowAnchor, getWindowSecs } from "../utils/rowWaveform";
import { panTarget } from "../utils/pan";

const HS_FOLLOW_FRAC = 0.6;
const HS_PAN_DECIDE_PX = 8;
const VB_W = 1000;
const VB_H = 200;
const PAD = 4;

export interface UseRowWaveformScrollArgs {
  waveformDuration: number;
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
  onStopPlayback?: () => void;
  activeClip: number;
  onActiveClipChange: (idx: number) => void;
  onSwipeClip?: (idx: number, direction: "up" | "down") => void;
  getCurrentTime: () => number;
  playing: boolean;
  scrolling: boolean;
  setScrolling: Dispatch<SetStateAction<boolean>>;
  scrollTimeoutRef: MutableRefObject<number | undefined>;
}

export function useRowWaveformScroll({
  waveformDuration,
  currentTime,
  onSeek,
  onPlayRange,
  onClipPlayActiveChange,
  onActiveClipChange,
  getCurrentTime,
  playing,
  scrolling,
  setScrolling,
  scrollTimeoutRef,
}: UseRowWaveformScrollArgs) {
  const innerH = VB_H - PAD * 2;
  const hsRef = useRef<HTMLDivElement>(null);

  const [winWidth, setWinWidth] = useState(window.innerWidth);
  const hsWinLenRef = useRef(Math.min(getWindowSecs(winWidth), waveformDuration));
  const hsMaxStartRef = useRef(Math.max(0, waveformDuration - hsWinLenRef.current));
  const hsAnchorRef = useRef(0);
  const hsSmoothRef = useRef(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const [hsAnchor, setHsAnchor] = useState(0);
  const applyWidth = useCallback((width: number) => {
    setWinWidth(width);
    hsWinLenRef.current = Math.min(getWindowSecs(width), waveformDuration);
    const maxStart = Math.max(0, waveformDuration - hsWinLenRef.current);
    hsMaxStartRef.current = maxStart;
    setHsAnchor((a) => clampWindowAnchor(a, maxStart));
  }, [waveformDuration]);

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

  const [clipPlayActive, setClipPlayActiveLocal] = useState(false);
  const prevClipPlayActiveRef = useRef(false);
  const clipPlayFollowEndRef = useRef(0);
  const clipPlayStartRef = useRef(0);
  const clipPlayAnchorStartRef = useRef(0);

  useEffect(() => {
    onClipPlayActiveChange?.(clipPlayActive);
  }, [clipPlayActive, onClipPlayActiveChange]);

  const playingRef = useRef(playing);
  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  // Previous playing value so clip-play state is only torn down on a real
  // play -> stop transition (not when a clip is armed while still paused).
  const prevPlayingRef = useRef(playing);

  const scrollingRef = useRef(scrolling);
  useEffect(() => {
    scrollingRef.current = scrolling;
  }, [scrolling]);

  const [trackHovered, setTrackHovered] = useState(false);
  const trackHoveredRef = useRef(false);
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const rect = trackRef.current?.getBoundingClientRect();
      const over =
        !!rect &&
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      if (over !== trackHoveredRef.current) {
        trackHoveredRef.current = over;
        setTrackHovered(over);
      }
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  const clipPlayActiveRef = useRef(clipPlayActive);
  useEffect(() => {
    clipPlayActiveRef.current = clipPlayActive;
  }, [clipPlayActive]);

  const drawFrame = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const innerEl = track.parentElement;
    if (!innerEl) return;
    const win = hsWinLenRef.current || 1;
    const t = getCurrentTime ? getCurrentTime() : 0;
    let s = hsAnchorRef.current;
    if (trackHoveredRef.current && playingRef.current && !scrollingRef.current && !draggingRef.current) {
      if (clipPlayActiveRef.current) {
        const followEnd = clipPlayFollowEndRef.current;
        if (followEnd && hsAnchorRef.current + win < followEnd) {
          const inView = t >= hsAnchorRef.current && t <= hsAnchorRef.current + win;
          if (inView) {
            const target = Math.min(
              clipPlayAnchorStartRef.current + (t - clipPlayStartRef.current),
              Math.max(0, followEnd - win),
            );
            s = Math.max(hsAnchorRef.current, target);
          } 
        }
      } else if (clipPlaySkipRef.current) {
        s = hsAnchorRef.current;
      } else {
        s = Math.max(0, Math.min(t - HS_FOLLOW_FRAC * win, hsMaxStartRef.current));
      }
    }
    hsSmoothRef.current = s;
    const pxPerSec = (innerEl.clientWidth || 1) / win;
    track.style.transform = `translateX(${(-(s - hsAnchorRef.current) * pxPerSec).toFixed(2)}px)`;
  }, [getCurrentTime]);

  const commitAnchor = useCallback((target: number) => {
    setHsAnchor(target);
  }, []);

  const commitAnchorNow = useCallback(
    (target: number) => {
      hsAnchorRef.current = target;
      hsSmoothRef.current = target;
      setHsAnchor(target);
      drawFrame();
    },
    [drawFrame],
  );

  useLayoutEffect(() => {
    hsAnchorRef.current = hsAnchor;
    drawFrame();
  }, [hsAnchor, drawFrame]);

  const clipPlaySkipRef = useRef(false);
  const previousTimeRef = useRef(currentTime);

  useEffect(() => {
    const previousTime = previousTimeRef.current;
    previousTimeRef.current = currentTime;
    if (draggingRef.current) return;
    if (Math.abs(currentTime - previousTime) < 1) return;
    if (clipPlayActiveRef.current) {
      const a = hsAnchorRef.current;
      const w = hsWinLenRef.current;
      if (currentTime < a || currentTime > a + w) return;
    }
    commitAnchorNow(
      clampWindowAnchor(currentTime - HS_FOLLOW_FRAC * hsWinLenRef.current, hsMaxStartRef.current),
    );
  }, [currentTime, commitAnchorNow]);

  useEffect(() => {
    const wasPlaying = prevPlayingRef.current;
    prevPlayingRef.current = playing;
    // Only a genuine play -> stop transition ends a clip range. Arming a clip
    // while paused takes a moment to set playing=true; clearing here would
    // disarm the clip-follow protection before the range ever starts.
    if (!wasPlaying) return;
    if (playing) return;
    if (!clipPlayActive) return;
    setClipPlayActiveLocal(false);
    clipPlayFollowEndRef.current = 0;
    clipPlaySkipRef.current = false;
  }, [clipPlayActive, playing]);

  useEffect(() => {
    if (prevClipPlayActiveRef.current && !clipPlayActive) {
      clipPlaySkipRef.current = true;
      setScrolling(false);
    }
    prevClipPlayActiveRef.current = clipPlayActive;
  }, [clipPlayActive, setScrolling]);

  useEffect(() => {
    if (!trackHovered) return;
    if (scrolling) return;
    if (draggingRef.current) return;
    if (!playing) return;
    if (clipPlaySkipRef.current) {
      const t = getCurrentTime();
      if (t <= hsAnchorRef.current + hsWinLenRef.current) return;
      clipPlaySkipRef.current = false;
    }
    const id = requestAnimationFrame(() => {
      if (draggingRef.current) return;
      const t = getCurrentTime();
      if (clipPlayActive) {
        const followEnd = clipPlayFollowEndRef.current;
        if (!followEnd) return;
        if (hsAnchorRef.current + hsWinLenRef.current >= followEnd) return;
        if (t < hsAnchorRef.current || t > hsAnchorRef.current + hsWinLenRef.current) return;
        const elapsed = t - clipPlayStartRef.current;
        const target = Math.min(
          clipPlayAnchorStartRef.current + elapsed,
          Math.max(0, followEnd - hsWinLenRef.current),
        );
        if (Math.abs(target - hsAnchorRef.current) > 0.05) commitAnchor(target);
        return;
      }
      const target = clampWindowAnchor(
        t - HS_FOLLOW_FRAC * hsWinLenRef.current,
        hsMaxStartRef.current,
      );
      if (Math.abs(target - hsAnchorRef.current) > 0.05) commitAnchor(target);
    });
    return () => cancelAnimationFrame(id);
  }, [currentTime, scrolling, playing, clipPlayActive, commitAnchor, getCurrentTime, trackHovered]);

  const playClip = useCallback(
    (start: number, end: number, reps: number) => {
      setClipPlayActiveLocal(true);
      clipPlayFollowEndRef.current = 0;
      clipPlayStartRef.current = start;
      const a = hsAnchorRef.current;
      const w = hsWinLenRef.current;
      clipPlayAnchorStartRef.current = a;
      if (start < a) {
        commitAnchor(clampWindowAnchor(start, hsMaxStartRef.current));
      } else if (end > a + w) {
        clipPlayFollowEndRef.current = end;
      }
      onPlayRange(start, end, reps, () => {
        clipPlayFollowEndRef.current = 0;
        setClipPlayActiveLocal(false);
      });
    },
    [commitAnchor, onPlayRange],
  );

  const bumpScrolling = useCallback(() => {
    scrollingRef.current = true;
    setScrolling(true);
    window.clearTimeout(scrollTimeoutRef.current);
    if (clipPlayActive) return;
    scrollTimeoutRef.current = window.setTimeout(() => setScrolling(false), 1500);
  }, [clipPlayActive, scrollTimeoutRef, setScrolling]);

  const hsDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startAnchor: number;
    panned: boolean;
  } | null>(null);
  const hsSuppressClickRef = useRef(false);

  const onHsPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      const downTarget = e.target as Element;
      if (!hsRef.current?.contains(downTarget)) return;
      if (downTarget.closest(".waveform-clip, .clip-label, .stacked-clip-label")) return;
      if (hsDragRef.current?.pointerId === e.pointerId) return;
      hsDragRef.current = null;
      hsSuppressClickRef.current = false;
      const el = e.currentTarget;
      const drag = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startAnchor: hsAnchorRef.current,
        panned: false,
      };
      hsDragRef.current = drag;
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
        ev.preventDefault();
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onEnd);
        window.removeEventListener("pointercancel", onEnd);
        hsDragRef.current = null;
        draggingRef.current = false;
        if (!drag.panned) return;
        hsSuppressClickRef.current = true;
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onEnd);
      window.addEventListener("pointercancel", onEnd);
      bumpScrolling();
    },
    [bumpScrolling, commitAnchorNow],
  );

  useEffect(() => {
    const el = hsRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const wheelTarget = e.target as Node;
      if (!trackRef.current?.contains(wheelTarget)) return;
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
          ((delta * scale) / (elNow.clientWidth || 1)) * (hsWinLenRef.current || 1),
        ),
      );
      commitAnchorNow(clampWindowAnchor(hsAnchorRef.current + dSec, hsMaxStartRef.current));
      bumpScrolling();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [bumpScrolling, commitAnchorNow]);

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

  const onWaveformClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (hsSuppressClickRef.current) {
        hsSuppressClickRef.current = false;
        return;
      }
      const rect = e.currentTarget.getBoundingClientRect();
      const f = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      onSeek(hsSmoothRef.current + f * hsWinLenRef.current);
      onActiveClipChange(-1);
    },
    [onActiveClipChange, onSeek],
  );

  const onRootClickCapture = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (hsSuppressClickRef.current) {
      hsSuppressClickRef.current = false;
      e.stopPropagation();
    }
  }, []);

  return {
    hsRef,
    trackRef,
    hsAnchor,
    hsWinLenRef,
    hsSmoothRef,
    innerH,
    onHsPointerDown,
    onRootClickCapture,
    onWaveformClick,
    getPlayedPct,
    getSmoothPlayedPct,
    playClip,
    trackHovered,
  };
}

export { VB_H, VB_W, PAD };
