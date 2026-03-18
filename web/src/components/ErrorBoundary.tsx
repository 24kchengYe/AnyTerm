/**
 * Error boundary — catches React render errors and shows a recovery UI
 * instead of a blank screen.
 */
import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  handleReload = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          onClick={this.handleReload}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            width: '100%',
            background: '#1a1b26',
            color: '#f7768e',
            cursor: 'pointer',
            gap: 12,
            fontSize: 14,
            userSelect: 'none',
          }}
        >
          <div style={{ fontSize: 32 }}>!</div>
          <div>Terminal crashed, click to reload</div>
        </div>
      );
    }

    return this.props.children;
  }
}
