import { useState, useMemo, useEffect } from "react";
import { Sector } from "./Sector";
import { detectSectors } from "../utils/sectors";

interface ProgressBarProps {
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  onPlay: () => void;
  peaks: number[];
  mergeSeconds: number;
  onPlayRange: (start: number, end: number, repetitions: number) => void;
}

const SILENCE_THRESHOLD = 0.02;
const SEC_PER_PEAK = 0.02;
const WINDOW_SECONDS = 30;
const VB_W = 1000;
const VB_H = 200;
const PAD = 4;

export function ProgressBar({ currentTime, duration, onSeek, onPlay, peaks, mergeSeconds, onPlayRange }: ProgressBarProps) {
  const progress = duration > 0 ? currentTime / duration : 0;

  const [anchorStartSec, setAnchorStartSec] = useState<number>(0);
  const [prevTime, setPrevTime] = useState<number>(-1);
  const [activeSector, setActiveSector] = useState<number>(-1);
  const [hoverFrac, setHoverFrac] = useState<number | null>(null);

  if (peaks.length > 0 && prevTime !== currentTime) {
    setPrevTime(currentTime);
    if (duration > 0 && currentTime >= anchorStartSec + WINDOW_SECONDS) {
      setAnchorStartSec(Math.max(0, currentTime - WINDOW_SECONDS));
    }
  }

  const innerH = VB_H - PAD * 2;
  const windowStartSec = Math.max(0, Math.min(anchorStartSec, Math.max(0, duration - WINDOW_SECONDS)));
  const windowEndSec = Math.min(duration, windowStartSec + WINDOW_SECONDS);
  const windowLen = windowEndSec - windowStartSec;

  const bars: { x: number; y: number; w: number; h: number }[] = [];
  if (peaks.length > 0 && windowLen > 0) {
    const startPeak = windowStartSec / SEC_PER_PEAK;
    const endPeak = windowEndSec / SEC_PER_PEAK;
    const firstPeak = Math.max(0, Math.floor(startPeak));
    const lastPeak = Math.min(peaks.length, Math.ceil(endPeak));
    const n = Math.max(1, lastPeak - firstPeak);
    const stepW = VB_W / n;

    for (let p = firstPeak; p < lastPeak; p++) {
      const amp = peaks[p] ?? 0;
      const amplitude = amp < SILENCE_THRESHOLD ? amp * 0.3 : amp;
      const barHeight = Math.max(1, amplitude * innerH);
      bars.push({
        x: (p - firstPeak) * stepW,
        y: (VB_H - barHeight) / 2,
        w: Math.max(1, stepW - 0.5),
        h: barHeight,
      });
    }
  }

  const fracPlayed = windowLen > 0 ? Math.min(1, Math.max(0, (currentTime - windowStartSec) / windowLen)) : 0;

  const sectors = useMemo(() => detectSectors(peaks, mergeSeconds), [peaks, mergeSeconds]);
  const visibleSectors = sectors
    .map((s, idx) => ({ start: s.start, end: s.end, idx }))
    .filter((s) => s.end > windowStartSec && s.start < windowStartSec + windowLen);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      if (sectors.length === 0) return;
      e.preventDefault();
      setActiveSector((prev) => {
        let next = prev < 0 ? (e.key === "ArrowRight" ? 0 : sectors.length - 1) : prev + (e.key === "ArrowRight" ? 1 : -1);
        next = Math.max(0, Math.min(next, sectors.length - 1));
        const s = sectors[next];
        if (s) onPlayRange(s.start, s.end, 1);
        return next;
      });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sectors, onPlayRange]);

  const handleClick = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const frac = x / rect.width;
    const seekTime = windowStartSec + frac * windowLen;
    onSeek(Math.max(0, Math.min(seekTime, duration)));
    onPlay();
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    setHoverFrac(Math.max(0, Math.min(1, x / rect.width)));
  };

  const hoverTime = hoverFrac !== null ? windowStartSec + hoverFrac * windowLen : 0;

  return (
    <div className="progress-container">
      <span className="time-label">{formatTime(currentTime)}</span>
      <div className="waveform-bar" onClick={handleClick} onMouseMove={handleMouseMove} onMouseLeave={() => setHoverFrac(null)}>
        {peaks.length === 0 ? (
          <div className="waveform-placeholder">
            <div className="waveform-placeholder__filled" style={{ width: `${progress * 100}%` }} />
          </div>
        ) : (
          <svg className="waveform-svg" viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none">
            <g>
              {bars.map((b, i) => (
                <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} fill="#30363d" />
              ))}
            </g>
            <g clipPath="url(#playedClip)">
              {bars.map((b, i) => (
                <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} fill="#58a6ff" />
              ))}
            </g>
            <defs>
              <clipPath id="playedClip">
                <rect x={0} y={0} width={Math.max(fracPlayed * VB_W, 1)} height={VB_H} />
              </clipPath>
            </defs>
            <Sector
              peaks={peaks}
              mergeSeconds={mergeSeconds}
              windowStartSec={windowStartSec}
              windowLen={windowLen}
              innerH={innerH}
              vbW={VB_W}
              vbH={VB_H}
              onPlayRange={onPlayRange}
              activeSector={activeSector}
              onActivate={setActiveSector}
            />
          </svg>
        )}
        {peaks.length > 0 &&
          visibleSectors.map((s) => {
            const center = ((s.start + (s.end - s.start) / 2 - windowStartSec) / windowLen) * 100;
            return (
              <span
                key={`label-${s.idx}`}
                className={`waveform-sector-label ${s.idx === activeSector ? "waveform-sector-label--active" : ""}`}
                style={{ left: `${center}%` }}
              >
                {s.idx + 1}
              </span>
            );
          })}
        {hoverFrac !== null && (
          <>
            <div className="waveform-bar__guide" style={{ left: `${hoverFrac * 100}%` }} />
            <div
              className={`waveform-bar__tooltip ${hoverFrac > 0.9 ? "waveform-bar__tooltip--edge" : ""}`}
              style={{ left: `${hoverFrac * 100}%` }}
            >
              {formatTime(hoverTime)}
            </div>
          </>
        )}
      </div>
      <span className="time-label">{formatTime(duration)}</span>
    </div>
  );
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
