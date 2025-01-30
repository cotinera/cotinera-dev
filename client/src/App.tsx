import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import SharedTrip from "@/pages/shared-trip";
import TripDetail from "@/pages/trip-detail";

function Router() {
  // For development, directly show dashboard
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/trips/:id" component={TripDetail} />
      <Route path="/share/:token" component={SharedTrip} />
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