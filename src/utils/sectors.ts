export interface Sector {
  start: number;
  end: number;
  // Original sectors kept under a virtually merged parent.
  children?: Sector[];
}

// A sample is silence when |v| <= 1% of the track's peak. Normalized to the
// peak so quiet recordings still split (a raw 0.01 cutoff would sit above the
// median of most files and reclassify all content as silence).
const SILENCE_RATIO = 0.01;
// A silent gap shorter than this does not split: the next sound run extends
// the previous sector instead of starting a new one.
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

// Split raw decoded audio into sectors: each contiguous run of samples with
// |v| > the silence cutoff becomes a sector, bounded by silent samples.
// Runs that follow a silent gap shorter than MERGE_GAP_SEC are folded into
// the previous sector instead of starting a new one.
export function splitBySilence(
  data: Float32Array | null,
  sampleRate: number,
): Sector[] {
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

  const sectors: Sector[] = [];
  let runActive = false;
  let startBlock = 0;
  let extendPrev = false;
  for (let b = 0; b <= numBlocks; b++) {
    const isSound = b < numBlocks && blockPeak[b] > SILENCE_RATIO;
    if (isSound && !runActive) {
      runActive = true;
      startBlock = b;
      const prev = sectors[sectors.length - 1];
      extendPrev =
        prev !== undefined && startBlock * blockSec - prev.end < MERGE_GAP_SEC;
    } else if (!isSound && runActive) {
      runActive = false;
      if (extendPrev) {
        sectors[sectors.length - 1].end = b * blockSec;
        extendPrev = false;
      } else {
        sectors.push({
          start: startBlock * blockSec,
          end: b * blockSec,
        });
      }
    }
  }
  // Expand each sector into the surrounding silence: extend equally on both
  // sides by the smaller of 30% of the left gap and 20% of the right gap, so
  // playback starts slightly before/after the sound run.
  const minGap = 0.4; // seconds
  for (let i = 0; i < sectors.length; i++) {
    const sector = sectors[i];
    const prevEnd = i > 0 ? sectors[i - 1].end : 0;
    const nextStart =
      i < sectors.length - 1 ? sectors[i + 1].start : data.length / sampleRate;
    const leftSilence = sector.start - prevEnd;
    const rightSilence = nextStart - sector.end;
    const expand = Math.min(minGap, minGap * leftSilence, minGap * rightSilence);
    sector.start = Math.max(0, sector.start - expand);
    sector.end = Math.min(data.length / sampleRate, sector.end + expand);
  }
  return sectors;
}

// Virtually merge consecutive sectors whose gap (in seconds) is <= minGap.
// Each merged group becomes a parent sector spanning group[0].start..group[n-1].end
// with the originals kept as children, so segments can be inspected individually.
export function mergeSectorsByGap(sectors: Sector[], minGap: number): Sector[] {
  if (sectors.length === 0) return [];

  const result: Sector[] = [];
  let group: Sector[] = [sectors[0]];

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

  for (let i = 1; i < sectors.length; i++) {
    const gap = sectors[i].start - group[group.length - 1].end;
    if (gap <= minGap) {
      group.push(sectors[i]);
    } else {
      flush();
      group = [sectors[i]];
    }
  }
  flush();
  return result;
}

// Distinct positive gaps between consecutive sectors, ascending.
export function sectorGaps(sectors: Sector[]): number[] {
  const gaps: number[] = [MERGE_GAP_SEC];
  for (let i = 1; i < sectors.length; i++) {
    const gap = sectors[i].start - sectors[i - 1].end;
    if (isFinite(gap) && gap > 0.01) gaps.push(gap);
  }
  return [...new Set(gaps)].sort((a, b) => a - b);
}