import { Switch, Route } from "wouter";
import { queryClient } from "@/lib";
import { QueryClientProvider } from "@tanstack/react-query";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, TutorialProvider } from "@/hooks";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import {
  NotFound,
  Dashboard,
  SharedTrip,
  TripDetail,
  TripCalendar,
  TripMap,
  TripSpending,
  DestinationDetail,
  AuthPage,
  TravelPreferencesPage
} from "@/pages";
import { NotificationRespondPage } from "@/pages/notification-respond";
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
      <ProtectedRoute path="/trips/:id/spending" component={TripSpending} />
      <ProtectedRoute path="/trips/:tripId/destinations/:destinationId" component={DestinationDetail} />
      <ProtectedRoute path="/preferences" component={TravelPreferencesPage} />
      <ProtectedRoute path="/notifications/:notificationId/respond" component={NotificationRespondPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ""}>
      <ThemeProvider defaultTheme="light" storageKey="trip-coordinator-theme">
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <AuthProvider>
              <TutorialProvider>
                <div className="flex flex-col min-h-screen bg-background">
                  <main className="flex-1">
                    <Router />
                  </main>
                  <ThemeToggle />
                </div>
                <Toaster />
                <Sonner />
              </TutorialProvider>
            </AuthProvider>
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </GoogleOAuthProvider>
  );
}

export default App;