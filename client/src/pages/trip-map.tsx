import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, MapPin, Navigation } from "lucide-react";
import type { Trip } from "@db/schema";
import { TripHeaderEdit } from "@/components/trip-header-edit";
import { MapView } from "@/components/map-view";
import { TripIdeasAndPlaces } from "@/components/trip-ideas-and-places";
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
  
  const { data: participantsData } = useQuery({
    queryKey: [`/api/trips/${tripId}/participants`],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripId}/participants`);
      if (!res.ok) throw new Error("Failed to fetch participants");
      return res.json();
    },
    enabled: !!tripId,
  });

  const handlePinClick = (place: PinnedPlace) => {
    setSelectedPlace(place);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-adventure">
        <div className="text-center text-white">
          <MapPin className="h-16 w-16 mx-auto mb-4 animate-pulse drop-shadow-lg" />
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 drop-shadow-lg" />
          <p className="text-lg font-medium drop-shadow-md">Loading your map...</p>
        </div>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-sunset">
        <div className="text-center text-white max-w-md mx-4">
          <div className="bg-white/10 backdrop-blur rounded-lg p-8 shadow-hero">
            <MapPin className="h-16 w-16 mx-auto mb-4 drop-shadow-lg" />
            <h1 className="text-2xl font-bold mb-4">
              {error ? "Unable to Load Map" : "Trip Not Found"}
            </h1>
            <p className="text-white/90 mb-6">
              {error ? "There was an issue loading the map data." : "The trip you're looking for doesn't exist or you don't have access to it."}
            </p>
            <Button 
              onClick={() => setLocation("/")}
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
                filter: "blur(20px)",
                transform: "scale(1.2)",
                opacity: "0.7",
              }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-adventure opacity-80" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/40" />
          
          <div className="container mx-auto px-6 relative z-10">
            <Button
              variant="ghost"
              onClick={() => setLocation("/")}
              className="absolute left-6 top-4 text-white hover:bg-white/20 border border-white/20 backdrop-blur-sm transition-all duration-300"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            
            <div className="pt-16">
              <TripHeaderEdit trip={trip} onBack={() => setLocation("/")} />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12">
        <div className="space-y-8">
          {/* Map Section */}
          <Card className="bg-card/50 border-border/50 shadow-soft backdrop-blur-sm overflow-hidden">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-adventure text-white shadow-soft">
                  <Navigation className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-2xl bg-gradient-adventure bg-clip-text text-transparent">
                    Interactive Map
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Explore locations and add pins to your trip
                  </p>
                </div>
              </div>
              {selectedPlace && (
                <Badge className="bg-gradient-ocean text-white border-0 w-fit">
                  Selected: {selectedPlace.name}
                </Badge>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-[600px] relative">
                <MapView 
                  location={{ lat: trip.coordinates?.lat || 0, lng: trip.coordinates?.lng || 0 }}
                  tripId={trip.id.toString()}
                  pinnedPlaces={pinnedPlacesData?.places || []}
                  selectedPlace={selectedPlace}
                  onPinClick={handlePinClick}
                  className="w-full h-full rounded-b-lg"
                />
              </div>
            </CardContent>
          </Card>

          {/* Ideas and Places Section */}
          <Card className="bg-card/50 border-border/50 shadow-soft backdrop-blur-sm">
            <CardContent className="p-6">
              <TripIdeasAndPlaces
                tripId={trip.id}
                participants={participantsData || []}
                tripCoordinates={trip.coordinates || undefined}
              />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}