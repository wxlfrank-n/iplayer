import { useMemo } from "react";

interface WaveformBarsProps {
  data: Float32Array;
  sampleRate: number;
  windowStartSec: number;
  windowLen: number;
  innerH: number;
  vbW: number;
  vbH: number;
  fracPlayed: number;
  idPrefix?: string;
  strokeWidth?: number;
}

const BASE_COLOR = "#8b949e";
const PLAYED_COLOR = "#58a6ff";
const SILENT_COLOR = "#4b545e";
const MIN_BAR_PX = 2;

export function WaveformBars({
  data,
  sampleRate,
  windowStartSec,
  windowLen,
  innerH,
  vbW,
  vbH,
  fracPlayed,
  idPrefix = "playedClip",
  strokeWidth = 1,
}: WaveformBarsProps) {
  // One vertical bar per horizontal pixel "frame": each frame covers a slice of
  // samples and the bar spans that slice's min..max sample amplitude, tracing
  // the wave shape instead of a symmetric peak. A 3-tap smoothing pass on both
  // edges keeps adjacent bars visually continuous. Sub-pixel (silent) frames get
  // a dimmed min-height tick so silent stretches stay visible.
  const { waveD, silentD } = useMemo(() => {
    if (data.length === 0 || windowLen <= 0) return { waveD: "", silentD: "" };
    const i0 = Math.max(0, Math.floor(windowStartSec * sampleRate));
    const i1 = Math.min(data.length, Math.ceil((windowStartSec + windowLen) * sampleRate));
    const total = Math.max(1, i1 - i0);
    const frames = Math.max(1, Math.floor(vbW));
    const perFrame = total / frames;
    const midY = vbH / 2;
    const scaleY = innerH / 2;

    const topPts: number[] = [];
    const botPts: number[] = [];
    for (let f = 0; f < frames; f++) {
      const s0 = i0 + Math.floor(f * perFrame);
      const s1 = Math.min(i1, i0 + Math.floor((f + 1) * perFrame));
      let min = s0 < i1 ? data[s0] : 0;
      let max = min;
      for (let s = s0; s < s1; s++) {
        const v = data[s];
        if (v < min) min = v;
        if (v > max) max = v;
      }
      topPts.push(midY - max * scaleY);
      botPts.push(midY - min * scaleY);
    }

    const smooth = (pts: number[]) => {
      const out = new Array<number>(pts.length);
      for (let f = 0; f < pts.length; f++) {
        const a = pts[Math.max(0, f - 1)];
        const b = pts[f];
        const c = pts[Math.min(pts.length - 1, f + 1)];
        out[f] = (a + 2 * b + c) / 4;
      }
      return out;
    };
    const topSm = smooth(topPts);
    const botSm = smooth(botPts);

    let waveD = "";
    let silentD = "";
    for (let f = 0; f < frames; f++) {
      const top = topSm[f];
      const bot = botSm[f];
      if (bot - top >= MIN_BAR_PX) {
        waveD += `M${f} ${top.toFixed(2)}L${f} ${bot.toFixed(2)}`;
        continue;
      }
      const mid = (top + bot) / 2;
      const half = MIN_BAR_PX / 2;
      silentD += `M${f} ${((mid - half)).toFixed(2)}L${f} ${(mid + half).toFixed(2)}`;
    }
    return { waveD, silentD };
  }, [data, sampleRate, windowStartSec, windowLen, innerH, vbW, vbH]);

  const clipWidth = Math.max(fracPlayed * vbW, 1);

  return (
    <>
      <path d={waveD} fill="none" stroke={BASE_COLOR} strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke" />
      {silentD && (
        <path d={silentD} fill="none" stroke={SILENT_COLOR} strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke" />
      )}
      <path
        d={waveD}
        fill="none"
        stroke={PLAYED_COLOR}
        strokeWidth={strokeWidth}
        vectorEffect="non-scaling-stroke"
        clipPath={`url(#${idPrefix})`}
      />
      <defs>
        <clipPath id={idPrefix}>
          <rect x={0} y={vbH / 2 - innerH / 4} width={clipWidth} height={innerH / 2} />
        </clipPath>
      </defs>
    </>
  );
}