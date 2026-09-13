/**
 * React Error Boundary component.
 *
 * Catches render errors and child errors, displays the error message on screen.
 * Essential for mobile browsers that may not expose devtools.
 * Also logs to console and localStorage for debugging.
 */

import { Component, type ReactNode } from "react";

interface State {
  error: Error | null;
}

// Catches render/child errors, shows the message on screen so mobile browsers
// (which may not expose devtools) can display what actually failed.
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: 24,
            fontFamily: "monospace",
            fontSize: 12,
            whiteSpace: "pre-wrap",
          }}
        >
          <h3>App crashed</h3>
          <p>{String(this.state.error)}</p>
          <p style={{ color: "#888" }}>{this.state.error.stack}</p>
        </div>
      );
    }
    return this.props.children;
  }
}
