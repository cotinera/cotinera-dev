import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft } from "lucide-react";
import type { Trip } from "@db/schema";
import { TripHeaderEdit } from "@/components/trip-header-edit";
import { MapView } from "@/components/map-view";
import { PinnedPlaces } from "@/components/pinned-places";
import { useState } from "react";
import type { PinnedPlace } from "@/lib/google-maps";

export default function TripMap() {
  const [, params] = useRoute("/trips/:id/map");
  const tripId = params ? parseInt(params.id) : null;
  const [, setLocation] = useLocation();
  const [selectedPlace, setSelectedPlace] = useState<PinnedPlace | null>(null);

  const { data: trip, isLoading, error } = useQuery<Trip>({
    queryKey: ["/api/trips", tripId],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripId}`);
      if (!res.ok) throw new Error("Failed to fetch trip");
      return res.json();
    },
    enabled: !!tripId,
  });

  const { data: pinnedPlacesData } = useQuery({
    queryKey: [`/api/trips/${tripId}/pinned-places`],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripId}/pinned-places`);
      if (!res.ok) throw new Error("Failed to fetch pinned places");
      return res.json();
    },
    enabled: !!tripId,
  });

  const handlePinClick = (place: PinnedPlace) => {
    setSelectedPlace(place);
  };

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

            <TripHeaderEdit trip={trip} onBack={() => setLocation("/")} />
          </div>
        </div>
      </header>

      <main className="flex h-[calc(100vh-200px)]">
        <div className="w-1/4 min-w-[300px] border-r">
          <PinnedPlaces
            tripId={trip.id}
            defaultLocation={trip.location || ""}
            showMap={false}
            onPinClick={handlePinClick}
          />
        </div>

        <div className="flex-1">
          <MapView 
            location={{ lat: trip.latitude || 0, lng: trip.longitude || 0 }}
            tripId={trip.id.toString()}
            pinnedPlaces={pinnedPlacesData?.places || []}
            selectedPlace={selectedPlace}
            onPinClick={handlePinClick}
            className="h-full"
          />
        </div>
      </main>
    </div>
  );
}