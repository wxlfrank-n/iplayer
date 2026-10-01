import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import type {
  Dispatch,
  PointerEvent as ReactPointerEvent,
  RefObject,
  SetStateAction,
} from 'react';
import {clampWindowAnchor, getWindowSecs} from '../utils/rowWaveform';
import {calculateWheelChange} from '../utils/rowHandler';
import type {Clip} from '../utils/clips';
import {panTarget} from '../utils/pan';
import {
  CURSOR_CLICK_HOLD_MS,
  HS_PAN_DECIDE_PX,
  PAD,
  VB_H,
  WAVE_BUFFER_MARGIN_WINDOWS,
  WAVE_BUFFER_WINDOWS,
  getClipPlaybackViewport,
  makeFollowEpoch,
  resolveViewportAnchor,
} from '../utils/rowWaveformScrollFunctions';
import type {
  PlaybackContext,
  ViewportContext,
} from '../utils/rowWaveformScrollFunctions';

export {
  BARS_TAIL_SEC,
  PAD,
  VB_H,
  VB_W,
  WAVE_BUFFER_MARGIN_WINDOWS,
  WAVE_BUFFER_WINDOWS,
} from '../utils/rowWaveformScrollFunctions';

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
    onRepeat?: () => void,
  ) => void;
  repetitions: number;
  onStopPlayback?: () => void;
  activeClip: number;
  onActiveClipChange: (idx: number) => void;
  onSwipeClip?: (idx: number, direction: 'up' | 'down') => void;
  getCurrentTime: () => number;
  playing: boolean;
  scrolling: boolean;
  setScrolling: Dispatch<SetStateAction<boolean>>;
  scrollTimeoutRef: RefObject<number | undefined>;
  cursorElRef?: RefObject<HTMLDivElement | null>;
  playedElRef?: RefObject<HTMLDivElement | null>;
  clipLabelLayerRef?: RefObject<HTMLDivElement | null>;
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
  clipLabelLayerRef,
}: UseRowWaveformScrollArgs) {
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
  const playbackContextRef = useRef<PlaybackContext>({
    type: playing ? 'normal' : 'idle',
  });
  const viewportContextRef = useRef<ViewportContext>({
    type: 'follow',
    epoch: makeFollowEpoch(0, 0, getCurrentTime()),
  });
  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);
  useEffect(() => {
    scrollingRef.current = scrolling;
  }, [scrolling]);
  const setViewportFollow = useCallback(
    (time = getCurrentTime()) => {
      viewportContextRef.current = {
        type: 'follow',
        epoch: makeFollowEpoch(
          viewportAnchorRef.current,
          hsWinLenRef.current,
          time,
        ),
      };
    },
    [getCurrentTime],
  );
  const isTimeInViewport = useCallback((time: number) => {
    const start = viewportAnchorRef.current;
    const end = start + hsWinLenRef.current;
    return time >= start && time <= end;
  }, []);
  const calculateBufferStart = useCallback(
    (viewportStart: number) => {
      const win = hsWinLenRef.current;
      const bufferLength = Math.min(
        waveformDuration,
        win * WAVE_BUFFER_WINDOWS,
      );
      bufferLengthRef.current = bufferLength;
      const desired = viewportStart - win;
      const maxBufferStart = Math.max(0, waveformDuration - bufferLength);
      return Math.max(0, Math.min(desired, maxBufferStart));
    },
    [waveformDuration],
  );
  const ensureWaveBuffer = useCallback(
    (viewportStart: number, force = false) => {
      const win = hsWinLenRef.current;
      const viewportEnd = viewportStart + win;
      const effectiveBufferStart =
        pendingBufferAnchorRef.current ?? bufferAnchorRef.current;
      const bufferEnd = effectiveBufferStart + bufferLengthRef.current;
      const margin = win * WAVE_BUFFER_MARGIN_WINDOWS;
      const nearLeftEdge =
        effectiveBufferStart > 0 &&
        viewportStart < effectiveBufferStart + margin;
      const nearRightEdge =
        bufferEnd < waveformDuration && viewportEnd > bufferEnd - margin;
      if (!force && !nearLeftEdge && !nearRightEdge) {
        return;
      }
      const nextBufferStart = calculateBufferStart(viewportStart);
      if (Math.abs(nextBufferStart - effectiveBufferStart) < 1e-6) {
        return;
      }
      pendingBufferAnchorRef.current = nextBufferStart;
      setRenderedBufferAnchor(current =>
        Math.abs(current - nextBufferStart) < 1e-6 ? current : nextBufferStart,
      );
    },
    [calculateBufferStart, waveformDuration],
  );
  const setLiveAnchor = useCallback(
    (target: number, forceRedraw = false) => {
      const next = clampWindowAnchor(target, hsMaxStartRef.current);
      viewportAnchorRef.current = next;
      ensureWaveBuffer(next, forceRedraw);
    },
    [ensureWaveBuffer],
  );
  const applyWidth = useCallback(
    (width: number) => {
      if (width <= 0 || waveformDuration <= 0) return;
      const nextWindowSecs = Math.min(
        getWindowSecs(width, displayClips),
        waveformDuration,
      );
      if (!Number.isFinite(nextWindowSecs) || nextWindowSecs <= 0) return;
      if (Math.abs(nextWindowSecs - hsWinLenRef.current) < 1e-6) return;
      hsWinLenRef.current = nextWindowSecs;
      hsMaxStartRef.current = Math.max(0, waveformDuration - nextWindowSecs);
      bufferLengthRef.current = Math.min(
        waveformDuration,
        nextWindowSecs * WAVE_BUFFER_WINDOWS,
      );
      const nextAnchor = clampWindowAnchor(
        viewportAnchorRef.current,
        hsMaxStartRef.current,
      );
      viewportAnchorRef.current = nextAnchor;
      // This state update is intentional: refs alone do not cause the initial
      // clips/waveform to rerender after the real element width is measured.
      setWindowSecs(nextWindowSecs);
      setLiveAnchor(nextAnchor, true);
      if (viewportContextRef.current.type === 'follow') {
        setViewportFollow(getCurrentTime());
      }
    },
    [
      displayClips,
      getCurrentTime,
      setLiveAnchor,
      setViewportFollow,
      waveformDuration,
    ],
  );
  useLayoutEffect(() => {
    const element = hsRef.current;
    if (!element) return;
    applyWidth(element.clientWidth);
  }, [applyWidth]);
  useEffect(() => {
    const element = hsRef.current;
    if (!element) return;
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(entries => {
        const entry = entries[0];
        if (entry) applyWidth(entry.contentRect.width);
      });
      observer.observe(element);
      return () => observer.disconnect();
    }
    const onResize = () => applyWidth(element.clientWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [applyWidth]);
  const renderFrame = useCallback(
    (time: number, anchor: number) => {
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
      const trackX = -(anchor - bufferStart) * pxPerSec;
      track.style.transform = `translate3d(${trackX}px, 0, 0)`;
      // Keep each clip label centered in the visible part of its clip.
      // This is updated in the same RAF as the viewport because the viewport
      // moves imperatively without causing a React render on every frame.
      clipLabelLayerRef?.current
        ?.querySelectorAll<HTMLElement>('[data-row-clip-label]')
        .forEach(label => {
          const start = Number(label.dataset.clipStart);
          const end = Number(label.dataset.clipEnd);
          if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
            return;
          const visibleStart = Math.max(start, anchor);
          const visibleEnd = Math.min(end, anchor + win);
          const labelWidthSec =
            ((label.firstChild as HTMLElement)?.getBoundingClientRect().width ||
              0) / pxPerSec; // Convert to seconds
          if (
            visibleEnd <= visibleStart ||
            visibleStart + labelWidthSec > end ||
            start + labelWidthSec > visibleEnd
          )
            return;
          const labelTime = (visibleStart + visibleEnd) / 2;
          label.style.left = `${((labelTime - start) / (end - start)) * 100}%`;
        });
      const playheadFraction =
        bufferLen > 0 ? (time - bufferStart) / bufferLen : 0;
      const playheadPct = playheadFraction * 100;
      cursorLeftPctRef.current = playheadFraction;
      const played = playedElRef?.current;
      if (played) {
        const clampedPct = Math.max(0, Math.min(100, playheadPct));
        played.style.clipPath = `inset(0 ${100 - clampedPct}% 0 0)`;
      }
      const cursor = cursorElRef?.current;
      if (!cursor) return;
      const viewportStart = anchor;
      const viewportEnd = Math.min(waveformDuration, anchor + win);
      let cursorTime = time;
      let cursorEdge: 'left' | 'right' | null = null;
      if (time < viewportStart) {
        cursorTime = viewportStart;
        cursorEdge = 'left';
      } else if (time > viewportEnd) {
        cursorTime = viewportEnd;
        cursorEdge = 'right';
      } else if (
        Math.abs(time - waveformDuration) < 1e-6 &&
        Math.abs(viewportEnd - waveformDuration) < 1e-6
      ) {
        cursorTime = viewportEnd;
        cursorEdge = 'right';
      }
      let cursorX = (cursorTime - bufferStart) * pxPerSec;
      if (cursorEdge === 'right') {
        cursorX -= cursor.offsetWidth;
      }
      cursor.style.left = '0';
      cursor.style.transform = `translate3d(${cursorX}px, 0, 0)`;
      const label = cursor.firstElementChild as HTMLElement | null;
      if (!label) return;
      if (cursorEdge === 'left') {
        label.style.left = '6px';
        label.style.right = 'auto';
        label.style.transform = 'translateX(0)';
      } else if (cursorEdge === 'right') {
        label.style.left = 'auto';
        label.style.right = '6px';
        label.style.transform = 'translateX(0)';
      } else {
        const viewFraction = (time - viewportStart) / win;
        if (viewFraction <= 0.02) {
          label.style.left = '6px';
          label.style.right = 'auto';
          label.style.transform = 'translateX(0)';
        } else if (viewFraction >= 0.98) {
          label.style.left = 'auto';
          label.style.right = '6px';
          label.style.transform = 'translateX(0)';
        } else {
          label.style.left = 'auto';
          label.style.right = 'auto';
          label.style.transform = 'translateX(-50%)';
        }
      }
    },
    [clipLabelLayerRef, cursorElRef, playedElRef, waveformDuration],
  );
  useLayoutEffect(() => {
    bufferAnchorRef.current = renderedBufferAnchor;
    pendingBufferAnchorRef.current = null;
    renderFrame(getCurrentTime(), viewportAnchorRef.current);
  }, [getCurrentTime, renderFrame, renderedBufferAnchor]);
  useEffect(() => {
    let raf = 0;
    const frame = () => {
      const time = getCurrentTime();
      let anchor = viewportAnchorRef.current;
      if (playingRef.current && !draggingRef.current) {
        anchor = resolveViewportAnchor(
          viewportContextRef.current,
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
  const previousPlayingRef = useRef(playing);
  useEffect(() => {
    const wasPlaying = previousPlayingRef.current;
    previousPlayingRef.current = playing;
    if (!wasPlaying && playing) {
      if (playbackContextRef.current.type !== 'clip') {
        playbackContextRef.current = {type: 'normal'};
        setViewportFollow();
      }
      return;
    }
    if (wasPlaying && !playing) {
      if (playbackContextRef.current.type === 'clip') {
        setViewportFollow();
      }
      playbackContextRef.current = {type: 'idle'};
    }
  }, [playing, setViewportFollow]);
  useEffect(() => {
    const previous = previousTimeRef.current;
    previousTimeRef.current = currentTime;
    if (playingRef.current || draggingRef.current) {
      return;
    }
    if (Math.abs(currentTime - previous) < 1e-6) {
      return;
    }
    if (
      viewportContextRef.current.type === 'clip-follow' ||
      viewportContextRef.current.type === 'manual'
    ) {
      renderFrame(currentTime, viewportAnchorRef.current);
      return;
    }
    const next = resolveViewportAnchor(
      viewportContextRef.current,
      viewportAnchorRef.current,
      currentTime,
      hsWinLenRef.current,
      hsMaxStartRef.current,
      performance.now(),
    );
    setLiveAnchor(next);
    setViewportFollow(currentTime);
    renderFrame(currentTime, next);
  }, [currentTime, renderFrame, setLiveAnchor, setViewportFollow]);
  const completeClipPlayback = useCallback(
    (end: number) => {
      playbackContextRef.current = {type: 'idle'};

      const windowLength = hsWinLenRef.current;

      // If clip-follow reached the clip's right boundary, keep that exact
      // viewport after playback finishes. Do NOT let normal follow advance it.
      const clipEndAnchor = clampWindowAnchor(
        Math.max(0, end - windowLength),
        hsMaxStartRef.current,
      );

      const context = viewportContextRef.current;

      if (
        context.type === 'clip-follow' &&
        context.autoFollow &&
        viewportAnchorRef.current >= clipEndAnchor - 1e-6
      ) {
        setLiveAnchor(clipEndAnchor);
      }

      // Playback has stopped. Keep the resulting viewport stationary.
      viewportContextRef.current = {type: 'manual'};

      scrollingRef.current = false;
      setScrolling(false);

      renderFrame(end, viewportAnchorRef.current);
    },
    [renderFrame, setLiveAnchor, setScrolling],
  );
  const startClipRound = useCallback(
    (start: number, end: number, preserveManual = false) => {
      const viewport = viewportContextRef.current;
      // Manual takeover is preserved only between repetitions of the same
      // playRange operation. A new explicit clip click always re-arms the
      // clip from the current geometry.
      if (preserveManual && viewport.type === 'manual') return;
      const windowLength = hsWinLenRef.current;
      const result = getClipPlaybackViewport(
        start,
        end,
        viewportAnchorRef.current,
        windowLength,
        hsMaxStartRef.current,
      );
      const target = result.anchor;
      viewportContextRef.current = {
        type: 'clip-follow',
        start,
        end,
        autoFollow: result.autoFollow,
        epoch: makeFollowEpoch(target, windowLength, start),
      };
      setLiveAnchor(target, true);
      renderFrame(start, target);
    },
    [renderFrame, setLiveAnchor],
  );
  const playClip = useCallback(
    (start: number, end: number, reps: number) => {
      playbackContextRef.current = {type: 'clip', start, end};
      startClipRound(start, end);
      onPlayRange(
        start,
        end,
        reps,
        () => completeClipPlayback(end),
        () => startClipRound(start, end, true),
      );
    },
    [completeClipPlayback, onPlayRange, startClipRound],
  );
  const markManualScroll = useCallback(() => {
    scrollingRef.current = true;
    setScrolling(true);
    window.clearTimeout(scrollTimeoutRef.current);
    viewportContextRef.current = {type: 'manual'};
    if (playbackContextRef.current.type === 'clip') return;
    scrollTimeoutRef.current = window.setTimeout(() => {
      scrollingRef.current = false;
      setScrolling(false);
      const time = getCurrentTime();
      if (playingRef.current && !isTimeInViewport(time)) return;
      setViewportFollow(time);
    }, 1500);
  }, [
    getCurrentTime,
    isTimeInViewport,
    scrollTimeoutRef,
    setScrolling,
    setViewportFollow,
  ]);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startAnchor: number;
    panned: boolean;
  } | null>(null);
  const onHsPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0 && e.pointerType === 'mouse') {
        return;
      }
      const downTarget = e.target as Element;
      if (!hsRef.current?.contains(downTarget)) {
        return;
      }
      if (!trackRef.current?.contains(downTarget)) {
        return;
      }
      if (downTarget.closest('.clip-label, .stacked-clip-label')) {
        return;
      }
      if (dragRef.current?.pointerId === e.pointerId) {
        return;
      }
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
        if (ev.pointerId !== drag.pointerId) {
          return;
        }
        const dx = ev.clientX - drag.startX;
        const dy = ev.clientY - drag.startY;
        if (!drag.panned) {
          if (
            Math.abs(dx) < HS_PAN_DECIDE_PX &&
            Math.abs(dy) < HS_PAN_DECIDE_PX
          ) {
            return;
          }
          if (Math.abs(dy) >= Math.abs(dx)) {
            return;
          }
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
        markManualScroll();
      };
      const onEnd = (ev: PointerEvent) => {
        if (ev.pointerId !== drag.pointerId) {
          return;
        }
        ev.preventDefault();
        window.removeEventListener('pointermove', onMove, true);
        window.removeEventListener('pointerup', onEnd, true);
        window.removeEventListener('pointercancel', onEnd, true);
        dragRef.current = null;
        draggingRef.current = false;
        if (drag.panned) {
          suppressClickRef.current = true;
        }
      };
      window.addEventListener('pointermove', onMove, true);
      window.addEventListener('pointerup', onEnd, true);
      window.addEventListener('pointercancel', onEnd, true);
    },
    [markManualScroll, setLiveAnchor],
  );
  useEffect(() => {
    const element = hsRef.current;
    if (!element) return;
    const onWheel = (e: WheelEvent) => {
      const dSec = calculateWheelChange(
        e,
        trackRef.current,
        element,
        hsWinLenRef.current,
      );
      if (dSec) {
        setLiveAnchor(viewportAnchorRef.current + dSec);
        markManualScroll();
      }
    };
    element.addEventListener('wheel', onWheel, {
      passive: false,
    });
    return () => element.removeEventListener('wheel', onWheel);
  }, [markManualScroll, setLiveAnchor]);
  const onWaveformClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (suppressClickRef.current) {
        suppressClickRef.current = false;
        return;
      }
      if (playbackContextRef.current.type === 'clip') return;
      const rect = e.currentTarget.getBoundingClientRect();
      const fraction = Math.max(
        0,
        Math.min(1, (e.clientX - rect.left) / rect.width),
      );
      const target = viewportAnchorRef.current + fraction * hsWinLenRef.current;
      onSeek(target);
      onActiveClipChange(-1);
      viewportContextRef.current = {
        type: 'cursor-hold',
        epoch: makeFollowEpoch(
          viewportAnchorRef.current,
          hsWinLenRef.current,
          target,
        ),
        holdUntil: performance.now() + CURSOR_CLICK_HOLD_MS,
      };
    },
    [onActiveClipChange, onSeek],
  );
  const onRootClickCapture = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!suppressClickRef.current) {
        return;
      }
      suppressClickRef.current = false;
      e.stopPropagation();
    },
    [],
  );
  const getStripPlayedPct = useCallback(() => {
    const bufferLen = bufferLengthRef.current;
    if (bufferLen <= 0) {
      return 0;
    }
    return (getCurrentTime() - bufferAnchorRef.current) / bufferLen;
  }, [getCurrentTime]);
  return {
    hsRef,
    trackRef,
    renderedBufferAnchor,
    hsAnchor: windowSecs,
    hsWinLenRef,
    hsMaxStartRef,
    bufferLengthRef,
    bufferAnchorRef,
    viewportAnchorRef,
    playbackContextRef,
    viewportContextRef,
    hsSmoothRef: viewportAnchorRef,
    innerH,
    onHsPointerDown,
    onRootClickCapture,
    onWaveformClick,
    getStripPlayedPct,
    playClip,
  };
}
