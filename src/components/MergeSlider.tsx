/**
 * Merge threshold slider for the clip toolbar.
 *
 * Lets the user adjust how long a silent gap between detected clips must be
 * before the clips are combined into one. The control is a range input flanked
 * by -/+ steppers, with a floating bubble showing the resulting clip count.
 *
 * Value handling:
 * - `value` is the snapped merge gap (seconds), owned by the parent who uses it
 *   for the actual merging. The component is controlled through this prop and
 *   reports changes via `onChange(gap)`.
 * - The raw continuous thumb position is kept as *internal* state, so dragging
 *   is smooth: the thumb follows the pointer while the effective merge gap snaps
 *   to the nearest detected gap boundary (from `gapValues`).
 */
import { useEffect, useRef, useState } from "react";

interface MergeSliderProps {
  /** Snapped merge gap (seconds) used for merging clips. */
  value: number;
  /** Detected silent-gap lengths the slider snaps to, ascending. */
  gapValues: number[];
  /** Number of clips after merging, shown in the bubble. */
  clipCount: number;
  /** Reports the snapped merge gap whenever it changes. */
  onChange: (gap: number) => void;
}

export function MergeSlider({
  value,
  gapValues,
  clipCount,
  onChange,
}: MergeSliderProps) {
  // Raw thumb position (seconds). Internal so the thumb tracks the pointer
  // continuously while dragging; only the reported `value` snaps.
  const [sliderValue, setSliderValue] = useState(value);
  // Slider metrics: track the slider element's width and thumb size so the
  // bubble label stays anchored to the thumb as the layout resizes.
  const sliderWrapRef = useRef<HTMLDivElement>(null);
  const [sliderMetrics, setSliderMetrics] = useState({
    width: 200,
    thumbW: 10,
  });

  // Snap the current raw slider position to the nearest detected gap boundary.
  const gapMin = gapValues.length > 0 ? gapValues[0] : 0;
  const gapMax = gapValues.length > 0 ? gapValues[gapValues.length - 1] : 0;
  const mergePct =
    gapMax > gapMin
      ? Math.min(1, Math.max(0, (sliderValue - gapMin) / (gapMax - gapMin)))
      : 0;
  const bubbleLeft =
    sliderMetrics.width -
    (sliderMetrics.thumbW / 2 +
      (sliderMetrics.width - sliderMetrics.thumbW) * mergePct);

  useEffect(() => {
    const el = sliderWrapRef.current;
    if (!el) return;
    const update = () => {
      const tw =
        parseFloat(getComputedStyle(el).getPropertyValue("--thumb-w")) || 10;
      setSliderMetrics({ width: el.clientWidth, thumbW: tw });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Steppers move the gap to the adjacent detected boundary; the slider drag
  // follows the pointer continuously and snaps only the effective merge gap.
  const stepToPrev = () => {
    const i = gapValues.indexOf(value);
    const next = gapValues[i > 0 ? i - 1 : 0];
    if (next !== undefined) {
      setSliderValue(next);
      onChange(next);
    }
  };
  const stepToNext = () => {
    const i = gapValues.indexOf(value);
    const next =
      gapValues[
        i >= 0 && i < gapValues.length - 1 ? i + 1 : gapValues.length - 1
      ];
    if (next !== undefined) {
      setSliderValue(next);
      onChange(next);
    }
  };
  const onSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = parseFloat(e.target.value);
    // Keep the thumb continuous but clamp the effective gap to the nearest
    // detected boundary so merging always uses a "real" silent-gap length.
    setSliderValue(raw);
    let best = 0;
    let bestDist = Infinity;
    for (const g of gapValues) {
      const d = Math.abs(g - raw);
      if (d < bestDist) {
        bestDist = d;
        best = g;
      }
    }
    onChange(best);
  };

  return (
    <div className="clip-merge">
      <div className="clip-merge__stepper">
        <button
          type="button"
          aria-label="Increase merge gap"
          title="Fewer clips"
          disabled={value >= gapValues[gapValues.length - 1]}
          onClick={stepToNext}
        >
          -
        </button>
        <div className="clip-merge__slider" ref={sliderWrapRef}>
          <span
            className="clip-merge__bubble"
            style={{ left: `${bubbleLeft}px` }}
            title="Clips separated by a silent gap up to this long are merged into one"
          >
            {clipCount} {clipCount === 1 ? "clip" : "clips"}
          </span>
          <input
            type="range"
            min={gapValues[0]}
            max={gapValues[gapValues.length - 1]}
            step={0.005}
            value={sliderValue}
            title={`clips separated less than ${sliderValue.toFixed(2)}s are combined into one`}
            onChange={onSliderChange}
          />
        </div>
        <button
          type="button"
          aria-label="Decrease merge gap"
          title="more clips"
          disabled={value <= gapValues[0]}
          onClick={stepToPrev}
        >
          +
        </button>
      </div>
    </div>
  );
}
