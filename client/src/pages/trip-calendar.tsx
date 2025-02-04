import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { CalendarView } from "@/components/calendar-view";
import { Loader2, ArrowLeft } from "lucide-react";
import type { Trip } from "@db/schema";
import { format } from "date-fns";

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
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <Button
            variant="ghost"
            onClick={() => setLocation(`/trips/${trip.id}`)}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Trip Details
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{trip.title} Calendar</h1>
            <p className="text-muted-foreground mt-1">
              {format(new Date(trip.startDate), "MMM d, yyyy")} -{" "}
              {format(new Date(trip.endDate), "MMM d, yyyy")}
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          <CalendarView trips={[trip]} />
        </div>
      </main>
    </div>
  );
}
