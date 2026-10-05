/**
 * Main progress and waveform visualization component.
 *
 * Shows the decoded waveform (stacked or horizontal view), the silence-split
 * clips, and the interactive clip toolbar.
 *
 * The waveform view switch is rendered directly under progress-container.
 * Its visual styling and page-flip behavior are owned by
 * WaveformViewFlipButton.
 */

import {useMemo, useCallback, useRef, useState, useEffect} from 'react';

import {shallowEqual} from 'react-redux';

import {RowWaveform} from './RowWaveform';
import {StackedWaveform} from './StackedWaveform';
import {ClipToolbar} from './ClipToolbar';
import {ClipToolbarCollapsedHit} from './ClipToolbarCollapsedHit';
import {WaveformViewFlipButton} from './WaveformViewFlipButton';

import {useAppDispatch, useAppSelector} from '../store/hooks';

import {
  selectCurrentAudio,
  selectWaveformView,
  selectIsPlaying,
  selectRepetitions,
  selectShowAdvancedControls,
  selectMergeScope,
} from '../store/selectors';

import {updateConfig} from '../store/configSlice';

import {mergeClipsByGap} from '../utils/clips';
import type {Clip as InitClipData} from '../utils/clips';
import type {ClipPlayRequest} from '../types';
import './ProgressBar.css';

import {splitClip, mergeClips} from '../utils/swipe';

interface ProgressBarProps {
  /** Seek to an absolute track time (seconds). */
  onSeek: (time: number) => void;

  /**
   * Play a range, repeating `repetitions` times,
   * with an optional completion callback.
   */
  onPlayRange: (
    start: number,
    end: number,
    repetitions: number,
    onComplete?: () => void,
  ) => void;

  onStopPlayback: () => void;

  getAnalyser?: () => AnalyserNode | null;

  /** Returns the current playback time in seconds. */
  getCurrentTime: () => number;
}

export function ProgressBar({
  onSeek,
  onPlayRange,
  onStopPlayback,
  getAnalyser,
  getCurrentTime,
}: ProgressBarProps) {
  const dispatch = useAppDispatch();

  const audio = useAppSelector(selectCurrentAudio, shallowEqual);

  const waveformView = useAppSelector(selectWaveformView);

  const playing = useAppSelector(selectIsPlaying);

  const repetitions = useAppSelector(selectRepetitions);

  const showAdvancedControls = useAppSelector(selectShowAdvancedControls);

  const mergeScope = useAppSelector(selectMergeScope);

  const {waveform, waveformStatus, clips, currentTime, minGap} = audio;

  const hasWaveform = waveform !== null && waveform.data.length > 0;

  /*
   * Merge gap is derived from the detected silence gaps
   * for the current waveform.
   */
  const [mergeGap, setMergeGap] = useState(minGap);

  useEffect(() => {
    setMergeGap(minGap);
  }, [minGap]);

  /*
   * The grouping the detector itself asked for, before any user merge/split.
   * This is the starting point for "clip" scope.
   */
  const baselineClips = useMemo(
    () => mergeClipsByGap(clips, minGap),
    [clips, minGap],
  );

  /*
   * "clip" scope cannot be derived from a single threshold, so the regrouped
   * list is held here instead and only ever changed by a gesture or by the
   * slider acting on the selected clip. `null` means "not regrouped yet", i.e.
   * show the baseline.
   *
   * Reset per track change (see below) so it can never leak across tracks.
   */
  const [scopedClips, setScopedClips] = useState<InitClipData[] | null>(null);

  const displayClips = useMemo(() => {
    if (mergeScope === 'clip') return scopedClips ?? baselineClips;
    return mergeClipsByGap(clips, mergeGap);
  }, [mergeScope, scopedClips, baselineClips, clips, mergeGap]);

  /*
   * Scroll state shared with RowWaveform's follow behavior.
   */
  const [scrolling, setScrolling] = useState(false);

  const scrollTimeoutRef = useRef<number | undefined>(undefined);

  /*
   * ---------------------------------------------------------
   * ACTIVE CLIP
   * ---------------------------------------------------------
   *
   * Index into `displayClips` (the currently grouped list), so it is only
   * meaningful together with the grouping that produced it.
   *
   * This is local UI state: nothing outside this component reads it, and it
   * must not outlive the grouping, so it does not belong in the store.
   */
  const [activeClip, setActiveClip] = useState(-1);

  /*
   * One-shot request for the mounted view to start playing a clip, published
   * after a split/merge regroups the clips. The view owns the playback context,
   * so it reacts to this itself.
   */
  const [clipPlayRequest, setClipPlayRequest] = useState<
    ClipPlayRequest | undefined
  >(undefined);

  const playRequestNonceRef = useRef(0);

  /*
   * Loading a different track replaces `clips` wholesale, so the stored index
   * no longer refers to the same clip. Reset it.
   *
   * Deliberately NOT keyed on `mergeGap`: a split/merge sets both the new gap
   * and the new active clip in the same handler, so clearing on gap change
   * would immediately undo the selection the gesture just made.
   */
  useEffect(() => {
    setActiveClip(-1);
  }, [clips]);

  /*
   * Per-clip grouping belongs to the track it was built from, so drop it when
   * the track's clips are replaced.
   */
  useEffect(() => {
    setScopedClips(null);
  }, [clips]);

  /*
   * ---------------------------------------------------------
   * CONFIG
   * ---------------------------------------------------------
   */

  const handleRepetitionsChange = useCallback(
    (value: number) => {
      dispatch(
        updateConfig({
          repetitions: value,
        }),
      );
    },
    [dispatch],
  );

  const handleWaveformViewChange = useCallback(
    (view: 'horizontal' | 'stacked') => {
      dispatch(
        updateConfig({
          waveformView: view,
        }),
      );
    },
    [dispatch],
  );

  /*
   * ---------------------------------------------------------
   * CLIP SELECTION
   * ---------------------------------------------------------
   */

  /*
   * `idx` comes from the clip list the user is looking at, so it is validated
   * against `displayClips`, not the raw `clips` (whose indexes differ whenever
   * clips are grouped).
   */
  const handleActiveClipChange = useCallback(
    (idx: number) => {
      if (!displayClips[idx]) {
        return;
      }

      setActiveClip(idx);
    },
    [displayClips],
  );

  /*
   * Publish a one-shot playback request for `clip`.
   *
   * The nonce makes each request distinct, so requesting the same clip twice in
   * a row still re-arms playback instead of being treated as a duplicate.
   */
  const requestClipPlayback = useCallback(
    (clip: InitClipData) => {
      playRequestNonceRef.current += 1;

      setClipPlayRequest({
        clip,
        repetitions,
        nonce: playRequestNonceRef.current,
      });
    },
    [repetitions],
  );

  /*
   * ---------------------------------------------------------
   * CLIP SPLIT / MERGE
   * ---------------------------------------------------------
   */

  const handleClipSwipe = useCallback(
    (idx: number, direction: 'up' | 'down') => {
      /*
       * Swipe down:
       * merge this clip with an adjacent clip.
       */
      if (direction === 'down') {
        const result = mergeClips(clips, displayClips, idx, mergeScope);

        if (!result) {
          return;
        }

        setMergeGap(result.mergeGap);

        /*
         * "clip" scope keeps its own grouping, so the gesture's result becomes
         * the new list. In "global" scope `displayClips` is derived from
         * `mergeGap`, which was just updated above.
         */
        if (mergeScope === 'clip') {
          setScopedClips(result.clips);
        }

        setActiveClip(result.activeClip);

        const newActiveClip = result.clips?.[result.activeClip];

        if (newActiveClip) {
          requestClipPlayback(newActiveClip);
        }

        return;
      }

      /*
       * Swipe up:
       * split/unpack a virtually merged clip.
       */
      const result = splitClip(clips, displayClips, idx, mergeScope);

      if (!result) {
        return;
      }

      setMergeGap(result.mergeGap);

      if (mergeScope === 'clip') {
        setScopedClips(result.clips ?? null);
      }

      setActiveClip(result.activeClip);

      /*
       * Play the clip that is active AFTER the split.
       *
       * `displayClips` still describes the pre-split grouping here, so the new
       * clip has to be re-derived from the raw clips at the new merge gap.
       * Indexing the stale list would replay the pre-split clip's range.
       */
      const newActiveClip = result.clips?.[result.activeClip];

      if (newActiveClip) {
        requestClipPlayback(newActiveClip);
      }
    },
    [clips, displayClips, mergeScope, requestClipPlayback],
  );

  /*
   * ---------------------------------------------------------
   * MERGE SLIDER
   * ---------------------------------------------------------
   */

  /*
   * The merge slider is only shown in "global" scope, where it sets the single
   * threshold every clip is regrouped by. In "clip" scope merging happens per
   * clip through the swipe gestures instead.
   */
  const handleMergeGapChange = useCallback((gap: number) => {
    setMergeGap(gap);
  }, []);

  return (
    <>
      <div
        className="progress-container"
        onWheel={e => {
          e.stopPropagation();
        }}
      >
        {/*
         * -----------------------------------------------------
         * PAGE-FLIP VIEW SWITCH
         * -----------------------------------------------------
         *
         * Direct child of progress-container.
         *
         * progress-container should therefore have:
         *
         *   position: relative;
         *
         * WaveformViewFlipButton owns its visual appearance,
         * hover animation and theme-aware styling.
         */}
        {hasWaveform && (
          <WaveformViewFlipButton
            view={waveformView}
            onChange={handleWaveformViewChange}
          />
        )}

        {/*
         * -----------------------------------------------------
         * WAVEFORM
         * -----------------------------------------------------
         */}
        <div
          className={`progress-row ${
            waveformView === 'horizontal' ? 'progress-row--horizontal' : ''
          }`}
        >
          {waveformStatus === 'loading' || waveformStatus === 'idle' ? (
            <div className="waveform-loading waveform-loading--stacked">
              Loading waveform…
            </div>
          ) : waveformStatus === 'error' ? (
            <div className="waveform-loading waveform-loading--error waveform-loading--stacked">
              Waveform unavailable
            </div>
          ) : hasWaveform && waveformView === 'horizontal' ? (
            <RowWaveform
              waveform={waveform!}
              displayClips={displayClips}
              currentTime={currentTime}
              onSeek={onSeek}
              onPlayRange={onPlayRange}
              onStopPlayback={onStopPlayback}
              repetitions={repetitions}
              activeClip={activeClip}
              onActiveClipChange={handleActiveClipChange}
              onSwipeClip={playing ? undefined : handleClipSwipe}
              getAnalyser={getAnalyser}
              getCurrentTime={getCurrentTime}
              playing={playing}
              scrolling={scrolling}
              setScrolling={setScrolling}
              scrollTimeoutRef={scrollTimeoutRef}
              clipPlayRequest={clipPlayRequest}
            />
          ) : hasWaveform && waveformView === 'stacked' ? (
            <StackedWaveform
              waveform={waveform!}
              displayClips={displayClips}
              currentTime={currentTime}
              playing={playing}
              activeClip={activeClip}
              repetitions={repetitions}
              onSwipeClip={playing ? undefined : handleClipSwipe}
              onSeek={onSeek}
              onPlayRange={onPlayRange}
              onStopPlayback={onStopPlayback}
              getCurrentTime={getCurrentTime}
              onActiveClipChange={handleActiveClipChange}
              clipPlayRequest={clipPlayRequest}
            />
          ) : null}
        </div>

        {/*
         * -----------------------------------------------------
         * EMPTY STATE
         * -----------------------------------------------------
         */}
        {hasWaveform && clips.length === 0 && (
          <div className="waveform-empty-hint" role="status">
            No clips detected — lower the Silence threshold in Settings.
          </div>
        )}

        {/*
         * -----------------------------------------------------
         * COLLAPSED TOOLBAR HIT AREA
         * -----------------------------------------------------
         *
         * Gesture handling lives in ClipToolbarCollapsedHit.
         */}
        {clips.length > 0 && !showAdvancedControls && (
          <ClipToolbarCollapsedHit />
        )}
      </div>

      {/*
       * -------------------------------------------------------
       * ADVANCED CLIP CONTROLS
       * -------------------------------------------------------
       */}
      {clips.length > 0 && showAdvancedControls && (
        <ClipToolbar
          mergeGap={mergeGap}
          clipCount={displayClips.length}
          onMergeGapChange={handleMergeGapChange}
          showMergeSlider={mergeScope === 'global'}
          repetitions={repetitions}
          onRepetitionsChange={handleRepetitionsChange}
          disabled={playing}
        />
      )}
    </>
  );
}
