/**
 * Adds MP3 files to the player from a file picker or a drag-and-drop target.
 *
 * Owns the "add files" reaction (passing the selection to the player's track
 * loader and reporting how many non-MP3 files were skipped) together with the
 * whole-window drag-and-drop wiring. Returns a `drop` ref to attach to the
 * element that should accept file drops, plus `isOver` to drive its visual
 * drag state.
 */

import { useCallback } from "react";
import { useDrop } from "react-dnd";
import { NativeTypes } from "react-dnd-html5-backend";

interface AddTracksResult {
  added: number;
  skipped: number;
}

export function useAddFiles(
  addTracks: (
    files: FileList,
    playAfter?: boolean,
  ) => AddTracksResult,
  onSkipped?: (skipped: number) => void,
) {
  const handleFiles = useCallback(
    (files: FileList, playAfter: boolean = true) => {
      const { skipped } = addTracks(files, playAfter);
      if (skipped > 0) onSkipped?.(skipped);
    },
    [addTracks, onSkipped],
  );

  const [{ isOver }, drop] = useDrop(
    () => ({
      accept: [NativeTypes.FILE],
      drop: (item: { files?: FileList }) => {
        if (item.files && item.files.length > 0) handleFiles(item.files);
      },
      collect: (monitor) => ({ isOver: monitor.isOver() }),
    }),
    [handleFiles],
  );

  return { handleFiles, isOver, drop };
}