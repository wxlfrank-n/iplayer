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
import {ClipToolbar, TOOLBAR_SWIPE_THRESHOLD_PX} from './ClipToolbar';
import {WaveformViewFlipButton} from './WaveformViewFlipButton';

import {useAppDispatch, useAppSelector} from '../store/hooks';

import {
  selectCurrentAudio,
  selectWaveformView,
  selectIsPlaying,
  selectRepetitions,
  selectShowAdvancedControls,
} from '../store/selectors';

import {setActiveClip} from '../store/analysisSlice';
import {updateConfig} from '../store/configSlice';

import {mergeClipsByGap} from '../utils/clips';
import './ProgressBar.css';

import {getClipSplitResult, getClipMergeResult} from '../utils/swipe';

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

  const {waveform, waveformStatus, clips, currentTime, activeClip, minGap} =
    audio;

  const hasWaveform = waveform !== null && waveform.data.length > 0;

  /*
   * Merge gap is derived from the detected silence gaps
   * for the current waveform.
   */
  const [mergeGap, setMergeGap] = useState(minGap);

  useEffect(() => {
    setMergeGap(minGap);
  }, [minGap]);

  const displayClips = useMemo(
    () => mergeClipsByGap(clips, mergeGap),
    [clips, mergeGap],
  );

  /*
   * Scroll state shared with RowWaveform's follow behavior.
   */
  const [scrolling, setScrolling] = useState(false);

  const scrollTimeoutRef = useRef<number | undefined>(undefined);

  /*
   * Collapsed toolbar hit area: pointer start for the swipe-down gesture
   * that re-expands the toolbar.
   */
  const hitPointerStartRef = useRef<{x: number; y: number} | null>(null);

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

  const handleActiveClipChange = useCallback(
    (val: number) => {
      if (!audio.clips[val]) {
        return;
      }

      dispatch(setActiveClip(val));
    },
    [audio.clips, dispatch],
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
        const result = getClipMergeResult(displayClips, idx);

        if (!result) {
          return;
        }

        setMergeGap(result.mergeGap);

        dispatch(setActiveClip(result.activeClip));

        return;
      }

      /*
       * Swipe up:
       * split/unpack a virtually merged clip.
       */
      const result = getClipSplitResult(clips, displayClips, idx);

      if (!result) {
        return;
      }

      setMergeGap(result.mergeGap);

      dispatch(setActiveClip(result.activeClip));
    },
    [clips, dispatch, displayClips],
  );

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
         * When the clip toolbar is collapsed its box is gone from the
         * layout, so the double-click / swipe-down target lives here inside
         * progress-container: an absolutely positioned strip at the
         * container's bottom edge that expands the toolbar again.
         */}
        {clips.length > 0 && !showAdvancedControls && (
          <div
            className="clip-toolbar__collapsed-hit"
            onDoubleClick={() => {
              dispatch(
                updateConfig({
                  showAdvancedControls: true,
                }),
              );
            }}
            onPointerDown={e => {
              hitPointerStartRef.current = {
                x: e.clientX,
                y: e.clientY,
              };
            }}
            onPointerUp={e => {
              const start = hitPointerStartRef.current;

              hitPointerStartRef.current = null;

              if (!start) {
                return;
              }

              const dy = e.clientY - start.y;
              const absY = Math.abs(dy);
              const absX = Math.abs(e.clientX - start.x);

              /*
               * Swipe down expands the toolbar.
               */
              if (absY >= TOOLBAR_SWIPE_THRESHOLD_PX && absY > absX && dy > 0) {
                dispatch(
                  updateConfig({
                    showAdvancedControls: true,
                  }),
                );
              }
            }}
            onPointerCancel={() => {
              hitPointerStartRef.current = null;
            }}
          />
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
          onMergeGapChange={setMergeGap}
          repetitions={repetitions}
          onRepetitionsChange={handleRepetitionsChange}
          disabled={playing}
        />
      )}
    </>
  );
}
