import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { DayView } from "@/components/calendar/day-view";
import { Checklist } from "@/components/checklist";
import { TripDestinations } from "@/components/trip-destinations";
import { Loader2, ArrowLeft, MapPin } from "lucide-react";
import type { Trip, Destination } from "@db/schema";

export default function DestinationDetail() {
  const [, params] = useRoute("/trips/:tripId/destinations/:destinationId");
  const tripId = params ? parseInt(params.tripId) : null;
  const destinationId = params ? parseInt(params.destinationId) : null;
  const [, setLocation] = useLocation();

  const { data: trip, isLoading: tripLoading } = useQuery<Trip>({
    queryKey: ["/api/trips", tripId],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripId}`);
      if (!res.ok) throw new Error("Failed to fetch trip");
      return res.json();
    },
    enabled: !!tripId,
  });

  const { data: destination, isLoading: destinationLoading } = useQuery<Destination>({
    queryKey: ["/api/trips", tripId, "destinations", destinationId],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripId}/destinations/${destinationId}`);
      if (!res.ok) throw new Error("Failed to fetch destination");
      return res.json();
    },
    enabled: !!tripId && !!destinationId,
  });

  if (tripLoading || destinationLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!trip || !destination) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">
            Destination not found
          </h1>
          <Button onClick={() => setLocation(`/trips/${tripId}`)}>
            Back to Trip
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-6">
          <Button 
            variant="ghost" 
            onClick={() => setLocation(`/trips/${tripId}`)}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Trip
          </Button>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold">{destination.name}</h1>
              <div className="flex items-center gap-2 text-muted-foreground mt-1">
                <MapPin className="h-4 w-4" />
                <span>Location in trip: Stop {destination.order + 1}</span>
              </div>
            </div>
            <div className="z-[1000]">
              {tripId && <TripDestinations tripId={tripId} />}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6">
          <div>
            <DayView trip={trip} />
          </div>
          
          <div>
            {tripId && <Checklist tripId={tripId} />}
          </div>
        </div>
      </main>
    </div>
  );
}
