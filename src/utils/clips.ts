/**
 * Silence-based clip detection.
 *
 * Explodes raw decoded audio into discrete clips by splitting around silent
 * gaps. Detection is block-based: the buffer is divided into fixed-width
 * windows and each window is classified sound/silent by its peak amplitude.
 *
 * Three user-configurable knobs are independent of one another:
 * - blockSamples  - width of the quantization window in samples
 * - silenceRatio   - window whose peak <= ratio * trackPeak counts as silence
 *                   (how QUIET, not how short)
 * - minSilenceLength - shortest acceptable clip in seconds, folded into the
 *                   previous clip when a run would be shorter; also seeds the
 *                   merge slider. Independent of silenceRatio.
 */

/** A single detected audio segment, in seconds. */
export interface Clip {
  start: number;
  end: number;
  vStart: number;
  vEnd: number;
  /** Original clips kept under a virtually merged parent. */
  children?: Clip[];
}

/** User-supplied silence-split parameters (config-driven). */
export interface SplitOptions {
  /** Block size in samples. Controls the quantization of clip boundaries. */
  blockSamples: number;
  /** A block whose peak is <= this ratio of the track peak counts as silence. */
  silenceRatio: number;
  /**
   * Shortest acceptable clip length in seconds, independent of `silenceRatio`.
   * A sound run that would leave a clip shorter than this is folded into the
   * previous clip instead of starting a new one. Optional so intact call sites
   * that only pass `{ blockSamples, silenceRatio }` keep compiling; the merge
   * slider and its seed come from the config selector `selectminSilenceLength`.
   */
  minSilenceLength: number;
}

/**
 * Split raw decoded audio into clips. Each contiguous run of blocks whose peak
 * exceeds `silenceRatio * trackPeak` becomes a clip, bounded by silent blocks.
 * Runs that would leave a clip shorter than `minSilenceLength` are folded into
 * the previous clip.
 */
export function splitBySilence(
  data: Float32Array | null,
  sampleRate: number,
  options: SplitOptions,
): Clip[] {
  if (!data || data.length === 0 || sampleRate <= 0) return [];

  const audioDuration = data.length / sampleRate;
  // min blockSamples = 64 to avoid a pathological case where a single block is
  const blockSamples = Math.max(64, Math.round(options.blockSamples));
  // silenceRatio is clamped to [0.0001, 0.01] so a single block can't be
  // misclassified as silence due to a single sample being quiet. A 0.01 ratio
  // is ~-40 dB, which is already very quiet.
  const silenceRatio = Math.min(0.01, Math.max(0.0001, options.silenceRatio));
  // minSilenceLength is clamped to [0.001, 0.05] so a single block can't be
  // misclassified as silence due to a single sample being quiet. A 0.1 s gap is
  // already very short, and a 0.001 s gap is already very short.
  const minSilenceLength = Math.min(
    0.05,
    Math.max(0.001, options.minSilenceLength),
  );

  // peakStride is the number of samples to skip when computing the peak of a
  // block. A smaller stride gives a more accurate peak, but takes longer to
  // compute. A larger stride is faster, but may miss short bursts of sound.
  // The default is 1/8 of the block size, which is a good compromise.
  const peakStride = Math.max(1, Math.round(blockSamples / 8));
  // number of blocks in the audio buffer, rounded up to include a partial block
  const numBlocks = Math.ceil(data.length / blockSamples);
  // how long each block is in seconds, used to convert block indices to time
  const blockSec = blockSamples / sampleRate;

  // Per-block peak amplitudes, computed over every peakStride-th sample so a
  // ~3.7M-sample track reads ~7k values instead of one iteration per sample.
  // A sub-block burst still spans many samples, so bursts are caught too.
  const blockPeak = new Float32Array(numBlocks);
  for (let b = 0; b < numBlocks; b++) {
    const i0 = b * blockSamples;
    const i1 = Math.min(i0 + blockSamples, data.length);
    let peak = 0;
    for (let i = i0; i < i1; i += peakStride) {
      const v = data[i];
      const a = v < 0 ? -v : v;
      if (a > peak) peak = a;
    }
    blockPeak[b] = peak;
  }

  // Track peak is the maximum of all block peaks, used to classify silence vs sound with silenceRatio. 
  // A single block can't be misclassified as silence due to a single sample being quiet, because the block peak is compared to the track peak.
  let trackPeak = 0;
  for (let b = 0; b < numBlocks; b++) {
    if (blockPeak[b] > trackPeak) trackPeak = blockPeak[b];
  }

  const silenceThreshold = silenceRatio * trackPeak;
  const clips: Clip[] = [];
  let clipStartBlock = -1;
  let mergeClip = false;
  for (let b = 0; b <= numBlocks; b++) {
    const isSound = b < numBlocks && blockPeak[b] > silenceThreshold;
    if (isSound && clipStartBlock === -1) {
      clipStartBlock = b;
      const prev = clips[clips.length - 1];
      mergeClip =
        prev !== undefined && clipStartBlock * blockSec - prev.end < minSilenceLength;
    } else if (!isSound && clipStartBlock != -1) {
      if (mergeClip) {
        clips[clips.length - 1].end = b * blockSec;
        clips[clips.length - 1].vEnd = b * blockSec;
        mergeClip = false;
      } else {
        if (clips.length > 0) {
          const prev = clips[clips.length - 1];
          const prevLength = prev.end - prev.start;
          if (prevLength < 0.3) {
            if (clips.length > 1) {
              const prevPrev = clips[clips.length - 2];
              const silentGap1 = prev.start - prevPrev.end;
              const silentGap2 = b * blockSec - prev.end;
              if (silentGap1 < silentGap2) {
                prevPrev.end = prev.end;
                prevPrev.vEnd = prev.vEnd;
                prev.start = clipStartBlock * blockSec;
                prev.vStart = clipStartBlock * blockSec;
                prev.end = b * blockSec;
                prev.vEnd = b * blockSec;
              } else {
                prev.end = b * blockSec;
                prev.vEnd = b * blockSec;
    }
            } else {
              prev.end = b * blockSec;
              prev.vEnd = b * blockSec;
            }
          } else {
            clips.push({ start: clipStartBlock * blockSec, end: b * blockSec, vStart: clipStartBlock * blockSec, vEnd: b * blockSec });
          }
        } else {
          clips.push({ start: clipStartBlock * blockSec, end: b * blockSec, vStart: clipStartBlock * blockSec, vEnd: b * blockSec });
        }
      }
      clipStartBlock = -1;
    }
  }

  // Expand each clip's start and end by a fraction of the surrounding silence, 
  // up to 35% of the gap on each side, but not beyond 10% of the clip length. 
  // This makes clips more natural and less abrupt.
  const expandRatio = 0.25;
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    const prevEnd = i > 0 ? clips[i - 1].end : 0;
    const nextStart =
      i < clips.length - 1 ? clips[i + 1].start : audioDuration;
    expandClip(clip, expandRatio * (clip.start - prevEnd), expandRatio * (nextStart - clip.end), 0, audioDuration);
  }
  return clips;
}

function expandClip(clip: Clip, startExpand: number, endExpand: number, minStart: number, maxEnd: number): void {
  const maxRange = 0.1 * (clip.end - clip.start);
  clip.vStart = Math.max(minStart, clip.start - Math.min(maxRange, startExpand));
  clip.vEnd = Math.min(maxEnd, clip.end + Math.min(maxRange, endExpand));
}

/**
 * Virtually merge consecutive clips whose intervening gap (in seconds) is at
 * most `minGap`. Each merged group becomes a parent clip spanning the first
 * child's start to the last child's end, keeping the originals as children.
 */
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
        vStart: group[0].vStart,
        vEnd: group[group.length - 1].vEnd,
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

/**
 * Distinct positive gaps between consecutive clips (seconds), ascending,
 * seeded with `minSilenceLength` so the merge slider always offers the configured
 * minimum as its smallest step. Independent of `silenceRatio`.
 */
export function clipGaps(clips: Clip[], minSilenceLength: number): number[] {
  const gaps: number[] = [minSilenceLength];
  for (let i = 1; i < clips.length; i++) {
    const gap = clips[i].start - clips[i - 1].end;
    if (isFinite(gap) && gap > 0.01) gaps.push(gap);
  }
  return [...new Set(gaps)].sort((a, b) => a - b);
}
