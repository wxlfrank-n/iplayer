import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { useT } from "../i18n";
import "./WaveformViewFlipButton.css";

export type WaveformView = "horizontal" | "stacked";

interface WaveformViewFlipButtonProps {
  view: WaveformView;
  onChange: (view: WaveformView) => void;
  disabled?: boolean;
}

const ANIMATION_MS = 520;
const VIEW_CHANGE_MS = 260;

/**
 * Shows the view we are switching TO.
 */
function ViewIcon({
  view,
}: {
  view: WaveformView;
}) {
  if (view === "stacked") {
    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="M5 6h14" />
        <path d="M5 12h14" />
        <path d="M5 18h14" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M3 12h2" />
      <path d="M7 8v8" />
      <path d="M10 5v14" />
      <path d="M13 7v10" />
      <path d="M16 9v6" />
      <path d="M19 11v2" />
      <path d="M21 12h1" />
    </svg>
  );
}

export const WaveformViewFlipButton = memo(
  function WaveformViewFlipButton({
    view,
    onChange,
    disabled = false,
  }: WaveformViewFlipButtonProps) {
    const [flipping, setFlipping] =
      useState(false);

    const changeTimerRef =
      useRef<number | undefined>(undefined);

    const finishTimerRef =
      useRef<number | undefined>(undefined);

    const t = useT();

    const nextView: WaveformView =
      view === "horizontal"
        ? "stacked"
        : "horizontal";

    const clearTimers = useCallback(() => {
      if (
        changeTimerRef.current !== undefined
      ) {
        window.clearTimeout(
          changeTimerRef.current,
        );

        changeTimerRef.current = undefined;
      }

      if (
        finishTimerRef.current !== undefined
      ) {
        window.clearTimeout(
          finishTimerRef.current,
        );

        finishTimerRef.current = undefined;
      }
    }, []);

    useEffect(() => {
      return clearTimers;
    }, [clearTimers]);

    const handleClick = useCallback(() => {
      if (disabled || flipping) {
        return;
      }

      clearTimers();

      setFlipping(true);

      /*
       * Change the underlying waveform when the page
       * is approximately halfway through the turn.
       *
       * The folded page visually masks the change.
       */
      changeTimerRef.current =
        window.setTimeout(() => {
          onChange(nextView);

          changeTimerRef.current =
            undefined;
        }, VIEW_CHANGE_MS);

      finishTimerRef.current =
        window.setTimeout(() => {
          setFlipping(false);

          finishTimerRef.current =
            undefined;
        }, ANIMATION_MS);
    }, [
      clearTimers,
      disabled,
      flipping,
      nextView,
      onChange,
    ]);

    return (
      <button
        type="button"
        className={[
          "waveform-view-flip",
          flipping
            ? "waveform-view-flip--flipping"
            : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={handleClick}
        disabled={disabled}
        aria-label={
          nextView === "stacked"
            ? t("viewFlip.toStacked")
            : t("viewFlip.toSingle")
        }
        title={
          nextView === "stacked"
            ? t("viewFlip.stacked")
            : t("viewFlip.single")
        }
      >
        {/*
         * Permanent top-right corner.
         */}
        <span
          className="waveform-view-flip__corner"
          aria-hidden="true"
        />

        {/*
         * Icon for the destination view.
         */}
        <span
          className="waveform-view-flip__icon"
          aria-hidden="true"
        >
          <ViewIcon view={nextView} />
        </span>

        {/*
         * The folded page.
         *
         * There is deliberately NO crease/fold-line
         * element.
         *
         * The fold line exists only as the imaginary
         * symmetry axis used by the animation geometry.
         */}
        <span
          className="waveform-view-flip__page"
          aria-hidden="true"
        >
          <span className="waveform-view-flip__folded" />
        </span>
      </button>
    );
  },
);