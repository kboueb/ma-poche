import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-screen flex items-center justify-center p-8 bg-surface-0">
          <div className="text-center space-y-4 max-w-sm">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-rose-500/10">
              <AlertTriangle className="w-8 h-8 text-rose-400" />
            </div>
            <h2 className="text-xl font-bold">Oups, une erreur est survenue</h2>
            <p className="text-text-muted text-sm">
              {this.state.error?.message || "Une erreur inattendue a provoqué un plantage."}
            </p>
            <Button onClick={() => window.location.reload()} className="mt-4">
              Recharger la page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
