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
export const MERGE_GAP_SEC = 0.1;

// Split raw decoded audio into sectors: each contiguous run of samples with
// |v| > the silence cutoff becomes a sector, bounded by silent samples.
// Runs that follow a silent gap shorter than MERGE_GAP_SEC are folded into
// the previous sector instead of starting a new one.
export function splitBySilence(
  data: Float32Array | null,
  sampleRate: number,
): Sector[] {
  if (!data || data.length === 0 || sampleRate <= 0) return [];

  const sectors: Sector[] = [];
  let runActive = false;
  let startSample = 0;
  let extendPrev = false;
  for (let i = 0; i <= data.length; i++) {
    const isSound =
      i < data.length && (data[i] < 0 ? -data[i] : data[i]) > SILENCE_RATIO;
    if (isSound && !runActive) {
      runActive = true;
      startSample = i;
      const prev = sectors[sectors.length - 1];
      extendPrev =
        prev !== undefined && i / sampleRate - prev.end < MERGE_GAP_SEC;
    } else if (!isSound && runActive) {
      runActive = false;
      if (extendPrev) {
        sectors[sectors.length - 1].end = i / sampleRate;
        extendPrev = false;
      } else {
        sectors.push({
          start: startSample / sampleRate,
          end: i / sampleRate,
        });
      }
    }
  }
  // Expand each sector into the surrounding silence: absorb 10% of each
  // adjacent silent gap so playback starts slightly before/after the sound run.
  for (let i = 0; i < sectors.length; i++) {
    const sector = sectors[i];
    const prevEnd = i > 0 ? sectors[i - 1].end : 0;
    const nextStart =
      i < sectors.length - 1 ? sectors[i + 1].start : data.length / sampleRate;
    const leftSilence = sector.start - prevEnd;
    const rightSilence = nextStart - sector.end;
    sector.start = Math.max(0, sector.start - 0.1 * leftSilence);
    sector.end = Math.min(data.length / sampleRate, sector.end + 0.1 * rightSilence);
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