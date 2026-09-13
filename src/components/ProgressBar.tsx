/**
 * Main progress and waveform visualization component.
 *
 * Features:
 * - Waveform display (stacked or horizontal view)
 * - Seek bar with current playback position
 * - Silence-based clip detection and display
 * - Range selection for looping playback
 * - Interactive clip toolbar
 * - Responsive to window resize and playback state
 */

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
} from "../store/selectors";
import { setActiveClip } from "../store/analysisSlice";
import { mergeClipsByGap, clipGaps, MERGE_GAP_SEC } from "../utils/clips";

interface ProgressBarProps {
  onSeek: (time: number) => void;
  onPlayRange: (
    start: number,
    end: number,
    repetitions: number,
    onComplete?: () => void,
  ) => void;
  onClipPlayActiveChange?: (active: boolean) => void;
  onWaveformScrollChange?: (scrolling: boolean) => void;
  getAnalyser?: () => AnalyserNode | null;
  getCurrentTime?: () => number;
}

export function ProgressBar({
  onSeek,
  onPlayRange,
  onClipPlayActiveChange,
  onWaveformScrollChange,
  getAnalyser,
  getCurrentTime,
}: ProgressBarProps) {
  const dispatch = useAppDispatch();
  const audio = useAppSelector(selectCurrentAudio, shallowEqual);
  const waveformView = useAppSelector(selectWaveformView);
  const playing = useAppSelector(selectIsPlaying);
  const handleActiveClipChange = useCallback(
    (idx: number) => dispatch(setActiveClip(idx)),
    [dispatch],
  );
  const { waveform, waveformStatus, clips, currentTime, activeClip } = audio;
  const hasWaveform = waveform !== null && waveform.data.length > 0;

  const [mergeGap, setMergeGap] = useState(MERGE_GAP_SEC);
  const [repetitions, setRepetitions] = useState(3);

  const gapValues = useMemo(() => clipGaps(clips), [clips]);
  const displayClips = useMemo(
    () => mergeClipsByGap(clips, mergeGap),
    [clips, mergeGap],
  );

  // Scroll state shared with the horizontal RowWaveform follow behavior.
  const [scrolling, setScrolling] = useState(false);
  const scrollTimeoutRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    onWaveformScrollChange?.(scrolling);
  }, [scrolling, onWaveformScrollChange]);

  return (
    <>
      <div className="progress-container">
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
              onClipPlayActiveChange={onClipPlayActiveChange}
              repetitions={repetitions}
              activeClip={activeClip}
              onActiveClipChange={handleActiveClipChange}
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
              activeClip={activeClip}
              repetitions={repetitions}
              onSeek={onSeek}
              onActiveClipChange={handleActiveClipChange}
              onPlayRange={onPlayRange}
              onClipPlayActiveChange={onClipPlayActiveChange}
              getCurrentTime={getCurrentTime}
              onScrollChange={setScrolling}
            />
          ) : null}
        </div>
      </div>
      {clips.length > 0 && (
        <div className="clip-toolbar">
          <MergeSlider
            value={mergeGap}
            gapValues={gapValues}
            clipCount={displayClips.length}
            onChange={setMergeGap}
          />
          <RepsStepper value={repetitions} onChange={setRepetitions} />
        </div>
      )}
    </>
  );
}
