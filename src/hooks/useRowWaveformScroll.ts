import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Dispatch, MutableRefObject, PointerEvent as ReactPointerEvent, SetStateAction } from "react";
import { clampWindowAnchor, getWindowSecs } from "../utils/rowWaveform";
import { panTarget } from "../utils/pan";

const HS_FOLLOW_FRAC = 0.6;
const HS_PAN_DECIDE_PX = 8;
// After a background click that seeks to a spot already inside the window,
// the row must not re-center the playhead: the user is marking a position.
// Any follow activity is held for this long so neither the >=1s currentTime
// effect nor the rAF follow can yank the window on that click.
const CURSOR_CLICK_HOLD_MS = 400;
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
    if (playingRef.current && !scrollingRef.current && !draggingRef.current) {
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
      } else if (performance.now() < cursorClickUntilRef.current) {
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
// Timestamp until which follow commits/glides are held after an in-view
// background click that set the cursor.
const cursorClickUntilRef = useRef(0);
const previousTimeRef = useRef(currentTime);

  useEffect(() => {
    const previousTime = previousTimeRef.current;
    previousTimeRef.current = currentTime;
    if (draggingRef.current) return;
    if (Math.abs(currentTime - previousTime) < 1) return;
    // While a clip range owns playback the view must not be repositioned:
    // the initial seek into the clip and every loop wrap would otherwise
    // re-center the window, yanking it off wherever the user is looking.
    // The rAF follow handles the (only) sanctioned in-view animation.
    if (clipPlayActiveRef.current) return;
    // A click that placed the cursor inside the current window must not
    // re-center the window on the playhead.
    if (performance.now() < cursorClickUntilRef.current) return;
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
      // After a clip range ends, only hold the view still when the user moved
      // it (panned/wheeled) while the clip was playing — that keeps a
      // manually-browsed region put. If the view never left the clip, normal
      // follow must resume immediately, or playback would appear frozen.
      clipPlaySkipRef.current =
        Math.abs(hsAnchorRef.current - clipPlayAnchorStartRef.current) > 0.05;
      setScrolling(false);
    }
    prevClipPlayActiveRef.current = clipPlayActive;
  }, [clipPlayActive, setScrolling]);

  useEffect(() => {
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
      if (performance.now() < cursorClickUntilRef.current) return;
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
  }, [currentTime, scrolling, playing, clipPlayActive, commitAnchor, getCurrentTime]);

  const playClip = useCallback(
    (start: number, end: number, reps: number) => {
      setClipPlayActiveLocal(true);
      clipPlayFollowEndRef.current = 0;
      clipPlayStartRef.current = start;
      const a = hsAnchorRef.current;
      const w = hsWinLenRef.current;
      clipPlayAnchorStartRef.current = a;
      // Only reposition when nothing of the clip is visible at all. Clicking a
      // clip (even a mid-slice of a long one) must play it where the user is
      // looking, never snap the window back to the clip's start.
      if (end < a) {
        commitAnchor(clampWindowAnchor(start, hsMaxStartRef.current));
      } else if (start > a + w) {
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
      if (clipPlayActiveRef.current) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const f = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const target = hsSmoothRef.current + f * hsWinLenRef.current;
      onSeek(target);
      onActiveClipChange(-1);
      // The click targeted a spot inside the visible window: keep the window
      // put so the cursor stays where the user pointed.
      if (
        target >= hsAnchorRef.current &&
        target <= hsAnchorRef.current + hsWinLenRef.current
      ) {
        cursorClickUntilRef.current = performance.now() + CURSOR_CLICK_HOLD_MS;
      }
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
  };
}

export { VB_H, VB_W, PAD };
