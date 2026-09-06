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
}

const BASE_COLOR = "#30363d";
const PLAYED_COLOR = "#58a6ff";

export function WaveformBars({
  data,
  sampleRate,
  windowStartSec,
  windowLen,
  innerH,
  vbW,
  vbH,
  fracPlayed,
}: WaveformBarsProps) {
  // One connecting line through the raw samples, capped to one point per
  // horizontal pixel so the path stays small and cheap to rasterize.
  const lineD = useMemo(() => {
    if (data.length === 0 || windowLen <= 0) return "";
    const i0 = Math.max(0, Math.floor(windowStartSec * sampleRate));
    const i1 = Math.min(data.length, Math.ceil((windowStartSec + windowLen) * sampleRate));
    const count = Math.max(1, i1 - i0);
    const stepX = vbW / count;
    const midY = vbH / 2;
    const scaleY = innerH / 2;

    let d = "";
    let xPrev = -1;
    for (let s = i0; s < i1; s++) {
      const px = Math.round((s - i0) * stepX);
      if (px === xPrev) continue;
      xPrev = px;
      const y = midY - data[s] * scaleY;
      d += (d ? "L" : "M") + px + " " + Math.round(y * 100) / 100;
    }
    return d;
  }, [data, sampleRate, windowStartSec, windowLen, innerH, vbW, vbH]);

  const clipWidth = Math.max(fracPlayed * vbW, 1);

  return (
    <>
      <path d={lineD} fill="none" stroke={BASE_COLOR} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      <path
        d={lineD}
        fill="none"
        stroke={PLAYED_COLOR}
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
        clipPath="url(#playedClip)"
      />
      <defs>
        <clipPath id="playedClip">
          <rect x={0} y={0} width={clipWidth} height={vbH} />
        </clipPath>
      </defs>
    </>
  );
}