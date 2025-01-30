import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import AuthPage from "@/pages/auth-page";
import SharedTrip from "@/pages/shared-trip";
import { useUser } from "@/hooks/use-user";
import { Loader2 } from "lucide-react";

function Router() {
  const { user, isLoading } = useUser();
  const [, setLocation] = useLocation();

  // Handle loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  // Allow access to shared trips without authentication
  if (window.location.pathname.startsWith("/share/")) {
    return (
      <Switch>
        <Route path="/share/:token" component={SharedTrip} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  // Redirect to dashboard if already logged in and trying to access auth page
  if (user && window.location.pathname === "/auth") {
    setLocation("/");
    return null;
  }

  // Show auth page if not logged in
  if (!user) {
    return <AuthPage />;
  }

  // Protected routes
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;