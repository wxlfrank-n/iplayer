/**
 * Main progress and waveform visualization component.
 *
 * Shows the decoded waveform (stacked or horizontal view), the silence-split
 * clips, and the interactive clip toolbar. Props describe the seek/play-range
 * entry points only; every detail of how clips are detected and merged is
 * owned by ProgressBar itself (state + helpers) so App stays a thin shell.
 */

import { useState, useMemo, useCallback, useRef } from "react";
import { shallowEqual } from "react-redux";
import { RowWaveform } from "./RowWaveform";
import { StackedWaveform } from "./StackedWaveform";
import { MergeSlider } from "./MergeSlider";
import { RepsStepper } from "./RepsStepper";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import {
  selectCurrentAudio,
  selectWaveformView,
  selectIsPlaying,
  selectminSilenceLength,
} from "../store/selectors";
import { setActiveClip } from "../store/analysisSlice";
import { mergeClipsByGap, clipGaps } from "../utils/clips";
import { getClipSwipeResult } from "../utils/swipe";

interface ProgressBarProps {
  /** Seek to an absolute track time (seconds). */
  onSeek: (time: number) => void;
  /** Play a range, repeating `repetitions` times, with an optional
   *  completion callback. */
  onPlayRange: (
    start: number,
    end: number,
    repetitions: number,
    onComplete?: () => void,
  ) => void;
  onStopPlayback: () => void;
  onClipPlayActiveChange?: (active: boolean) => void;
  onWaveformScrollChange?: (scrolling: boolean) => void;
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
  const minSilenceLength = useAppSelector(selectminSilenceLength);

  const { waveform, waveformStatus, clips, currentTime, activeClip } = audio;
  const hasWaveform = waveform !== null && waveform.data.length > 0;

  // Merge gap is seeded from `minSilenceLength` (an independent, user-configured
  // value in seconds) rather than derived from `silenceRatio`, so the slider's
  // smallest step is decoupled from how loud "silence" is.
  const [mergeGap, setMergeGap] = useState(minSilenceLength);
  const [repetitions, setRepetitions] = useState(3);

  const gapValues = useMemo(
    () => clipGaps(clips, minSilenceLength),
    [clips, minSilenceLength],
  );
  const displayClips = useMemo(
    () => mergeClipsByGap(clips, mergeGap),
    [clips, mergeGap],
  );

  // Scroll state shared with the horizontal RowWaveform follow behavior.
  const [scrolling, setScrolling] = useState(false);
  const scrollTimeoutRef = useRef<number | undefined>(undefined);

  const handleActiveClipChange = useCallback(
    (val: number) => {
      if (audio.clips[val]) dispatch(setActiveClip(val));
    },
    [audio.clips, dispatch],
  );

  const handleClipSwipe = useCallback(
    (idx: number, direction: "up" | "down") => {
      const result = getClipSwipeResult(
        clips,
        displayClips,
        idx,
        direction,
        minSilenceLength,
      );
      if (!result) return;
      setMergeGap(result.mergeGap);
      dispatch(setActiveClip(result.activeClip));
    },
    [clips, dispatch, displayClips, minSilenceLength],
  );

  return (
    <>
      <div
        className="progress-container"
        onWheel={(e) => e.stopPropagation()}
      >
        <div
          className={`progress-row ${waveformView === "horizontal" ? "progress-row--horizontal" : ""}`}
        >
          {waveformStatus === "loading" || waveformStatus === "idle" ? (
            <div className="waveform-loading waveform-loading--stacked">
              Loading waveform…
            </div>
          ) : waveformStatus === "error" ? (
            <div className="waveform-loading waveform-loading--error waveform-loading--stacked">
              Waveform unavailable
            </div>
          ) : hasWaveform && waveformView === "horizontal" ? (
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
          ) : hasWaveform && waveformView === "stacked" ? (
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
      </div>
      {clips.length > 0 && (
        <div
          className={`clip-toolbar ${playing ? "clip-toolbar--disabled" : ""}`}
        >
          <MergeSlider
            value={mergeGap}
            gapValues={gapValues}
            clipCount={displayClips.length}
            onChange={setMergeGap}
            disabled={playing}
          />
          <RepsStepper value={repetitions} onChange={setRepetitions} disabled={playing} />
        </div>
      )}
    </>
  );
}
