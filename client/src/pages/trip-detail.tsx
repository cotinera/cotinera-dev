import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { FlightBookings } from "@/components/flight-bookings";
import { Checklist } from "@/components/checklist";
import { CalendarView } from "@/components/calendar-view";
import { MapView } from "@/components/map-view";
import { ChatMessages } from "@/components/chat-messages";
import { Loader2, ArrowLeft, Calendar, MapPin, Users } from "lucide-react";
import { ViewToggle } from "@/components/view-toggle";
import type { Trip } from "@db/schema";
import { format } from "date-fns";

export default function TripDetail() {
  const [, params] = useRoute("/trips/:id");
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

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Error loading trip</h1>
          <p className="text-muted-foreground mb-4">{(error as Error).message}</p>
          <Button onClick={() => setLocation("/")}>Back to Dashboard</Button>
        </div>
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
      <header className="relative bg-gradient-to-r from-primary/10 to-primary/5 border-b">
        <div className="container mx-auto px-4 py-8">
          <Button variant="ghost" onClick={() => setLocation("/")} className="absolute left-4 top-8">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>

          <div className="flex flex-col items-center gap-4">
            <ViewToggle tripId={trip.id} />

            <div>
              <h1 className="text-3xl font-bold text-center">{trip.title}</h1>
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
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-8 md:grid-cols-[2fr,1fr]">
          <div className="space-y-8">
            <section>
              <h2 className="text-xl font-semibold mb-4">Location</h2>
              <MapView location={trip.location} />
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">Flight Bookings</h2>
              <FlightBookings tripId={trip.id} />
            </section>
          </div>

          <div className="space-y-8">
            <section>
              <h2 className="text-xl font-semibold mb-4">Group Chat</h2>
              <ChatMessages tripId={trip.id} />
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">Checklist</h2>
              <Checklist tripId={trip.id} />
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}