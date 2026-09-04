import { useRef, useEffect } from "react";
import { useWaveform } from "../hooks/useWaveform";

interface ProgressBarProps {
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  audioUrl: string | null;
}

export function ProgressBar({ currentTime, duration, onSeek, audioUrl }: ProgressBarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const peaks = useWaveform(audioUrl);
  const progress = duration > 0 ? currentTime / duration : 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let raf: number;

    function draw() {
      const ctx = canvas!.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas!.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      if (w === 0 || h === 0) {
        raf = requestAnimationFrame(draw);
        return;
      }

      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      ctx.scale(dpr, dpr);

      ctx.clearRect(0, 0, w, h);

      if (peaks.length === 0) {
        ctx.fillStyle = "#30363d";
        ctx.fillRect(0, h / 2 - 1, w, 2);
        ctx.fillStyle = "#58a6ff";
        ctx.fillRect(0, h / 2 - 1, w * progress, 2);
      } else {
        const barWidth = w / peaks.length;
        const progressX = progress * w;

        for (let i = 0; i < peaks.length; i++) {
          const x = i * barWidth;
          const barHeight = Math.max(1, peaks[i] * h * 0.9);
          const y = (h - barHeight) / 2;

          ctx.fillStyle = x < progressX ? "#58a6ff" : "#30363d";
          ctx.fillRect(x, y, Math.max(1, barWidth - 0.5), barHeight);
        }
      }

      raf = requestAnimationFrame(draw);
    }

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [peaks, progress]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    onSeek(percent * duration);
  };

  return (
    <div className="progress-container">
      <span className="time-label">{formatTime(currentTime)}</span>
      <div className="waveform-bar" onClick={handleClick}>
        <canvas ref={canvasRef} className="waveform-canvas" />
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
