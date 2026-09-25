/**
 * Real-time frequency visualizer: reads live byte-frequency data from a Web
 * Audio AnalyserNode and draws smoothed vertical bars on a canvas. Runs its own
 * rAF loop and never triggers React re-renders.
 *
 * iOS/WebKit cannot route the <audio> element through the Web Audio graph
 * (`createMediaElementSource` desyncs playback, which breaks clip loops), so
 * the analyser is intentionally unavailable there. As a fallback, when
 * `getAnalyser` returns null the bars are derived from decoded waveform
 * samples around the live playhead (a moving energy profile of the actual
 * audio), so the canvas still dances on iOS.
 */

import { memo, useEffect, useRef } from "react";
import type { WaveformData } from "../types";

interface DancingLinesProps {
  getAnalyser?: (resume: boolean) => AnalyserNode | null;
  /** iOS fallback: live playhead time for sample-derived energy. */
  getCurrentTime?: () => number;
  /** iOS fallback: decoded mono samples (full track). */
  waveform?: WaveformData | null;
  /** Redux-confirmed playhead; reflects seeks immediately, while the audio
   *  element's `currentTime` readback lags a seek on some platforms. The
   *  fallback prefers this when playback isn't advancing and the live element
   *  time while it is. */
  currentTime?: number;
}

const BAR_COUNT = 56;
const SMOOTHING = 0.2;
const MIN_BAR_HEIGHT_PX = 3;
// How far behind the playhead the energy window trails (needs decoded audio).
const ENERGY_WINDOW_SEC = 1.2;
const ENERGY_LEAD_SEC = 0.02;

export const DancingLines = memo(function DancingLines({
  getAnalyser,
  getCurrentTime,
  waveform,
  currentTime,
}: DancingLinesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentTimeRef = useRef(currentTime);
  currentTimeRef.current = currentTime;
  const prevLiveRef = useRef(-1);

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
      if (analyser) {
        const len = analyser.frequencyBinCount;
        if (data.length !== len) data = new Uint8Array(len);
        analyser.getByteFrequencyData(data);
        for (let i = 0; i < BAR_COUNT; i++) {
          const bin = Math.min(
            len - 1,
            Math.floor((1 - Math.pow(1 - i / BAR_COUNT, 1.5)) * (len - 1)),
          );
          if (len === 0) continue;
          const v = data[bin] / 255;
          levels[i] += (Math.pow(v, 1.7) - levels[i]) * SMOOTHING;
        }
      } else if (waveform && getCurrentTime) {
        // iOS fallback: energy profile of the decoded samples trailing the
        // playhead — bar 0 is the newest energy, the last bar the oldest.
        const samples = waveform.data;
        const rate = waveform.sampleRate;
        const live = getCurrentTime();
        const prevLive = prevLiveRef.current;
        prevLiveRef.current = live;
        const t = live > prevLive ? live : (currentTimeRef.current ?? live);
        const lead = Math.max(0, t - ENERGY_LEAD_SEC);
        const s0 = Math.floor(Math.max(0, lead - ENERGY_WINDOW_SEC) * rate);
        const s1 = Math.min(samples.length, Math.ceil(Math.max(0, lead) * rate));
        const span = Math.max(1, s1 - s0);
        const perBar = Math.floor(span / BAR_COUNT);
        const stride = Math.max(1, Math.floor(perBar / 4));
        for (let i = 0; i < BAR_COUNT; i++) {
          const a = s0 + i * perBar;
          const b = Math.min(s1, a + perBar);
          let peak = 0;
          for (let s = a; s < b; s += stride) {
            const v = Math.abs(samples[s]);
            if (v > peak) peak = v;
          }
          const v = Math.min(1, Math.pow(peak, 0.55) * 3);
          levels[i] += (v - levels[i]) * SMOOTHING;
        }
      } else {
        // No analyser and no waveform source: decay bars to rest.
        for (let i = 0; i < BAR_COUNT; i++) {
          levels[i] += (0 - levels[i]) * SMOOTHING;
        }
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
        const h = Math.max(MIN_BAR_HEIGHT_PX, levels[i] * maxH);
        const x = i * bw + bw * 0.25;
        ctx.fillRect(x, base - h, bw * 0.5, h);
      }
      ctx.globalAlpha = 1;
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [getAnalyser, getCurrentTime, waveform]);

  return <canvas className="row-waveform__dance" ref={canvasRef} />;
});