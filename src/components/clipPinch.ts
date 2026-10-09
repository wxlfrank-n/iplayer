/**
 * Coordination shared between the two-finger clip "snip" gestures (squeeze to
 * merge across clips, spread to split a single clip) and the single pointer
 * gestures that live beside them.
 *
 * These are module singletons on purpose: the pinch is detected above the clips
 * (on the waveform container), while Clip instances and the horizontal
 * drag/pans live below or beside it. There is exactly one app instance, so a
 * singleton is the simplest way for the three owners to agree on what is
 * happening without threading refs through every layer.
 */

/** Inward squeeze (px) that counts as a merge before the fingers release. */
export const PINCH_MERGE_THRESHOLD_PX = 40;

/** Outward spread (px) that counts as a split before the fingers release. */
export const PINCH_SPLIT_THRESHOLD_PX = 40;

/**
 * True while two fingers are down on clips.
 *
 * RowWaveform's horizontal pan and StackedWaveform's page drag must stand down
 * while it is set, so the squeeze (or spread) is not mistaken for horizontal
 * navigation.
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

  /**
   * True while a single clip pointer has latched into a swipe direction.
   * From that moment the gesture belongs to the clip: the horizontal pan /
   * page drag must stand down, or the live preview would be stolen by
   * viewport movement mid-swipe. Cleared on release/cancel.
   */
  clipSwipeLocked: false,
};
