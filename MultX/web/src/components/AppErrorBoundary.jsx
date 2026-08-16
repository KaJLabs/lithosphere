import React from 'react';
import { captureExplorerError } from '../services/errorTracking';

export class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false
    };
  }

  static getDerivedStateFromError() {
    return {
      hasError: true
    };
  }

  componentDidCatch(error, errorInfo) {
    captureExplorerError(error, {
      componentStack: errorInfo?.componentStack || ''
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fatalError">
          <div className="fatalError-card">
            <p className="fatalError-eyebrow">Explorer Error</p>
            <h1>Something went wrong.</h1>
            <p>The client hit an unexpected error. Reload the page or retry in a moment.</p>
            <button type="button" className="primary-btn" onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AppErrorBoundary;
