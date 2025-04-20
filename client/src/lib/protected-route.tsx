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
  const isDevelopmentBypass = localStorage.getItem("dev_bypass_auth") === "true";

  if (isLoading && !isDevelopmentBypass) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  // Allow access if user is authenticated or if development bypass is active
  if (!user && !isDevelopmentBypass) {
    return (
      <Route path={path}>
        {() => {
          window.location.href = "/auth";
          return null;
        }}
      </Route>
    );
  }
  
  // If no user but development bypass is active, set local storage flag
  if (!user && isDevelopmentBypass) {
    localStorage.setItem("dev_bypass_auth", "true");
  }

  // If using development bypass, wrap the component with a warning banner
  if (isDevelopmentBypass) {
    return (
      <Route path={path}>
        {() => (
          <>
            <div className="bg-yellow-500 text-black px-4 py-1 text-sm text-center">
              ⚠️ Development Mode: Authentication Bypassed
            </div>
            <Component />
          </>
        )}
      </Route>
    );
  }

  // Normal authenticated render
  return <Route path={path} component={Component} />;
}