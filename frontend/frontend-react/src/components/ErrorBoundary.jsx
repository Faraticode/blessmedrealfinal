import { Component } from "react";

// Catches render-time errors anywhere below it in the tree so one broken
// page can't blank out the whole app. Wrapped around <App /> in main.jsx.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("Unhandled UI error:", error, info);
  }

  handleReload = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="container" style={{ maxWidth: 560, textAlign: "center", padding: "60px 24px" }}>
          <h1 style={{ fontSize: "2.2rem", margin: 0 }}>Something went wrong</h1>
          <p className="muted">
            An unexpected error occurred. Try reloading — if it keeps happening, let us know what you were doing
            when it happened.
          </p>
          <button className="btn btn-primary" onClick={this.handleReload}>
            Reload BlessMed
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
