/**
 * Stacked waveform view - each clip group renders as a fixed-height row of
 * bars, arranged in horizontally scrollable "pages".
 *
 * Features:
 * - Groups silence-split clips into rows of ~STACK_ROW_TARGET_SECS; every row
 *   has a fixed height
 * - Pages the rows into fixed-height pages (one viewport per page), scrolled
 *   horizontally with page snapping
 * - Auto-advances to the next page once playback crosses the current page's
 *   time range
 * - rAF-updated cursor + time label per row
 * - Clip click/range playback via the shared Clip overlay
 */

import { memo, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Clip } from "./Clip";
import { ClipLabel } from "./ClipLabel";
import { WaveformCursor } from "./WaveformCursor";
import { WaveformBars } from "./Waveform";
import { type WaveformData } from "../types";
import type { Clip as ClipData } from "../utils/clips";
import { canSplitClip } from "../utils/swipe";

const STACK_ROW_TARGET_SECS = 10;
const VB_W = 1000;
const VB_H = 200;
const PAD = 4;
const ROW_H = 64;
const ROW_GAP = 4;

interface StackedWaveformProps {
  waveform: WaveformData;
  displayClips: ClipData[];
  currentTime: number;
  playing: boolean;
  activeClip: number;
  repetitions: number;
  minSilenceLength: number;
  onStopPlayback?: () => void;
  onSwipeClip?: (idx: number, direction: "up" | "down") => void;
  onSeek: (time: number) => void;
  onActiveClipChange: (idx: number) => void;
  onPlayRange: (
    start: number,
    end: number,
    repetitions: number,
    onComplete?: () => void,
  ) => void;
  onClipPlayActiveChange?: (active: boolean) => void;
  getCurrentTime: () => number;
}

type StackedRow = {
  start: number;
  end: number;
  clips: { clip: ClipData; idx: number }[];
};

type StackedRowEntry = { row: StackedRow; gi: number };

export const StackedWaveform = memo(function StackedWaveform({
  waveform,
  displayClips,
  currentTime,
  playing,
  activeClip,
  repetitions,
  minSilenceLength,
  onStopPlayback,
  onSwipeClip,
  onSeek,
  onActiveClipChange,
  onPlayRange,
  onClipPlayActiveChange,
  getCurrentTime,
}: StackedWaveformProps) {
  const innerH = VB_H - PAD * 2;

  const stackedRows = useMemo<StackedRow[]>(() => {
    const rows: StackedRow[] = [];
    let cur: StackedRow | null = null;
    displayClips.forEach((s, idx) => {
      const dur = s.vEnd - s.vStart;
      if (!cur || dur + (cur.end - cur.start) <= STACK_ROW_TARGET_SECS) {
        if (!cur) cur = { start: s.vStart, end: s.vEnd, clips: [] };
        cur.end = s.vEnd;
        cur.clips.push({ clip: s, idx });
      } else {
        rows.push(cur);
        cur = { start: s.vStart, end: s.vEnd, clips: [{ clip: s, idx }] };
      }
    });
    if (cur) rows.push(cur);
    if (rows.length > 0) {
      rows[0].start = 0; // first row always starts at 0
      rows[rows.length - 1].end = Math.max(
        rows[rows.length - 1].end,
        waveform.duration,
      ); // last row always ends at the waveform end
    }
    return rows;
  }, [displayClips]);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const pendingAutoScrollRef = useRef(false);
  const autoScrollResetRef = useRef<number | undefined>(undefined);
  const currentPageRef = useRef(-1);
  const userScrollTimerRef = useRef<number | undefined>(undefined);
  // Set when the user manually scrolls during playback: auto-advance pauses
  // until the playhead catches up to the page they are viewing (or playback
  // restarts) so the follow never yanks the view back away from them.
  const manualOverrideRef = useRef(false);
  const playingRef = useRef(playing);
  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  const [containerH, setContainerH] = useState(0);
  const [userScrolling, setUserScrolling] = useState(false);
  const [viewPage, setViewPage] = useState(0);

  // Mouse-wheel users have no deltaX: translate vertical wheel motion into
  // horizontal paging so the pages can always be scrolled by hand.
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
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Fixed page height = the height of the (fixed-height) scroll viewport.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const update = () => setContainerH(el.clientHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Row separation scales gently with the container height so a taller
  // progress area reads as more air between rows. Every page shares the same
  // container, so the gap is identical across pages.
  const rowGap = useMemo(
    () =>
      containerH
        ? Math.min(24, Math.max(ROW_GAP, Math.floor(containerH / 45)))
        : ROW_GAP,
    [containerH],
  );

  // Rows per page is derived from the fixed height: `floor(H / (ROW_H + gap))`.
  const rowsPerPage = useMemo(() => {
    if (!containerH) return 1;
    return Math.max(1, Math.floor(containerH / (ROW_H + rowGap)));
  }, [containerH, rowGap]);

  const pagedRows = useMemo<StackedRowEntry[][]>(() => {
    const out: StackedRowEntry[][] = [];
    for (let i = 0; i < stackedRows.length; i += rowsPerPage) {
      out.push(
        stackedRows
          .slice(i, i + rowsPerPage)
          .map((row, r) => ({ row, gi: i + r })),
      );
    }
    return out;
  }, [stackedRows, rowsPerPage]);

  const pageTimes = useMemo(
    () =>
      pagedRows.map((page) => ({
        start: page[0]?.row.start ?? 0,
        end: page[page.length - 1]?.row.end ?? 0,
      })),
    [pagedRows],
  );
  const pageTimesRef = useRef(pageTimes);
  useEffect(() => {
    pageTimesRef.current = pageTimes;
  }, [pageTimes]);

  const scrollToPage = useCallback((i: number) => {
    const el = scrollerRef.current;
    if (!el || i < 0) return;
    pendingAutoScrollRef.current = true;
    window.clearTimeout(autoScrollResetRef.current);
    // Keep the auto-scroll's own trailing scroll events (Chrome smooth-scroll
    // lasts up to ~500ms) covered so they never read as a manual pan, without
    // leaving a long dead window where real user pans go unrecorded.
    autoScrollResetRef.current = window.setTimeout(() => {
      pendingAutoScrollRef.current = false;
    }, 1000);
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  }, []);

  // Monotonic time→page mapping: returns the first page whose end is ahead of
  // `t`, so crossing a page's end (even through a between-page silence gap)
  // advances to the *next* page instead of falling through to the last one.
  const pageForTime = useCallback((t: number) => {
    const pages = pageTimesRef.current;
    if (!pages.length) return 0;
    const last = pages.length - 1;
    if (t < pages[0].start) return 0;
    if (t >= pages[last].end) return last;
    for (let i = 0; i < pages.length; i++) {
      if (t < pages[i].end) return i;
    }
    return last;
  }, []);

  // Distinguish manual paging (snapped on each scroll event) from the
  // programmatic page advances, so the playhead-follow doesn't fight the user.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => {
      if (pendingAutoScrollRef.current) return;
      window.clearTimeout(userScrollTimerRef.current);
      setUserScrolling(true);
      const idx = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
      currentPageRef.current = idx;
      setViewPage(Math.max(0, idx));
      if (playingRef.current) manualOverrideRef.current = true;
      userScrollTimerRef.current = window.setTimeout(
        () => setUserScrolling(false),
        1500,
      );
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.clearTimeout(userScrollTimerRef.current);
      window.clearTimeout(autoScrollResetRef.current);
    };
  }, []);

  // Auto-advance driven by the LIVE element clock (mirrors RowWaveform's
  // follow): every animation frame while playing, read `getCurrentTime()` and
  // the instant the playhead crosses the current page's end, glide to the next
  // page. The Redux `currentTime` (~4Hz timeupdate) reads as laggy/aliased and
  // must not gate the page flip.
  //
  // Direction rules keep manual browsing usable during playback:
  // - playing page == viewed page  -> in sync; drop any manual override
  // - playing page is FARTHER ahead -> auto-advance (unless the user just
  //   manually scrolled back: then respect them and do not chase)
  // - playing page is EARLIER       -> user is previewing a later page; never
  //   yank the view backwards
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!playing || userScrolling) return;
      const t = getCurrentTime();
      if (!Number.isFinite(t)) return;
      const idx = pageForTime(t);
      if (idx === currentPageRef.current) {
        manualOverrideRef.current = false;
        return;
      }
      if (idx > currentPageRef.current && !manualOverrideRef.current) {
        currentPageRef.current = idx;
        setViewPage(idx);
        scrollToPage(idx);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, userScrolling, pageForTime, scrollToPage, getCurrentTime]);

  // A manual browse stays put across a pause; restarting playback or loading a
  // new track resets it so the follow can resume.
  useEffect(() => {
    manualOverrideRef.current = false;
  }, [playing, stackedRows]);

  // Selecting a clip moves to its page so the clicked clip becomes visible.
  useEffect(() => {
    if (activeClip < 0) return;
    const c = displayClips[activeClip];
    if (!c) return;
    const idx = pageForTime((c.vStart + c.vEnd) / 2);
    if (idx !== currentPageRef.current) {
      currentPageRef.current = idx;
      setViewPage(idx);
      scrollToPage(idx);
    }
  }, [activeClip, displayClips, pageForTime, scrollToPage]);

  const handleRowSeek = useCallback(
    (time: number) => {
      onSeek(time);
      onActiveClipChange(-1);
      const idx = pageForTime(time);
      if (idx !== currentPageRef.current) {
        currentPageRef.current = idx;
        setViewPage(idx);
      }
      scrollToPage(idx);
    },
    [onSeek, onActiveClipChange, pageForTime, scrollToPage],
  );

  const [clipPlayActive, setClipPlayActive] = useState(false);
  useEffect(() => {
    onClipPlayActiveChange?.(clipPlayActive);
  }, [clipPlayActive, onClipPlayActiveChange]);

  const stackedPlayClip = useCallback(
    (start: number, end: number, reps: number) => {
      setClipPlayActive(true);
      onPlayRange(start, end, reps, () => setClipPlayActive(false));
    },
    [onPlayRange],
  );

  return (
    <div className="stacked-waveform" ref={scrollerRef}>
      {pagedRows.length > 0 && (
        <div className="stacked-waveform__pageno">
          {Math.min(viewPage + 1, pagedRows.length)} / {pagedRows.length}
        </div>
      )}
      <div className="stacked-waveform__pages">
        {pagedRows.map((page, pi) => (
          <div
            key={pi}
            className="stacked-waveform__page"
          >
            {page.map(({ row, gi }) => {
              const rowStart = row.start;
              // Every row renders on the same time scale: a full-width row is
              // always STACK_ROW_TARGET_SECS (unless a single clip is longer).
              // Content that ends early just leaves blank space on the right,
              // so short rows don't stretch (which would change per-row cursor
              // and clip animation speeds).
              const rowLen = Math.max(
                STACK_ROW_TARGET_SECS,
                row.end - row.start,
              );
              const getPlayedPct = () =>
                Math.max(0, Math.min(1, (getCurrentTime() - rowStart) / rowLen));
              return (
                <div
                  key={gi}
                  className="stacked-waveform__row"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const f = Math.max(
                      0,
                      Math.min(1, (e.clientX - rect.left) / rect.width),
                    );
                    handleRowSeek(rowStart + f * rowLen);
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
                      window={{
                        windowStartSec: rowStart,
                        windowLen: rowLen,
                        innerH,
                        vbW: VB_W,
                        vbH: VB_H,
                      }}
                      fracPlayed={getPlayedPct()}
                      idPrefix={`stack-${gi}`}
                      contentEndSec={row.end}
                    />
                    <Clip
                      clips={row.clips.map(({ clip }) => clip)}
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
                      onActivate={(idx) => {
                        onActiveClipChange(idx);
                      }}
                      onSwipe={onSwipeClip}
                      getIdx={(_c, i) => row.clips[i].idx}
                    />
                  </svg>
                  {currentTime >= rowStart && currentTime < row.end && (
                    <WaveformCursor
                      view="stacked"
                      getPlayedPct={getPlayedPct}
                      getCurrentTime={getCurrentTime}
                    />
                  )}
                  {row.clips.map(({ clip: s, idx }) => {
                    const center =
                      ((s.vStart + (s.vEnd - s.vStart) / 2 - rowStart) /
                        rowLen) *
                      100;
                    return (
                      <ClipLabel
                        key={`lbl-${idx}`}
                        index={idx}
                        duration={s.vEnd - s.vStart}
                        left={center}
                        active={idx === activeClip}
                        canSplit={
                          !playing && canSplitClip(s, minSilenceLength)
                        }
                        canMerge={
                          !playing &&
                          (idx > 0 || idx < displayClips.length - 1)
                        }
                        onSplit={
                          onSwipeClip ? () => onSwipeClip(idx, "up") : undefined
                        }
                        onMerge={
                          onSwipeClip
                            ? () => onSwipeClip(idx, "down")
                            : undefined
                        }
                      />
                    );
                  })}
                </div>
              );
            })}
            {/* The last page may hold fewer rows than a full page: pad it with
                invisible placeholders that occupy the same row space so the
                page keeps the same vertical rhythm (and height) as the others. */}
            {Array.from({
              length: Math.max(0, rowsPerPage - page.length),
            }).map((_, vi) => (
              <div
                key={`virtual-${vi}`}
                className="stacked-waveform__row stacked-waveform__row--virtual"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
});