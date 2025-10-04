import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { DayView } from "@/components/calendar/day-view";
import { CalendarSummary } from "@/components/calendar/calendar-summary";
import { GoogleCalendarSync } from "@/components/calendar/google-calendar-sync";
import { Loader2, ArrowLeft, Calendar, Clock } from "lucide-react";
import type { Trip, Activity } from "@db/schema";
import { format } from "date-fns";
import { TripHeaderEdit } from "@/components/trip-header-edit";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
      <div className="flex items-center justify-center min-h-screen bg-gradient-adventure">
        <div className="text-center text-white">
          <Calendar className="h-16 w-16 mx-auto mb-4 animate-pulse drop-shadow-lg" />
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 drop-shadow-lg" />
          <p className="text-lg font-medium drop-shadow-md">Loading your calendar...</p>
        </div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-sunset">
        <div className="text-center text-white max-w-md mx-4">
          <div className="bg-white/10 backdrop-blur rounded-lg p-8 shadow-hero">
            <Calendar className="h-16 w-16 mx-auto mb-4 drop-shadow-lg" />
            <h1 className="text-2xl font-bold mb-4">Trip Not Found</h1>
            <p className="text-white/90 mb-6">The calendar you're looking for doesn't exist or you don't have access to it.</p>
            <Button 
              onClick={() => setLocation("/dashboard")}
              variant="secondary"
              className="bg-white text-primary hover:bg-white/90"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 shadow-soft">
        <div className="relative overflow-hidden py-12">
          {trip.thumbnail && (
            <div 
              className="absolute inset-0 bg-cover bg-center"
              style={{ 
                backgroundImage: `url(${trip.thumbnail})`,
                filter: 'blur(20px)',
                transform: 'scale(1.2)',
                opacity: '0.7'
              }} 
            />
          )}
          <div className="absolute inset-0 bg-gradient-adventure opacity-80" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/40" />
          
          <div className="container mx-auto px-6 relative z-10">
            <Button 
              variant="ghost" 
              onClick={() => setLocation("/dashboard")} 
              className="absolute left-6 top-4 text-white hover:bg-white/20 border border-white/20 backdrop-blur-sm transition-all duration-300"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            
            <div className="pt-16">
              <TripHeaderEdit 
                trip={trip} 
                onBack={() => setLocation("/dashboard")} 
              />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12">
        <div className="space-y-8">
          {/* Calendar Header Card */}
          <Card className="bg-card/50 border-border/50 shadow-soft backdrop-blur-sm">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gradient-adventure text-white shadow-soft">
                    <Calendar className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl bg-gradient-adventure bg-clip-text text-transparent">
                      Trip Calendar
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        All times shown in {Intl.DateTimeFormat().resolvedOptions().timeZone} timezone
                      </p>
                    </div>
                  </div>
                </div>
                
                <ToggleGroup 
                  type="single" 
                  value={viewMode} 
                  onValueChange={(value: ViewMode) => value && setViewMode(value)}
                  className="border border-border/50 rounded-lg p-1 bg-background/50"
                >
                  <ToggleGroupItem 
                    value="edit" 
                    size="sm"
                    className="data-[state=on]:bg-gradient-adventure data-[state=on]:text-white transition-all duration-300"
                  >
                    Edit Mode
                  </ToggleGroupItem>
                  <ToggleGroupItem 
                    value="summary" 
                    size="sm"
                    className="data-[state=on]:bg-gradient-adventure data-[state=on]:text-white transition-all duration-300"
                  >
                    Summary View
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            </CardHeader>
            
            {import.meta.env.VITE_GOOGLE_CLIENT_ID && (
              <CardContent className="pt-0">
                <div className="p-4 bg-primary/5 rounded-lg border border-primary/10">
                  <GoogleCalendarSync trip={trip} activities={activities} />
                </div>
              </CardContent>
            )}
          </Card>

          {/* Calendar Content Card */}
          <Card className="bg-card/50 border-border/50 shadow-soft backdrop-blur-sm overflow-hidden">
            <CardContent className="p-0">
              <div className="p-6">
                {viewMode === "edit" ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-4">
                      <Badge className="bg-gradient-adventure text-white border-0">
                        Edit Mode
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        Click and drag to create new events
                      </span>
                    </div>
                    <DayView trip={trip} />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-4">
                      <Badge className="bg-gradient-ocean text-white border-0">
                        Summary View
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        Overview of all scheduled activities
                      </span>
                    </div>
                    <CalendarSummary trip={trip} activities={activities} />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}