import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Checklist } from "@/components/checklist";
import { CalendarView } from "@/components/calendar-view";
import { MapView } from "@/components/map-view";
import { ChatMessages } from "@/components/chat-messages";
import { Loader2, ArrowLeft } from "lucide-react";
import { ViewToggle } from "@/components/view-toggle";
import type { Trip } from "@db/schema";
import { TripHeaderEdit } from "@/components/trip-header-edit";
import { TripParticipantDetails } from "@/components/trip-participant-details";
import { TripDestinations } from "@/components/trip-destinations";
import { TripTimeline } from "@/components/trip-timeline";

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
      <header className="border-b">
        <div className="relative overflow-hidden py-12">
          {trip.thumbnail && (
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `url(${trip.thumbnail})`,
                filter: "blur(20px)",
                transform: "scale(1.2)",
                opacity: "0.9",
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

            <div className="absolute right-4 top-0">
              <TripDestinations tripId={trip.id} />
            </div>

            <TripHeaderEdit trip={trip} onBack={() => setLocation("/")} />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Trip Timeline Section */}
          <section>
            <TripTimeline tripId={trip.id} />
          </section>

          <div className="grid gap-8 md:grid-cols-[2fr,1fr]">
            <div className="space-y-8">
              <section>
                <h2 className="text-xl font-semibold mb-4">Location Overview</h2>
                <MapView location={trip.location || ""} />
              </section>

              <section>
                <TripParticipantDetails tripId={trip.id} />
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
        </div>
      </main>
    </div>
  );
}