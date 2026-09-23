/**
 * Full-card empty state shown when no track is loaded.
 *
 * Makes the two entry points explicit: drop files anywhere on the window, or
 * press the Add MP3 button (hidden file input). This doubles as the primary
 * add affordance on small screens.
 */

import { useRef } from "react";
import MusicNoteIcon from "../assets/icons/favicon.svg?react";

interface EmptyStateProps {
  onAddFiles: (files: FileList) => void;
}

export function EmptyState({ onAddFiles }: EmptyStateProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="empty-state-wrap">
      <div className="empty-state">
        <div className="empty-state__art">
          <MusicNoteIcon />
        </div>
        <h2 className="empty-state__title">Add MP3 files to get started</h2>
        <p className="empty-state__subtitle">
          Drop files anywhere in this window, or pick them with the button
          below.
        </p>
        <button
          className="empty-state__add"
          onClick={() => fileInputRef.current?.click()}
        >
          Add MP3 files
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".mp3,audio/mpeg"
          multiple
          onChange={(e) => {
            if (e.target.files) onAddFiles(e.target.files);
            e.target.value = "";
          }}
          tabIndex={-1}
          style={{ display: "none" }}
        />
      </div>
    </div>
  );
}