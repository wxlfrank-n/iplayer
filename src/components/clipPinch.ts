/**
 * Coordination shared between the two-finger clip "snip" gesture and the single
 * pointer gestures that live beside it.
 *
 * These are module singletons on purpose: the pinch is detected above the clips
 * (on the waveform container), while Clip instances and the horizontal
 * drag/pans live below or beside it. There is exactly one app instance, so a
 * singleton is the simplest way for the three owners to agree on what is
 * happening without threading refs through every layer.
 */

/** Inward squeeze (px) that counts as a merge before the fingers release. */
export const PINCH_MERGE_THRESHOLD_PX = 40;

/**
 * True while two fingers are down on two clips.
 *
 * RowWaveform's horizontal pan and StackedWaveform's page drag must stand down
 * while it is set, so the squeeze is not mistaken for horizontal navigation.
 */
export const clipPinchState = {active: false};

/**
 * Which clip pointers are currently down, tracked across Clip instances so a
 * tap on one finger can never fire while another finger is also down.
 */
export const clipGestureLedger = {
  active: new Set<number>(),
  /** True once (during a session) two clip pointers were down at once. */
  multi: false,
};
