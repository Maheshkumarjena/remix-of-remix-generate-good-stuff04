import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertOctagon, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught Error Boundary Exception:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center p-6 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive mb-4">
            <AlertOctagon className="size-7" />
          </div>
          <h2 className="font-display text-lg font-semibold text-foreground">Something went wrong</h2>
          <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
            An unexpected error occurred while rendering this component. The system logged the incident.
          </p>
          {this.state.error?.message ? (
            <div className="mt-3 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 font-mono text-xs text-destructive max-w-md truncate">
              {this.state.error.message}
            </div>
          ) : null}
          <div className="mt-6 flex items-center gap-3">
            <Button onClick={this.handleReset} variant="outline" size="sm">
              <RefreshCw className="size-3.5" /> Try again
            </Button>
            <Button onClick={() => (window.location.href = "/")} size="sm">
              Return Home
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
