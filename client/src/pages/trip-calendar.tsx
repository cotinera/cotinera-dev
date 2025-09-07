import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { DayView } from "@/components/calendar/day-view";
import { CalendarSummary } from "@/components/calendar/calendar-summary";
import { GoogleCalendarSync } from "@/components/calendar/google-calendar-sync";
import { Loader2, ArrowLeft, Calendar } from "lucide-react";
import type { Trip, Activity } from "@db/schema";
import { format } from "date-fns";
import { TripHeaderEdit } from "@/components/trip-header-edit";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useState } from "react";

type ViewMode = "edit" | "summary";

export default function TripCalendar() {
  const [, params] = useRoute("/trips/:id/calendar");
  const tripId = params ? parseInt(params.id) : null;
  const [, setLocation] = useLocation();
  const [viewMode, setViewMode] = useState<ViewMode>("edit");

  const { data: trip, isLoading: tripLoading } = useQuery<Trip>({
    queryKey: ["/api/trips", tripId],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripId}`);
      if (!res.ok) {
        throw new Error("Failed to fetch trip");
      }
      return res.json();
    },
    enabled: !!tripId,
  });

  const { data: activities = [], isLoading: activitiesLoading } = useQuery<Activity[]>({
    queryKey: [`/api/trips/${tripId}/activities`],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripId}/activities`);
      if (!res.ok) throw new Error("Failed to fetch activities");
      return res.json();
    },
    enabled: !!tripId,
  });

  const isLoading = tripLoading || activitiesLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Trip not found</h1>
          <Button onClick={() => setLocation("/")}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="relative overflow-hidden py-12">
          {trip.thumbnail && (
            <div 
              className="absolute inset-0 bg-cover bg-center"
              style={{ 
                backgroundImage: `url(${trip.thumbnail})`,
                filter: 'blur(20px)',
                transform: 'scale(1.2)',
                opacity: '0.9'
              }} 
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-background/30 to-background/70" />
          <div className="container mx-auto px-4 relative z-10">
            <Button 
              variant="ghost" 
              onClick={() => setLocation("/")} 
              className="absolute left-4 top-0"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            

            <TripHeaderEdit 
              trip={trip} 
              onBack={() => setLocation("/")} 
            />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Calendar</h2>
            <ToggleGroup type="single" value={viewMode} onValueChange={(value: ViewMode) => value && setViewMode(value)}>
              <ToggleGroupItem value="edit" size="sm">
                Edit
              </ToggleGroupItem>
              <ToggleGroupItem value="summary" size="sm">
                Summary
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          <p className="text-sm text-muted-foreground">
            All times shown in {Intl.DateTimeFormat().resolvedOptions().timeZone} timezone
          </p>
          
          {import.meta.env.VITE_GOOGLE_CLIENT_ID && (
            <div className="mt-6">
              <GoogleCalendarSync trip={trip} activities={activities} />
            </div>
          )}
        </div>

        <div className="space-y-8">
          {viewMode === "edit" ? (
            <DayView trip={trip} />
          ) : (
            <CalendarSummary trip={trip} activities={activities} />
          )}
        </div>
      </main>
    </div>
  );
}