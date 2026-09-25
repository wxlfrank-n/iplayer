/**
 * Horizontal scrolling single-row waveform view.
 *
 * Features:
 * - Displays waveform in a horizontally scrollable container
 * - Auto-scrolls to keep playhead visible (configurable follow distance)
 * - Shows detected clips (silent boundaries)
 * - Interactive clip selection and range playback
 * - Responsive window size with dynamic zoom level
 * - Pan/drag support for manual navigation
 */

import { memo, useRef } from "react";
import { Clip } from "./Clip";
import { ClipLabel } from "./ClipLabel";
import { DancingLines } from "./DancingLines";
import { WaveformCursor } from "./WaveformCursor";
import { WaveformBars } from "./Waveform";
import { type WaveformData } from "../hooks/useWaveform";
import { useRowWaveformScroll, VB_W, VB_H, quantizeBarsAnchor, BARS_TAIL_SEC } from "../hooks/useRowWaveformScroll";
import type { Clip as ClipData } from "../utils/clips";

const PAD = 4;

export interface RowWaveformProps {
  waveform: WaveformData;
  displayClips: ClipData[];
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
  getAnalyser?: (resume: boolean) => AnalyserNode | null;
  getCurrentTime: () => number;
  playing: boolean;
  scrolling: boolean;
  setScrolling: React.Dispatch<React.SetStateAction<boolean>>;
  scrollTimeoutRef: React.RefObject<number | undefined>;
}

export const RowWaveform = memo(function RowWaveform({
  waveform,
  displayClips,
  currentTime,
  onSeek,
  onPlayRange,
  onClipPlayActiveChange,
  repetitions,
  onStopPlayback,
  activeClip,
  onActiveClipChange,
  onSwipeClip,
  getAnalyser,
  getCurrentTime,
  playing,
  scrolling,
  setScrolling,
  scrollTimeoutRef,
}: RowWaveformProps) {
  const innerH = VB_H - PAD * 2;
  const cursorElRef = useRef<HTMLDivElement>(null);
  const {
    hsRef,
    trackRef,
    hsAnchor,
    hsWinLenRef,
    onHsPointerDown,
    onRootClickCapture,
    onWaveformClick,
    getPlayedPct,
    getStripPlayedPct,
    playClip,
  } = useRowWaveformScroll({
    waveformDuration: waveform.duration,
    currentTime,
    onSeek,
    onPlayRange,
    onClipPlayActiveChange,
    repetitions,
    onStopPlayback,
    activeClip,
    onActiveClipChange,
    onSwipeClip,
    getCurrentTime,
    playing,
    scrolling,
    setScrolling,
    scrollTimeoutRef,
    cursorElementRef: cursorElRef,
  });

  const barsAnchor = quantizeBarsAnchor(hsAnchor);
  const barsLen = hsWinLenRef.current + BARS_TAIL_SEC;
  const vbW = VB_W * (barsLen / hsWinLenRef.current);

  return (
    <div
      className="row-waveform"
      ref={hsRef}
      onPointerDown={onHsPointerDown}
      onClickCapture={onRootClickCapture}
    >
      <div className="row-waveform__inner" onClick={onWaveformClick}>
        <DancingLines
          getAnalyser={getAnalyser}
          getCurrentTime={getCurrentTime}
          waveform={waveform}
          currentTime={currentTime}
        />
        <div className="row-waveform__track" ref={trackRef}>
          <svg
            className="row-waveform__svg"
            viewBox={`0 0 ${vbW} ${VB_H}`}
            preserveAspectRatio="none"
            style={{ width: `${(barsLen / hsWinLenRef.current) * 100}%` }}
          >
            <WaveformBars
              data={waveform.data}
              sampleRate={waveform.sampleRate}
              window={{
                windowStartSec: barsAnchor,
                windowLen: barsLen,
                innerH,
                vbW,
                vbH: VB_H,
              }}
              fracPlayed={getPlayedPct()}
              idPrefix="hs"
              strokeWidth={1.6}
            />
            <Clip
              clips={displayClips}
              window={{
                windowStartSec: barsAnchor,
                windowLen: barsLen,
                innerH,
                vbW,
                vbH: VB_H,
              }}
              onPlayRange={playClip}
              repetitions={repetitions}
              playing={playing}
              onStopPlayback={onStopPlayback}
              activeClip={activeClip}
              onActivate={(idx) => {
                onActiveClipChange(idx);
              }}
              onSwipe={onSwipeClip}
            />
          </svg>
          {displayClips.map((s, idx) => {
            if (s.vEnd <= barsAnchor || s.vStart >= barsAnchor + hsWinLenRef.current) return null;
            const center =
              ((s.vStart + (s.vEnd - s.vStart) / 2 - barsAnchor) /
                hsWinLenRef.current) *
              100;
            return (
              <ClipLabel
                key={`hlbl-${idx}`}
                index={idx}
                duration={s.vEnd - s.vStart}
                left={center}
                active={idx === activeClip}
                canSplit={!playing && s.children?.length != null && s.children?.length > 1}
                canMerge={!playing && (idx > 0 || idx < displayClips.length - 1)}
                onSplit={onSwipeClip ? () => onSwipeClip(idx, "up") : undefined}
                onMerge={onSwipeClip ? () => onSwipeClip(idx, "down") : undefined}
              />
            );
          })}
          <WaveformCursor
            view="row"
            getPlayedPct={getStripPlayedPct}
            getCurrentTime={getCurrentTime}
            cursorRef={cursorElRef}
          />
        </div>
      </div>
    </div>
  );
});
