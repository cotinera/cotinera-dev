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
import TripMap from "@/pages/trip-map";
import DestinationDetail from "@/pages/destination-detail";
import AuthPage from "@/pages/auth-page";
import { TravelPreferencesPage } from "@/pages/travel-preferences";
import { ProtectedRoute } from "./lib/protected-route";
import { SidebarProvider, Sidebar, SidebarContent, SidebarTrigger, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar";
import { Compass, Map, Calendar, Users, Settings } from "lucide-react";

function Navigation() {
  return (
    <Sidebar>
      <SidebarContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Dashboard">
              <a href="/">
                <Compass className="h-4 w-4" />
                <span>Dashboard</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Travel Preferences">
              <a href="/preferences">
                <Settings className="h-4 w-4" />
                <span>Travel Preferences</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
}

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
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SidebarProvider>
          <Navigation />
          <Router />
          <Toaster />
        </SidebarProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;