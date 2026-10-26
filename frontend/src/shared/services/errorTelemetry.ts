/**
 * Real-Time Frontend Error Telemetry Service
 * Listens for uncaught runtime errors, unhandled promise rejections,
 * and React ErrorBoundary crashes in real time, notifying FrontFix AI.
 */

export interface CapturedError {
  id: string;
  message: string;
  stack?: string;
  source: 'window_error' | 'unhandled_rejection' | 'react_boundary' | 'console_error';
  filename?: string;
  lineno?: number;
  colno?: number;
  timestamp: string;
  componentStack?: string;
}

type ErrorListener = (errors: CapturedError[]) => void;

class ErrorTelemetryService {
  private errors: CapturedError[] = [];
  private listeners: Set<ErrorListener> = new Set();
  private initialized = false;

  public init(): void {
    if (this.initialized || typeof window === 'undefined') return;
    this.initialized = true;

    // 1. Capture uncaught runtime errors
    window.addEventListener('error', (event: ErrorEvent) => {
      // Ignore cross-origin resize observer or extension noise
      if (
        event.message?.includes('ResizeObserver loop') ||
        event.message?.includes('Script error.')
      ) {
        return;
      }

      this.addError({
        message: event.message || 'Unknown runtime error',
        stack: event.error?.stack,
        source: 'window_error',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });

    // 2. Capture unhandled promise rejections (e.g. failed fetch, async crashes)
    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      let message = 'Unhandled Promise Rejection';
      let stack: string | undefined;

      if (reason instanceof Error) {
        message = reason.message || message;
        stack = reason.stack;
      } else if (typeof reason === 'string') {
        message = reason;
      } else if (reason && typeof reason === 'object') {
        try {
          message = JSON.stringify(reason);
        } catch {
          message = String(reason);
        }
      }

      this.addError({
        message,
        stack,
        source: 'unhandled_rejection',
      });
    });

    // 3. Optional spy on console.error to catch React warnings & framework errors
    const originalConsoleError = console.error;
    console.error = (...args: unknown[]) => {
      originalConsoleError.apply(console, args);

      try {
        const firstArg = args[0];
        let msg = '';
        if (firstArg instanceof Error) {
          msg = firstArg.message;
        } else if (typeof firstArg === 'string') {
          msg = firstArg;
        } else {
          msg = String(firstArg || '');
        }

        // Only capture significant technical errors
        if (
          msg.includes('Error:') ||
          msg.includes('Warning: Each child in a list') ||
          msg.includes('Cannot update a component') ||
          msg.includes('Rendered fewer hooks') ||
          msg.includes('Maximum update depth')
        ) {
          this.addError({
            message: msg,
            stack: args.find((a) => a instanceof Error)?.stack,
            source: 'console_error',
          });
        }
      } catch {
        // Prevent telemetry from throwing
      }
    };
  }

  public reportReactError(error: Error, errorInfo?: { componentStack?: string | null }): CapturedError {
    return this.addError({
      message: error.message || 'React Component Crash',
      stack: error.stack,
      componentStack: errorInfo?.componentStack || undefined,
      source: 'react_boundary',
    });
  }

  private addError(payload: Omit<CapturedError, 'id' | 'timestamp'>): CapturedError {
    const errorObj: CapturedError = {
      id: 'err_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      ...payload,
    };

    // Avoid duplicate error spam (same message within 2 seconds)
    const recent = this.errors[0];
    if (recent && recent.message === errorObj.message && (Date.now() - parseInt(recent.id.split('_')[1])) < 2000) {
      return recent;
    }

    this.errors = [errorObj, ...this.errors.slice(0, 19)]; // Keep latest 20
    this.notify();
    return errorObj;
  }

  public getErrors(): CapturedError[] {
    return this.errors;
  }

  public getLatestError(): CapturedError | null {
    return this.errors[0] || null;
  }

  public getErrorCount(): number {
    return this.errors.length;
  }

  public clearErrors(): void {
    this.errors = [];
    this.notify();
  }

  public subscribe(listener: ErrorListener): () => void {
    this.listeners.add(listener);
    listener(this.errors);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((listener) => {
      try {
        listener(this.errors);
      } catch (err) {
        console.warn('Error in telemetry listener:', err);
      }
    });
  }
}

export const errorTelemetry = new ErrorTelemetryService();

// Auto-initialize when running in browser
if (typeof window !== 'undefined') {
  errorTelemetry.init();
}
