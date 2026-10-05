/**
 * Plays the clip named by a parent's `ClipPlayRequest`.
 *
 * A split or merge changes which clip should be playing, and the parent owns
 * that decision. It describes it as data rather than reaching into a view
 * through a handle, and each waveform view reacts here because it is the only
 * place that can arm its own playback context.
 *
 * Requests carry a `nonce` so re-rendering with the same request is a no-op
 * while a genuinely new request (even for the same clip) replays.
 */

import {useEffect, useRef} from 'react';

import type {ClipPlayRequest} from '../types';

export function useClipPlayRequest(
  clipPlayRequest: ClipPlayRequest | undefined,
  playRange: (start: number, end: number, repetitions: number) => void,
): void {
  const handledNonceRef = useRef(0);

  useEffect(() => {
    if (!clipPlayRequest) return;

    if (handledNonceRef.current === clipPlayRequest.nonce) return;

    handledNonceRef.current = clipPlayRequest.nonce;

    playRange(
      clipPlayRequest.clip.vStart,
      clipPlayRequest.clip.vEnd,
      clipPlayRequest.repetitions,
    );
  }, [clipPlayRequest, playRange]);
}
