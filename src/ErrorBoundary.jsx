import { Component } from "react";
import { Centered } from "./AuthGate";
import { SANS, MONO, MUTE, BRICK, RADIUS_SM } from "./theme";

// React error boundaries have no hook equivalent -- a render error anywhere
// below this, uncaught, would otherwise white-screen the whole app with no
// way back in.
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Unhandled error in app render", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <Centered>
        <h1 style={{ fontFamily: SANS, fontSize: 21, fontWeight: 700, letterSpacing: "-0.01em", margin: "0 0 6px" }}>Something went wrong</h1>
        <p style={{ fontFamily: MONO, fontSize: 12.5, color: MUTE, margin: "0 0 20px" }}>
          The app hit an unexpected error. Your data on the server is untouched -- reload to try again.
        </p>
        <button
          className="ui-btn ui-btn-primary"
          onClick={() => window.location.reload()}
          style={{ "--btn-c": BRICK, border: `1px solid ${BRICK}`, background: BRICK, color: "#fff", fontFamily: SANS, fontWeight: 600, fontSize: 14, padding: "10px 18px", borderRadius: RADIUS_SM, cursor: "pointer" }}
        >
          Reload
        </button>
        <p style={{ fontFamily: MONO, fontSize: 10.5, color: MUTE, marginTop: 18 }}>{String(this.state.error.message || this.state.error)}</p>
      </Centered>
    );
  }
}
