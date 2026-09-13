/**
 * Repeat count stepper for the clip toolbar.
 *
 * Lets the user choose how many times a clip is played when clicked. The count
 * is rendered as a -/+ stepper clamped between 1 and 20.
 *
 * Value handling:
 * - Fully controlled: the parent owns the count and receives changes via
 *   `onChange(value)`.
 */
interface RepsStepperProps {
  /** Number of times a clicked clip is repeated. */
  value: number;
  /** Reports the new count whenever the user steps it. */
  onChange: (value: number) => void;
  /** Lower bound for the count. */
  min?: number;
  /** Upper bound for the count. */
  max?: number;
}

export function RepsStepper({
  value,
  onChange,
  min = 1,
  max = 20,
}: RepsStepperProps) {
  const step = (delta: number) =>
    onChange(Math.min(max, Math.max(min, value + delta)));

  return (
    <div
      className="clip-reps"
      title={`Repeat ${value} times when you click a clip`}
    >
      <span className="clip-reps__label">Repeat:</span>
      <div className="clip-reps__stepper">
        <button
          type="button"
          aria-label="Decrease repeats"
          title="Play each clip fewer times"
          disabled={value <= min}
          onClick={() => step(-1)}
        >
          −
        </button>
        <span className="clip-reps__value">{value}</span>
        <button
          type="button"
          aria-label="Increase repeats"
          title="Play each clip more times"
          disabled={value >= max}
          onClick={() => step(1)}
        >
          +
        </button>
      </div>
    </div>
  );
}
