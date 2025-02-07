import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { DayView } from "@/components/calendar/day-view";
import { Loader2, ArrowLeft, MapPin, Calendar } from "lucide-react";
import type { Trip } from "@db/schema";
import { format } from "date-fns";
import { ViewToggle } from "@/components/view-toggle";

export default function TripCalendar() {
  const [, params] = useRoute("/trips/:id/calendar");
  const tripId = params ? parseInt(params.id) : null;
  const [, setLocation] = useLocation();

  const { data: trip, isLoading, error } = useQuery<Trip>({
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">
            {error ? "Error loading trip" : "Trip not found"}
          </h1>
          <Button onClick={() => setLocation("/")}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="relative overflow-hidden border-b">
        {trip.thumbnail && (
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ 
              backgroundImage: `url(${trip.thumbnail})`,
              filter: 'blur(60px)',
              transform: 'scale(1.1)',
              opacity: '0.8'
            }} 
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-background/70 to-background/50" />
        <div className="container mx-auto px-4 py-8 relative z-10">
          <Button 
            variant="ghost" 
            onClick={() => setLocation("/")} 
            className="absolute left-4 top-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          <div className="text-center">
            <h1 className="text-3xl font-bold mb-2">{trip.title}</h1>
            <div className="flex items-center justify-center gap-2 text-muted-foreground mt-2">
              <MapPin className="h-4 w-4" />
              <span>{trip.location}</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-muted-foreground mt-1">
              <Calendar className="h-4 w-4" />
              <span>
                {format(new Date(trip.startDate), "MMM d, yyyy")} -{" "}
                {format(new Date(trip.endDate), "MMM d, yyyy")}
              </span>
            </div>
            <div className="mt-4">
              <ViewToggle tripId={trip.id} />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          <DayView trip={trip} />
        </div>
      </main>
    </div>
  );
}