import { memo, useRef } from "react";
import { Clips } from "./Clips";
import { ClipLabel } from "./ClipLabel";
import { DancingLines } from "./DancingLines";
import { WaveformCursor } from "./WaveformCursor";
import { WaveformCanvas } from "./Waveform";
import { type WaveformData } from "../hooks/useWaveform";
import { useRowWaveformScroll, VB_W, VB_H } from "../hooks/useRowWaveformScroll";
import type { Clip as ClipData } from "../utils/clips";
import "./RowWaveform.css";
import { getCssVar } from "../utils/css";

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
  const playedElRef = useRef<HTMLDivElement>(null);

  const {
    hsRef,
    trackRef,
    hsWinLenRef,
    renderedBufferAnchor,
    bufferLengthRef,
    onHsPointerDown,
    onRootClickCapture,
    onWaveformClick,
    getStripPlayedPct,
    playClip,
  } = useRowWaveformScroll({
    waveformDuration: waveform.duration,
    currentTime,
    onSeek,
    onPlayRange,
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
    playedElementRef: playedElRef,
  });

  const viewportLen = hsWinLenRef.current;
  const bufferLen = bufferLengthRef.current;
  const bufferScale = viewportLen > 0 ? bufferLen / viewportLen : 1;
  const vbW = VB_W * bufferScale;
  const color = getCssVar("--accent");

  const waveformWindow = {
    windowStartSec: renderedBufferAnchor,
    windowLen: bufferLen,
    innerH,
    vbW,
    vbH: VB_H,
  };

  const canvasStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
  };


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
          playing={playing}
          color={color}
        />

        <div className="row-waveform__track" ref={trackRef}>
          <WaveformCanvas
            className="row-waveform__svg"
            data={waveform.data}
            sampleRate={waveform.sampleRate}
            window={waveformWindow}
            strokeWidth={1.6}
            style={canvasStyle}
          />

          <div
            ref={playedElRef}
            className="row-waveform__played"
            style={{
              position: "absolute",
              inset: 0,
              overflow: "hidden",
              pointerEvents: "none",
              clipPath: "inset(0 100% 0 0)",
            }}
          >
            <WaveformCanvas
              className="row-waveform__svg row-waveform__svg--played"
              data={waveform.data}
              sampleRate={waveform.sampleRate}
              window={waveformWindow}
              strokeWidth={1.6}
              color={color}
              style={canvasStyle}
            />
          </div>

          <div
            className="row-waveform__clip-layer"
            style={{ position: "absolute", inset: 0, width: "100%" }}
          >
            <Clips
              clips={displayClips}
              window={waveformWindow}
              onPlayRange={playClip}
              repetitions={repetitions}
              playing={playing}
              onStopPlayback={onStopPlayback}
              activeClip={activeClip}
              onActivate={onActiveClipChange}
              onSwipe={onSwipeClip}
              renderLabel={(id, c) => (
                <ClipLabel
                  key={`hlbl-${id}`}
                  index={id}
                  duration={c.vEnd - c.vStart}
                  active={id === activeClip}
                  canSplit={!playing && c.children?.length != null && c.children.length > 1}
                  canMerge={!playing && (id > 0 || id < displayClips.length - 1)}
                  onSplit={onSwipeClip ? () => onSwipeClip(id, "up") : undefined}
                  onMerge={onSwipeClip ? () => onSwipeClip(id, "down") : undefined}
                />
              )}
            />
          </div>

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
