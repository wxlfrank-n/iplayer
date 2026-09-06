import * as ort from "onnxruntime-web/wasm";
import { decodeAudioBuffer } from "./audio";

const MODEL_URL = import.meta.env.BASE_URL + "silero_vad_v5.onnx";

// Silero VAD consumes 512-sample frames at 16 kHz, so each frame is 32 ms.
const VAD_SAMPLE_RATE = 16000;
const VAD_FRAME = 512;
const VAD_FRAME_SEC = VAD_FRAME / VAD_SAMPLE_RATE;

// Confidence threshold above which a frame counts as speech.
const SPEECH_THRESHOLD = 0.5;
// Pauses shorter than this stay inside one sentence.
const MIN_SENTENCE_GAP_SEC = 0.24;
// Brief speech-like bursts shorter than this are ignored as click/noise.
const MIN_SPEECH_SEC = 0.13;
// Extra audio kept around each detected sentence so playback doesn't clip it.
const SECTOR_PAD_SEC = 0.1;

export interface Sector {
  start: number;
  end: number;
}

let sessionPromise: Promise<ort.InferenceSession> | null = null;

function getVadSession(): Promise<ort.InferenceSession> {
  if (!sessionPromise) {
    sessionPromise = createSession();
    sessionPromise.catch(() => {
      sessionPromise = null;
    });
  }
  return sessionPromise;
}

async function createSession(): Promise<ort.InferenceSession> {
  const response = await fetch(MODEL_URL);
  if (!response.ok) throw new Error(`Failed to load VAD model (${response.status})`);
  const model = await response.arrayBuffer();

  // Multi-threading needs cross-origin isolation; ort automatically falls back
  // to single-threaded wasm when it is unavailable.
  ort.env.wasm.numThreads = Math.min(4, navigator.hardwareConcurrency ?? 2);

  return ort.InferenceSession.create(model, { executionProviders: ["wasm"] });
}

// Downmix to mono on the fly and feed 512-sample 16 kHz frames to the model.
// Returns one speech probability per frame (0.032 s resolution).
async function runVad(
  session: ort.InferenceSession,
  buffer: AudioBuffer,
): Promise<Float32Array> {
  const channelCount = buffer.numberOfChannels;
  const length = buffer.length;
  const ratio = buffer.sampleRate / VAD_SAMPLE_RATE;
  const channels = Array.from({ length: channelCount }, (_, c) =>
    buffer.getChannelData(c),
  );
  const frameCount = Math.floor((length * VAD_SAMPLE_RATE) / buffer.sampleRate / VAD_FRAME);
  const probs = new Float32Array(frameCount);
  const frame = new Float32Array(VAD_FRAME);

  const sr = new ort.Tensor("int64", [16000n]);
  let state: ort.Tensor = new ort.Tensor("float32", new Float32Array(2 * 128), [2, 1, 128]);

  for (let f = 0; f < frameCount; f++) {
    for (let j = 0; j < VAD_FRAME; j++) {
      const src = (f * VAD_FRAME + j) * ratio;
      const i0 = Math.floor(src);
      const frac = src - i0;
      const i1 = Math.min(i0 + 1, length - 1);
      let s0 = 0;
      let s1 = 0;
      for (let c = 0; c < channelCount; c++) {
        s0 += channels[c][i0];
        s1 += channels[c][i1];
      }
      if (channelCount > 1) {
        s0 /= channelCount;
        s1 /= channelCount;
      }
      frame[j] = s0 * (1 - frac) + s1 * frac;
    }

    const feeds = {
      input: new ort.Tensor("float32", new Float32Array(frame), [1, VAD_FRAME]),
      state,
      sr,
    };
    const out = await session.run(feeds);
    probs[f] = (out.output as ort.Tensor).data[0] as number;
    state = out.stateN as ort.Tensor;
  }

  sr.dispose();
  return probs;
}

// Convert frame-level speech probabilities into sentence sectors.
export function sectorsFromProbabilities(
  probs: Float32Array,
  duration: number,
): Sector[] {
  if (probs.length === 0) return [];

  const minGapFrames = Math.ceil(MIN_SENTENCE_GAP_SEC / VAD_FRAME_SEC);
  const minSpeechFrames = Math.ceil(MIN_SPEECH_SEC / VAD_FRAME_SEC);

  const runs: { start: number; end: number }[] = [];
  let start = -1;
  for (let i = 0; i <= probs.length; i++) {
    const isSpeech = i < probs.length && probs[i] >= SPEECH_THRESHOLD;
    if (isSpeech && start < 0) start = i;
    if (!isSpeech && start >= 0) {
      runs.push({ start, end: i });
      start = -1;
    }
  }

  // Keep brief intra-sentence pauses together; drop isolated noise blips.
  const merged: { start: number; end: number }[] = [];
  for (const run of runs) {
    const prev = merged.length ? merged[merged.length - 1] : null;
    if (prev && run.start - prev.end < minGapFrames) {
      prev.end = run.end;
    } else if (run.end - run.start >= minSpeechFrames) {
      merged.push({ start: run.start, end: run.end });
    }
  }

  return merged.map((s) => ({
    start: Math.max(0, s.start * VAD_FRAME_SEC - SECTOR_PAD_SEC),
    end: Math.min(duration, s.end * VAD_FRAME_SEC + SECTOR_PAD_SEC),
  }));
}

const analysisCache = new Map<string, Promise<Sector[]>>();

export function analyzeAudio(url: string): Promise<Sector[]> {
  const cached = analysisCache.get(url);
  if (cached) return cached;

  const pending = (async () => {
    const buffer = await decodeAudioBuffer(url);
    const session = await getVadSession();
    const probs = await runVad(session, buffer);
    return sectorsFromProbabilities(probs, buffer.duration);
  })();

  analysisCache.set(url, pending);
  pending.catch(() => analysisCache.delete(url));
  return pending;
}