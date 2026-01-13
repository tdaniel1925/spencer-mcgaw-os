"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import logger from "@/lib/logger";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Fallback UI to render when an error occurs */
  fallback?: ReactNode;
  /** Widget/component name for logging */
  name?: string;
  /** Callback when an error occurs */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Whether to show a compact version suitable for widgets */
  compact?: boolean;
  /** Additional className for the error container */
  className?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary component that catches JavaScript errors in child components
 * and displays a fallback UI instead of crashing the whole app.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { name, onError } = this.props;

    logger.error(`[ErrorBoundary] Component error${name ? ` in ${name}` : ""}`, {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });

    onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { compact, className, name } = this.props;

      if (compact) {
        return (
          <div className={cn("flex flex-col items-center justify-center p-4 text-center", className)}>
            <AlertTriangle className="h-8 w-8 text-amber-500 mb-2" />
            <p className="text-sm text-muted-foreground mb-2">
              {name ? `${name} failed to load` : "Something went wrong"}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={this.handleRetry}
              className="h-7 text-xs"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          </div>
        );
      }

      return (
        <Card className={cn("border-amber-200", className)}>
          <CardContent className="flex flex-col items-center justify-center p-6 text-center">
            <AlertTriangle className="h-10 w-10 text-amber-500 mb-3" />
            <h3 className="font-medium text-foreground mb-1">
              {name ? `${name} encountered an error` : "Something went wrong"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {this.state.error?.message || "An unexpected error occurred"}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={this.handleRetry}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

/**
 * Higher-order component to wrap a component with an error boundary
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, "children">
) {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || "Component";

  const WithErrorBoundary = (props: P) => (
    <ErrorBoundary name={displayName} {...errorBoundaryProps}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  WithErrorBoundary.displayName = `withErrorBoundary(${displayName})`;

  return WithErrorBoundary;
}

export default ErrorBoundary;
