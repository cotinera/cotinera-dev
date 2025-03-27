import { Switch, Route } from "wouter";
import { queryClient } from "@/lib";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui";
import { AuthProvider, TutorialProvider } from "@/hooks";
// Import ThemeProvider and ThemeToggle directly to avoid module resolution issues
import { ThemeProvider } from "@/components/shared/theme-provider";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import {
  NotFound,
  Dashboard,
  SharedTrip,
  TripDetail,
  TripCalendar,
  TripMap,
  DestinationDetail,
  AuthPage,
  TravelPreferencesPage
} from "@/pages";
import { ProtectedRoute } from "@/lib";

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <Route path="/share/:token" component={SharedTrip} />
      <ProtectedRoute path="/" component={Dashboard} />
      <ProtectedRoute path="/trips/:id" component={TripDetail} />
      <ProtectedRoute path="/trips/:id/calendar" component={TripCalendar} />
      <ProtectedRoute path="/trips/:id/map" component={TripMap} />
      <ProtectedRoute path="/trips/:tripId/destinations/:destinationId" component={DestinationDetail} />
      <ProtectedRoute path="/preferences" component={TravelPreferencesPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="ui-theme">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TutorialProvider>
            <Router />
            <ThemeToggle />
            <Toaster />
          </TutorialProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;