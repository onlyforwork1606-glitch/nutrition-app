import { Component, type ReactNode } from "react";
import { GlassCard, Button } from "@/components/ui/primitives";

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center p-6">
          <GlassCard className="max-w-sm text-center">
            <h2 className="text-lg font-semibold mb-2 gradient-text">
              Something went wrong
            </h2>
            <p className="text-sm text-white/60 mb-4">
              {this.state.error.message}
            </p>
            <Button onClick={() => location.reload()}>Reload</Button>
          </GlassCard>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
