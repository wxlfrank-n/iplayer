/**
 * Represents a contiguous audio segment.
 * Used for both silence-split clips and merged groups.
 *
 * @property start - Start time in seconds
 * @property end - End time in seconds
 * @property children - For merged clips, contains the original clips that were merged
 */
export interface Clip {
  start: number;
  end: number;
  // Original clips kept under a virtually merged parent.
  children?: Clip[];
}

// A sample is silence when |v| <= 1% of the track's peak. Normalized to the
// peak so quiet recordings still split (a raw 0.01 cutoff would sit above the
// median of most files and reclassify all content as silence).
const SILENCE_RATIO = 0.01;
// A silent gap shorter than this does not split: the next sound run extends
// the previous clip instead of starting a new one.
export const MERGE_GAP_SEC = 0.05;

// Detection is block-based: the buffer is split into BLOCK_SAMPLES-sample
// windows and each block is classified sound/silent by its peak amplitude.
// This avoids one iteration per sample — for a ~3.7M-sample track it reads
// ~10k values instead of ~3.7M, which keeps the computation on the order of a
// millisecond even on slow mobile CPUs at the cost of a sub-block (<2 ms for
// BLOCK_SAMPLES=64) quantization of every boundary.
const BLOCK_SAMPLES = 512;
// Within a block, the peak is estimated from every PEAK_STRIDE-th sample. This
// still catches sub-block bursts (a loud click spans many samples) while
// bounding the reads done per block.
const PEAK_STRIDE = 256;

// Split raw decoded audio into clips: each contiguous run of samples with
// |v| > the silence cutoff becomes a clip, bounded by silent samples.
// Runs that follow a silent gap shorter than MERGE_GAP_SEC are folded into
// the previous clip instead of starting a new one.
export function splitBySilence(
  data: Float32Array | null,
  sampleRate: number,
): Clip[] {
  if (!data || data.length === 0 || sampleRate <= 0) return [];

  // Per-block peak amplitudes, computed over every PEAK_STRIDE-th sample.
  const numBlocks = Math.ceil(data.length / BLOCK_SAMPLES);
  const blockPeak = new Float32Array(numBlocks);
  for (let b = 0; b < numBlocks; b++) {
    const i0 = b * BLOCK_SAMPLES;
    const i1 = Math.min(i0 + BLOCK_SAMPLES, data.length);
    let peak = 0;
    for (let i = i0; i < i1; i += PEAK_STRIDE) {
      const v = data[i];
      const a = v < 0 ? -v : v;
      if (a > peak) peak = a;
    }
    blockPeak[b] = peak;
  }
  const blockSec = BLOCK_SAMPLES / sampleRate;

  const clips: Clip[] = [];
  let runActive = false;
  let startBlock = 0;
  let extendPrev = false;
  for (let b = 0; b <= numBlocks; b++) {
    const isSound = b < numBlocks && blockPeak[b] > SILENCE_RATIO;
    if (isSound && !runActive) {
      runActive = true;
      startBlock = b;
      const prev = clips[clips.length - 1];
      extendPrev =
        prev !== undefined && startBlock * blockSec - prev.end < MERGE_GAP_SEC;
    } else if (!isSound && runActive) {
      runActive = false;
      if (extendPrev) {
        clips[clips.length - 1].end = b * blockSec;
        extendPrev = false;
      } else {
        clips.push({
          start: startBlock * blockSec,
          end: b * blockSec,
        });
      }
    }
  }
  // Expand each clip into the surrounding silence: extend equally on both
  // sides by the smaller of 30% of the left gap and 20% of the right gap, so
  // playback starts slightly before/after the sound run.
  const minGap = 0.4; // seconds
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    const prevEnd = i > 0 ? clips[i - 1].end : 0;
    const nextStart =
      i < clips.length - 1 ? clips[i + 1].start : data.length / sampleRate;
    const leftSilence = clip.start - prevEnd;
    const rightSilence = nextStart - clip.end;
    const expand = Math.min(
      minGap,
      minGap * leftSilence,
      minGap * rightSilence,
    );
    clip.start = Math.max(0, clip.start - expand);
    clip.end = Math.min(data.length / sampleRate, clip.end + expand);
  }
  return clips;
}

// Virtually merge consecutive clips whose gap (in seconds) is <= minGap.
// Each merged group becomes a parent clip spanning group[0].start..group[n-1].end
// with the originals kept as children, so segments can be inspected individually.
export function mergeClipsByGap(clips: Clip[], minGap: number): Clip[] {
  if (clips.length === 0) return [];

  const result: Clip[] = [];
  let group: Clip[] = [clips[0]];

  const flush = () => {
    if (group.length === 1) {
      result.push(group[0]);
    } else {
      result.push({
        start: group[0].start,
        end: group[group.length - 1].end,
        children: group,
      });
    }
    group = [];
  };

  for (let i = 1; i < clips.length; i++) {
    const gap = clips[i].start - group[group.length - 1].end;
    if (gap <= minGap) {
      group.push(clips[i]);
    } else {
      flush();
      group = [clips[i]];
    }
  }
  flush();
  return result;
}

// Distinct positive gaps between consecutive clips, ascending.
export function clipGaps(clips: Clip[]): number[] {
  const gaps: number[] = [MERGE_GAP_SEC];
  for (let i = 1; i < clips.length; i++) {
    const gap = clips[i].start - clips[i - 1].end;
    if (isFinite(gap) && gap > 0.01) gaps.push(gap);
  }
  return [...new Set(gaps)].sort((a, b) => a - b);
}
