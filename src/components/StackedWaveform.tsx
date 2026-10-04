/**
 * Stacked waveform view - each clip group renders as a fixed-height row of
 * bars, arranged in horizontally scrollable pages.
 *
 * Gesture ownership:
 * - tap on clip       -> select/play clip
 * - vertical swipe    -> split/merge clip
 * - horizontal drag   -> page navigation
 *
 * Horizontal page dragging is owned by this component rather than Clip.
 * This allows a page drag to begin anywhere, including directly on a clip.
 */

import {memo, useCallback, useEffect, useMemo, useRef, useState} from 'react';

import {ClipLabel} from './ClipLabel';
import {Clips} from './Clips';
import {WaveformCursor} from './WaveformCursor';
import {WaveformCanvas} from './Waveform';

import {type WaveformData} from '../types';
import type {Clip as ClipData} from '../utils/clips';
import {startFrameLoop} from '../utils/raf';
import {addListener} from '../utils/listener';
import './StackedWaveform.css';
import {getWindowSecs} from '../utils/rowWaveform';

const VB_W = 1000;
const VB_H = 200;
const PAD = 4;

const ROW_H = 64;
const ROW_GAP = 4;

const HORIZONTAL_DRAG_THRESHOLD = 8;

interface StackedWaveformProps {
  waveform: WaveformData;

  displayClips: ClipData[];

  currentTime: number;

  playing: boolean;

  activeClip: number;

  repetitions: number;

  onStopPlayback?: () => void;

  onSwipeClip?: (idx: number, direction: 'up' | 'down') => void;

  onSeek: (time: number) => void;

  onActiveClipChange: (idx: number) => void;

  onPlayRange: (
    start: number,
    end: number,
    repetitions: number,
    onComplete?: () => void,
  ) => void;

  getCurrentTime: () => number;
}

type StackedRow = {
  start: number;
  end: number;

  clips: {
    clip: ClipData;
    idx: number;
  }[];
};

type StackedRowEntry = {
  row: StackedRow;
  gi: number;
};

interface PageDrag {
  pointerId: number;

  startX: number;
  startY: number;

  startScrollLeft: number;

  dragging: boolean;
}

export const StackedWaveform = memo(
  ({
    waveform,
    displayClips,
    currentTime,
    playing,
    activeClip,
    repetitions,
    onStopPlayback,
    onSwipeClip,
    onSeek,
    onActiveClipChange,
    onPlayRange,
    getCurrentTime,
  }: StackedWaveformProps) => {
    const innerH = VB_H - PAD * 2;
    const scrollerRef = useRef<HTMLDivElement>(null);
    /*
     * =========================================================
     * ROWS
     * =========================================================
     */

    const windowSecs = useRef(0);

    const stackedRows = useMemo<StackedRow[]>(() => {
      const el = scrollerRef?.current;

      if (!el) return [];
      const rows: StackedRow[] = [];

      let cur: StackedRow | null = null;
      windowSecs.current = getWindowSecs(
        el.clientWidth,
        displayClips,
        waveform.duration,
      );

      displayClips.forEach((clip, idx) => {
        const duration = clip.vEnd - clip.vStart;

        if (!cur || duration + (cur.end - cur.start) <= windowSecs.current) {
          if (!cur) {
            cur = {
              start: clip.vStart,
              end: clip.vEnd,
              clips: [],
            };
          }

          cur.end = clip.vEnd;

          cur.clips.push({
            clip,
            idx,
          });
        } else {
          rows.push(cur);

          cur = {
            start: clip.vStart,
            end: clip.vEnd,
            clips: [
              {
                clip,
                idx,
              },
            ],
          };
        }
      });

      if (cur) {
        rows.push(cur);
      }

      if (rows.length > 0) {
        /*
         * First row represents the beginning of
         * the waveform even if the first detected
         * clip starts slightly later.
         */
        rows[0].start = 0;

        /*
         * Last row reaches the physical end of
         * the audio.
         */
        rows[rows.length - 1].end = Math.max(
          rows[rows.length - 1].end,
          waveform.duration,
        );
      }

      return rows;
    }, [displayClips, waveform.duration, scrollerRef.current?.clientWidth]);

    /*
     * =========================================================
     * SCROLLER STATE
     * =========================================================
     */

    const pendingAutoScrollRef = useRef(false);

    const autoScrollResetRef = useRef<number | undefined>(undefined);

    const currentPageRef = useRef(-1);

    const previousTimeRef = useRef(currentTime);

    const userScrollTimerRef = useRef<number | undefined>(undefined);

    /*
     * If the user manually browses during playback,
     * automatic following pauses until playback
     * catches up again.
     */
    const manualOverrideRef = useRef(false);

    const playingRef = useRef(playing);

    /*
     * Pointer state for horizontal page dragging.
     */
    const dragRef = useRef<PageDrag | null>(null);

    /*
     * Prevent a completed page drag from turning
     * into a seek click on the row underneath.
     */
    const suppressRowClickRef = useRef(false);

    useEffect(() => {
      playingRef.current = playing;
    }, [playing]);

    const [containerH, setContainerH] = useState(0);

    const [userScrolling, setUserScrolling] = useState(false);

    const [viewPage, setViewPage] = useState(0);

    const [clipPlayActive, setClipPlayActive] = useState(false);

    /*
     * =========================================================
     * WHEEL -> HORIZONTAL SCROLL
     * =========================================================
     */

    useEffect(() => {
      const el = scrollerRef.current;

      if (!el) return;

      const onWheel = (e: WheelEvent) => {
        const dx = Math.abs(e.deltaX);
        const dy = Math.abs(e.deltaY);

        if (dy > dx) {
          e.preventDefault();

          el.scrollLeft += e.deltaY;
        }
      };

      return addListener(el, 'wheel', onWheel, {passive: false});
    }, []);

    /*
     * =========================================================
     * CONTAINER SIZE
     * =========================================================
     */

    useEffect(() => {
      const el = scrollerRef.current;

      if (!el) return;

      const update = () => {
        setContainerH(el.clientHeight);
      };

      update();

      const observer = new ResizeObserver(update);

      observer.observe(el);

      return () => {
        observer.disconnect();
      };
    }, []);

    const rowGap = useMemo(
      () =>
        containerH
          ? Math.min(24, Math.max(ROW_GAP, Math.floor(containerH / 45)))
          : ROW_GAP,
      [containerH],
    );

    const rowsPerPage = useMemo(() => {
      if (!containerH) {
        return 1;
      }

      return Math.max(1, Math.floor(containerH / (ROW_H + rowGap)));
    }, [containerH, rowGap]);

    /*
     * =========================================================
     * PAGES
     * =========================================================
     */

    const pagedRows = useMemo<StackedRowEntry[][]>(() => {
      const pages: StackedRowEntry[][] = [];

      for (let i = 0; i < stackedRows.length; i += rowsPerPage) {
        pages.push(
          stackedRows.slice(i, i + rowsPerPage).map((row, r) => ({
            row,
            gi: i + r,
          })),
        );
      }

      return pages;
    }, [stackedRows, rowsPerPage]);

    const pageTimes = useMemo(
      () =>
        pagedRows.map(page => ({
          start: page[0]?.row.start ?? 0,

          end: page[page.length - 1]?.row.end ?? 0,
        })),
      [pagedRows],
    );

    const pageTimesRef = useRef(pageTimes);

    useEffect(() => {
      pageTimesRef.current = pageTimes;
    }, [pageTimes]);

    /*
     * =========================================================
     * PAGE HELPERS
     * =========================================================
     */

    const clampPage = useCallback(
      (page: number) => {
        if (pagedRows.length === 0) {
          return 0;
        }

        return Math.max(0, Math.min(pagedRows.length - 1, page));
      },
      [pagedRows.length],
    );

    const scrollToPage = useCallback(
      (page: number, behavior: ScrollBehavior = 'smooth') => {
        const el = scrollerRef.current;

        if (!el) return;

        const target = clampPage(page);

        pendingAutoScrollRef.current = true;

        window.clearTimeout(autoScrollResetRef.current);

        autoScrollResetRef.current = window.setTimeout(() => {
          pendingAutoScrollRef.current = false;
        }, 1000);

        el.scrollTo({
          left: target * el.clientWidth,

          behavior,
        });
      },
      [clampPage],
    );

    const pageForTime = useCallback((time: number) => {
      const pages = pageTimesRef.current;

      if (!pages.length) {
        return 0;
      }

      const last = pages.length - 1;

      if (time < pages[0].start) {
        return 0;
      }

      if (time >= pages[last].end) {
        return last;
      }

      for (let i = 0; i < pages.length; i++) {
        if (time < pages[i].end) {
          return i;
        }
      }

      return last;
    }, []);

    /*
     * =========================================================
     * HORIZONTAL POINTER DRAG
     *
     * The parent observes every pointer gesture, including
     * gestures that START on a clip.
     *
     * It does not capture immediately.
     *
     * First we determine direction:
     *
     *     vertical   -> Clip owns it
     *     horizontal -> page scroller owns it
     *
     * This is the key fix.
     * =========================================================
     */

    const handlePointerDown = useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.pointerType === 'mouse' && e.button !== 0) {
          return;
        }

        const el = scrollerRef.current;

        if (!el) return;

        dragRef.current = {
          pointerId: e.pointerId,

          startX: e.clientX,
          startY: e.clientY,

          startScrollLeft: el.scrollLeft,

          dragging: false,
        };
      },
      [],
    );

    const handlePointerMove = useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;

        const el = scrollerRef.current;

        if (!drag || !el || drag.pointerId !== e.pointerId) {
          return;
        }

        const dx = e.clientX - drag.startX;

        const dy = e.clientY - drag.startY;

        /*
         * Direction has not yet been decided.
         */
        if (!drag.dragging) {
          if (
            Math.abs(dx) < HORIZONTAL_DRAG_THRESHOLD &&
            Math.abs(dy) < HORIZONTAL_DRAG_THRESHOLD
          ) {
            return;
          }

          /*
           * Vertical gesture.
           *
           * Leave it alone so Clip can interpret
           * swipe-up / swipe-down.
           */
          if (Math.abs(dy) >= Math.abs(dx)) {
            return;
          }

          /*
           * Horizontal gesture.
           *
           * From this point the page scroller owns it.
           */
          drag.dragging = true;

          suppressRowClickRef.current = true;

          setUserScrolling(true);

          if (playingRef.current) {
            manualOverrideRef.current = true;
          }

          /*
           * Capture only AFTER direction has
           * been identified as horizontal.
           */
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // Some browsers may already have lost it.
          }
        }

        e.preventDefault();

        /*
         * Natural touch paging:
         *
         * finger moves left  -> content moves left
         *                      -> next page
         *
         * finger moves right -> previous page
         */
        el.scrollLeft = drag.startScrollLeft - dx;
      },
      [],
    );

    const finishPointerDrag = useCallback(
      (e: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;

        const el = scrollerRef.current;

        if (!drag || !el || drag.pointerId !== e.pointerId) {
          return;
        }

        dragRef.current = null;

        if (!drag.dragging) {
          return;
        }

        try {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
          }
        } catch {
          // Ignore capture cleanup failures.
        }

        const pageWidth = Math.max(1, el.clientWidth);

        const page = clampPage(Math.round(el.scrollLeft / pageWidth));

        currentPageRef.current = page;

        setViewPage(page);

        /*
         * This is a USER initiated snap.
         *
         * Do not use scrollToPage(), because that helper
         * marks the movement as an automatic scroll.
         */
        el.scrollTo({
          left: page * pageWidth,

          behavior: 'smooth',
        });

        window.clearTimeout(userScrollTimerRef.current);

        userScrollTimerRef.current = window.setTimeout(() => {
          setUserScrolling(false);
        }, 500);
      },
      [clampPage],
    );

    /*
     * =========================================================
     * NATIVE SCROLL EVENTS
     * =========================================================
     */

    useEffect(() => {
      const el = scrollerRef.current;

      if (!el) return;

      const onScroll = () => {
        /*
         * Programmatic auto-follow scroll.
         */
        if (pendingAutoScrollRef.current) {
          return;
        }

        window.clearTimeout(userScrollTimerRef.current);

        setUserScrolling(true);

        const idx = clampPage(
          Math.round(el.scrollLeft / Math.max(1, el.clientWidth)),
        );

        currentPageRef.current = idx;

        setViewPage(idx);

        if (playingRef.current) {
          manualOverrideRef.current = true;
        }

        userScrollTimerRef.current = window.setTimeout(() => {
          setUserScrolling(false);
        }, 1500);
      };

      const stopScrollListener = addListener(el, 'scroll', onScroll, {
        passive: true,
      });

      return () => {
        stopScrollListener();

        window.clearTimeout(userScrollTimerRef.current);

        window.clearTimeout(autoScrollResetRef.current);
      };
    }, [clampPage]);

    /*
     * =========================================================
     * PLAYBACK AUTO-FOLLOW
     * =========================================================
     */

    useEffect(() => {
      return startFrameLoop(() => {
        if (!playing || userScrolling) {
          return;
        }

        const time = getCurrentTime();

        if (!Number.isFinite(time)) {
          return;
        }

        const page = pageForTime(time);

        if (page === currentPageRef.current) {
          manualOverrideRef.current = false;

          return;
        }

        if (page > currentPageRef.current && !manualOverrideRef.current) {
          currentPageRef.current = page;

          setViewPage(page);

          scrollToPage(page);
        }
      });
    }, [playing, userScrolling, pageForTime, scrollToPage, getCurrentTime]);

    /*
     * =========================================================
     * EXPLICIT SEEK
     * =========================================================
     */

    useEffect(() => {
      const previousTime = previousTimeRef.current;

      previousTimeRef.current = currentTime;

      if (Math.abs(currentTime - previousTime) < 1) {
        return;
      }

      const page = pageForTime(currentTime);

      if (playing && page > currentPageRef.current) {
        return;
      }

      if (clipPlayActive && page < currentPageRef.current) {
        return;
      }

      if (page === currentPageRef.current) {
        return;
      }

      currentPageRef.current = page;

      setViewPage(page);

      scrollToPage(page);
    }, [currentTime, pageForTime, playing, clipPlayActive, scrollToPage]);

    /*
     * Reset manual override when playback state or
     * waveform structure changes.
     */
    useEffect(() => {
      manualOverrideRef.current = false;
    }, [playing, stackedRows]);

    /*
     * =========================================================
     * ACTIVE CLIP FOLLOW
     * =========================================================
     */

    useEffect(() => {
      if (activeClip < 0) {
        return;
      }

      const clip = displayClips[activeClip];

      if (!clip) return;

      const page = pageForTime((clip.vStart + clip.vEnd) / 2);

      if (page !== currentPageRef.current) {
        currentPageRef.current = page;

        setViewPage(page);

        scrollToPage(page);
      }
    }, [activeClip, displayClips, pageForTime, scrollToPage]);

    /*
     * =========================================================
     * SEEK
     * =========================================================
     */

    const handleRowSeek = useCallback(
      (time: number) => {
        onSeek(time);

        onActiveClipChange(-1);

        const page = pageForTime(time);

        if (page !== currentPageRef.current) {
          currentPageRef.current = page;

          setViewPage(page);
        }

        scrollToPage(page);
      },
      [onSeek, onActiveClipChange, pageForTime, scrollToPage],
    );

    /*
     * =========================================================
     * CLIP PLAYBACK
     * =========================================================
     */

    const stackedPlayClip = useCallback(
      (start: number, end: number, reps: number) => {
        setClipPlayActive(true);

        onPlayRange(start, end, reps, () => {
          setClipPlayActive(false);
        });
      },
      [onPlayRange],
    );

    /*
     * =========================================================
     * RENDER
     * =========================================================
     */

    return (
      <div
        className="stacked-waveform"
        ref={scrollerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointerDrag}
        onPointerCancel={finishPointerDrag}
      >
        {pagedRows.length > 0 && (
          <div className="stacked-waveform__pageno">
            {Math.min(viewPage + 1, pagedRows.length)} / {pagedRows.length}
          </div>
        )}

        <div className="stacked-waveform__pages">
          {pagedRows.map((page, pageIndex) => (
            <div key={pageIndex} className="stacked-waveform__page">
              {page.map(({row, gi}) => {
                const rowStart = row.start;

                const rowLen = Math.max(
                  windowSecs.current,
                  row.end - row.start,
                );

                const getPlayedPct = () =>
                  Math.max(
                    0,
                    Math.min(1, (getCurrentTime() - rowStart) / rowLen),
                  );

                const getCursorPct = () =>
                  Math.min(getPlayedPct(), (row.end - rowStart) / rowLen);

                const isLastRow = row.end >= waveform.duration - 1e-6;

                const showCursor =
                  currentTime >= rowStart &&
                  (currentTime < row.end ||
                    (isLastRow && currentTime >= row.end - 1e-6));

                return (
                  <div
                    key={gi}
                    className="stacked-waveform__row"
                    onClick={e => {
                      /*
                       * A horizontal page drag must
                       * never become a seek.
                       */
                      if (suppressRowClickRef.current) {
                        suppressRowClickRef.current = false;

                        return;
                      }

                      if (clipPlayActive) {
                        return;
                      }

                      const rect = e.currentTarget.getBoundingClientRect();

                      const f = Math.max(
                        0,
                        Math.min(1, (e.clientX - rect.left) / rect.width),
                      );

                      handleRowSeek(rowStart + f * rowLen);
                    }}
                  >
                    <WaveformCanvas
                      className="stacked-waveform__svg"
                      data={waveform.data}
                      sampleRate={waveform.sampleRate}
                      window={{
                        windowStartSec: rowStart,

                        windowLen: rowLen,

                        innerH,

                        vbW: VB_W,

                        vbH: VB_H,
                      }}
                      contentEndSec={row.end}
                    />

                    <div className="stacked-waveform__clip-layer">
                      <Clips
                        clips={row.clips.map(({clip}) => clip)}
                        window={{
                          windowStartSec: rowStart,

                          windowLen: rowLen,

                          innerH,

                          vbW: VB_W,

                          vbH: VB_H,
                        }}
                        onPlayRange={stackedPlayClip}
                        repetitions={repetitions}
                        playing={playing}
                        onStopPlayback={onStopPlayback}
                        activeClip={activeClip}
                        onActivate={onActiveClipChange}
                        onSwipe={onSwipeClip}
                        getIdx={(_clip, i) => row.clips[i].idx}
                        renderLabel={(id, clip) => (
                          <ClipLabel
                            key={`lbl-${id}`}
                            index={id}
                            duration={clip.vEnd - clip.vStart}
                            active={id === activeClip}
                            canSplit={
                              !playing &&
                              !!clip.children &&
                              clip.children.length > 1
                            }
                            canMerge={
                              !playing &&
                              (id > 0 || id < displayClips.length - 1)
                            }
                            onSplit={
                              onSwipeClip
                                ? () => onSwipeClip(id, 'up')
                                : undefined
                            }
                            onMerge={
                              onSwipeClip
                                ? () => onSwipeClip(id, 'down')
                                : undefined
                            }
                          />
                        )}
                      />
                    </div>

                    {showCursor && (
                      <WaveformCursor
                        view="stacked"
                        getPlayedPct={getCursorPct}
                        getCurrentTime={getCurrentTime}
                      />
                    )}
                  </div>
                );
              })}

              {Array.from({
                length: Math.max(0, rowsPerPage - page.length),
              }).map((_, virtualIndex) => (
                <div
                  key={`virtual-${virtualIndex}`}
                  className="stacked-waveform__row stacked-waveform__row--virtual"
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  },
);
