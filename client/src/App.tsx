import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import SharedTrip from "@/pages/shared-trip";
import TripDetail from "@/pages/trip-detail";
import TripCalendar from "@/pages/trip-calendar";
import DestinationDetail from "@/pages/destination-detail";
import AuthPage from "@/pages/auth-page";
import { ProtectedRoute } from "./lib/protected-route";

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <Route path="/share/:token" component={SharedTrip} />
      <ProtectedRoute path="/" component={Dashboard} />
      <ProtectedRoute path="/trips/:id" component={TripDetail} />
      <ProtectedRoute path="/trips/:id/calendar" component={TripCalendar} />
      <ProtectedRoute path="/trips/:tripId/destinations/:destinationId" component={DestinationDetail} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;