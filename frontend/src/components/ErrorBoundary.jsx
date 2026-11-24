import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("UI error", error, info?.componentStack);
  }

  componentDidUpdate(previousProps) {
    if (this.state.error && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }
    const isChunkError = /Loading chunk|dynamically imported module|Failed to fetch/i.test(String(this.state.error));
    return (
      <div role="alert" className="glass mx-auto mt-10 max-w-lg rounded-panel p-8 text-center">
        <h2 className="text-ink text-lg font-semibold">
          {isChunkError ? "A new version is available" : "This page hit an unexpected error"}
        </h2>
        <p className="text-muted mt-2 text-sm">
          {isChunkError
            ? "The app was updated while this tab was open. Reload to get the latest version."
            : "Your data is safe. Reload the page, and if it keeps happening, let your admin know."}
        </p>
        <button type="button" className="btn btn-primary mt-5 px-4" onClick={() => window.location.reload()}>
          Reload page
        </button>
      </div>
    );
  }
}
