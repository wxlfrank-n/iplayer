/**
 * Real-time frequency visualizer: reads live byte-frequency data from a Web
 * Audio AnalyserNode and draws smoothed vertical bars on a canvas. Runs its own
 * rAF loop and never triggers React re-renders.
 */

import { memo, useEffect, useRef } from "react";

interface DancingLinesProps {
  getAnalyser?: (resume: boolean) => AnalyserNode | null;
}

const BAR_COUNT = 56;
const SMOOTHING = 0.2;
const MIN_BAR_HEIGHT_PX = 3;

export const DancingLines = memo(function DancingLines({
  getAnalyser,
}: DancingLinesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const levels = new Float32Array(BAR_COUNT);
    let data = new Uint8Array(0);
    let raf = 0;
    let color = "";

    const frame = () => {
      raf = requestAnimationFrame(frame);
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const dpr = window.devicePixelRatio || 1;
      const pw = Math.round(rect.width * dpr);
      const ph = Math.round(rect.height * dpr);
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, rect.width, rect.height);

      const analyser = getAnalyser ? getAnalyser(false) : null;
      const len = analyser ? analyser.frequencyBinCount : 0;
      if (analyser) {
        if (data.length !== len) data = new Uint8Array(len);
        analyser.getByteFrequencyData(data);
      }

      if (!color) {
        const v = getComputedStyle(document.documentElement)
          .getPropertyValue("--accent")
          .trim();
        color = v || "#58a6ff";
      }
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = color;
      const bw = rect.width / BAR_COUNT;
      const base = rect.height - 4;
      const maxH = rect.height - 8;
      for (let i = 0; i < BAR_COUNT; i++) {
        const bin =
          len > 0
            ? Math.min(
                len - 1,
                Math.floor((1 - Math.pow(1 - i / BAR_COUNT, 1.5)) * (len - 1)),
              )
            : 0;
        const v = len > 0 ? data[bin] / 255 : 0;
        const target = Math.pow(v, 1.7);
        levels[i] += (target - levels[i]) * SMOOTHING;
        const h = Math.max(MIN_BAR_HEIGHT_PX, levels[i] * maxH) * 3;
        const x = i * bw + bw * 0.25;
        ctx.fillRect(x, base - h, bw * 0.5, h);
      }
      ctx.globalAlpha = 1;
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [getAnalyser]);

  return <canvas className="row-waveform__dance" ref={canvasRef} />;
});