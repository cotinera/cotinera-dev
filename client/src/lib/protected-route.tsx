import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Route, useLocation } from "wouter";

export function ProtectedRoute({
  path,
  component: Component,
}: {
  path: string;
  component: () => React.JSX.Element;
}) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  if (!user) {
    // Instead of directly using setLocation in the render,
    // we'll return a route that handles the redirect
    return (
      <Route path={path}>
        {() => {
          // Use window.location for a full page redirect to ensure clean state
          window.location.href = "/auth";
          return null;
        }}
      </Route>
    );
  }

  // If authenticated, render the protected component
  return <Route path={path} component={Component} />;
}