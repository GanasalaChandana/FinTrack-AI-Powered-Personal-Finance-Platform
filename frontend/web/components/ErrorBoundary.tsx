'use client';

import React, { ReactNode, Component, ErrorInfo } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from './ui/Button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error Boundary caught:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-800 p-4">
            <div className="max-w-md w-full bg-white dark:bg-neutral-800 rounded-2xl shadow-lg p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-error-100 dark:bg-error-900 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-error-600 dark:text-error-400" />
              </div>
              <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50 mb-2">
                Something went wrong
              </h1>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
                An unexpected error has occurred. Please try refreshing the page.
              </p>
              {process.env.NODE_ENV === 'development' && (
                <details className="text-left mb-4 p-3 bg-neutral-50 dark:bg-neutral-700 rounded-lg">
                  <summary className="cursor-pointer font-semibold text-xs text-neutral-700 dark:text-neutral-300">
                    Error Details
                  </summary>
                  <pre className="text-xs text-error-600 dark:text-error-400 mt-2 overflow-auto max-h-32">
                    {this.state.error?.message}
                  </pre>
                </details>
              )}
              <Button
                onClick={() => window.location.reload()}
                variant="primary"
                className="w-full"
              >
                <RotateCcw className="w-4 h-4" />
                Refresh Page
              </Button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
