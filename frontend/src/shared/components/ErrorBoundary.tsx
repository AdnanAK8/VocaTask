import { Component, type ErrorInfo, type ReactNode } from 'react';
import { errorTelemetry, type CapturedError } from '../services/errorTelemetry';
import { AlertCircle, RefreshCw, Sparkles } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  onOpenFrontFix?: (capturedError?: CapturedError) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  lastCaptured: CapturedError | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      lastCaptured: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const captured = errorTelemetry.reportReactError(error, errorInfo);
    this.setState({ errorInfo, lastCaptured: captured });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      lastCaptured: null,
    });
  };

  handleDiagnose = () => {
    if (this.props.onOpenFrontFix) {
      this.props.onOpenFrontFix(this.state.lastCaptured || undefined);
    }
  };

  render() {
    if (this.state.hasError) {
      const { error, errorInfo } = this.state;
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="max-w-xl w-full bg-white rounded-2xl shadow-xl border border-red-100 overflow-hidden">
            <div className="bg-red-50 p-6 border-b border-red-100 flex items-start gap-4">
              <div className="p-3 bg-red-100 text-red-600 rounded-xl">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-red-900">Something went wrong</h2>
                <p className="text-sm text-red-700 mt-1">
                  VocaTask safely caught a rendering exception before it crashed your browser.
                </p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-slate-900 text-slate-100 p-4 rounded-xl text-xs font-mono overflow-x-auto max-h-48 border border-slate-800">
                <p className="font-bold text-red-400">{error?.toString()}</p>
                {errorInfo?.componentStack && (
                  <p className="text-slate-400 mt-2 whitespace-pre-wrap">{errorInfo.componentStack.trim()}</p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={this.handleDiagnose}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white rounded-xl font-semibold shadow-md shadow-teal-700/20 transition-all cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  Diagnose with FrontFix AI
                </button>
                <button
                  onClick={this.handleReset}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-all cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
