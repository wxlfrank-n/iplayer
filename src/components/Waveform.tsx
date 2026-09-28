import { memo, useCallback, useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import type { WaveWindow } from "../types";

interface WaveformCanvasProps {
  data: Float32Array;
  sampleRate: number;
  window: WaveWindow;
  contentEndSec?: number;
  className?: string;
  style?: CSSProperties;
  strokeWidth?: number;
  /** Overrides normal and silent waveform colors. */
  color?: string;
  /** Distance between waveform bars in CSS pixels. */
  barSpacing?: number;
}

const MIN_BAR_PX = 2;

interface Segment {
  x: number;
  y0: number;
  y1: number;
}

export const WaveformCanvas = memo(function WaveformCanvas({
  data,
  sampleRate,
  window,
  contentEndSec,
  className,
  style,
  strokeWidth = 1,
  color,
  barSpacing = 3,
}: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const {
    windowStartSec: bufferStartSec,
    windowLen: bufferLen,
    innerH,
    vbH,
  } = window;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    if (cssW <= 0 || cssH <= 0) return;

    const dpr = Math.max(1, globalThis.devicePixelRatio || 1);
    const bw = Math.max(1, Math.round(cssW * dpr));
    const bh = Math.max(1, Math.round(cssH * dpr));

    if (canvas.width !== bw) canvas.width = bw;
    if (canvas.height !== bh) canvas.height = bh;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    if (data.length === 0 || bufferLen <= 0 || sampleRate <= 0) return;

    // Keep the same sparse visual density on desktop and mobile:
    // one bar every `barSpacing` CSS pixels.
    const spacingPx = Math.max(1, barSpacing);
    const durationPerPixel = bufferLen / cssW;
    const durationPerBar = durationPerPixel * spacingPx;
    const step = Math.max(1, Math.round(durationPerBar * sampleRate));

    const bufferStartSample = Math.max(0, Math.floor(bufferStartSec * sampleRate));
    const latticeStart = Math.floor(bufferStartSample / step) * step;
    const bufferEndSample = Math.min(
      data.length,
      Math.ceil((bufferStartSec + bufferLen) * sampleRate),
    );

    const contentEndSample =
      contentEndSec !== undefined
        ? Math.min(
            bufferEndSample,
            Math.max(bufferStartSample, Math.floor(contentEndSec * sampleRate)),
          )
        : bufferEndSample;

    const frames = Math.max(
      1,
      Math.min(
        Math.ceil(cssW / spacingPx) + 1,
        Math.ceil((bufferEndSample - latticeStart) / step),
      ),
    );

    const midY = vbH / 2;
    const scaleY = innerH / 2;
    const cs = getComputedStyle(canvas);

    const baseColor =
      color || cs.getPropertyValue("--waveform-bar").trim() || "#8f96a0";
    const silentColor =
      color || cs.getPropertyValue("--waveform-bar-silent").trim() || "#434a53";

    const topV: number[] = [];
    const botV: number[] = [];

    for (let frame = 0; frame < frames; frame++) {
      const s0 = latticeStart + frame * step;
      if (s0 >= contentEndSample) break;

      const readStart = Math.max(s0, bufferStartSample);
      const readEnd = Math.min(contentEndSample, s0 + step);
      if (readStart >= readEnd) continue;

      let min = data[readStart];
      let max = min;

      for (let sample = readStart + 1; sample < readEnd; sample++) {
        const value = data[sample];
        if (value < min) min = value;
        if (value > max) max = value;
      }

      topV.push(midY - max * scaleY);
      botV.push(midY - min * scaleY);
    }

    const smooth = (values: number[]) => {
      const output = new Array<number>(values.length);
      for (let i = 0; i < values.length; i++) {
        const left = values[Math.max(0, i - 1)];
        const center = values[i];
        const right = values[Math.min(values.length - 1, i + 1)];
        output[i] = (left + 2 * center + right) / 4;
      }
      return output;
    };

    const topSm = smooth(topV);
    const botSm = smooth(botV);
    const sy = cssH / vbH;

    const waveSegments: Segment[] = [];
    const silentSegments: Segment[] = [];

    for (let frame = 0; frame < topSm.length; frame++) {
      const top = topSm[frame];
      const bottom = botSm[frame];
      const x = frame * spacingPx;
      const height = (bottom - top) * sy;

      if (height >= MIN_BAR_PX) {
        waveSegments.push({ x, y0: top * sy, y1: bottom * sy });
      } else {
        const mid = ((top + bottom) / 2) * sy;
        const half = MIN_BAR_PX / 2;
        silentSegments.push({ x, y0: mid - half, y1: mid + half });
      }
    }

    const strokeSegments = (segments: Segment[], strokeColor: string) => {
      if (segments.length === 0) return;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = "butt";
      ctx.beginPath();
      for (const segment of segments) {
        ctx.moveTo(segment.x, segment.y0);
        ctx.lineTo(segment.x, segment.y1);
      }
      ctx.stroke();
    };

    strokeSegments(waveSegments, baseColor);
    strokeSegments(silentSegments, silentColor);
  }, [
    data,
    sampleRate,
    bufferStartSec,
    bufferLen,
    innerH,
    vbH,
    contentEndSec,
    strokeWidth,
    color,
    barSpacing,
  ]);

  useEffect(() => {
    draw();
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => draw());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [draw]);

  return <canvas ref={canvasRef} className={className} style={style} />;
});
