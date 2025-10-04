import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { LocationSearchBar } from "@/components/location-search-bar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MapPin } from "lucide-react";
import { SiGoogle } from "react-icons/si";
import { useGoogleMapsScript } from "@/lib/google-maps";

export default function LandingPage() {
  const [, setLocation] = useLocation();
  const [searchLocation, setSearchLocation] = useState("");
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [participants, setParticipants] = useState("2");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isLoaded } = useGoogleMapsScript();

  const createTripMutation = useMutation({
    mutationFn: async (tripData: any) => {
      const response = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tripData),
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create trip");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      toast({
        title: "Trip created!",
        description: "Your trip has been created successfully.",
      });
      setLocation(`/trips/${data.id}`);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create trip. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCreateTrip = () => {
    if (!searchLocation || !coordinates) {
      toast({
        title: "Location required",
        description: "Please select a location for your trip.",
        variant: "destructive",
      });
      return;
    }

    createTripMutation.mutate({
      title: searchLocation,
      location: searchLocation,
      coordinates: coordinates,
      startDate: new Date().toISOString().split("T")[0],
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    });
  };

  return (
    <div className="min-h-screen w-full relative overflow-hidden">
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-adventure" />
      
      {/* Top Right Auth Button */}
      <div className="absolute top-6 right-6 z-50">
        <Button
          variant="outline"
          className="bg-white/90 backdrop-blur-md border-2 border-white text-primary hover:bg-white hover:scale-105 shadow-xl transition-all duration-200 cursor-pointer font-semibold"
          onClick={() => window.location.href = "/api/auth/google"}
        >
          <SiGoogle className="mr-2 h-4 w-4" />
          Sign Up / Log In
        </Button>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-3xl mx-auto text-center space-y-8">
          {/* Title */}
          <div className="space-y-4">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white drop-shadow-lg">
              Create your Perfect Trip
            </h1>
          </div>

          {/* Search Input and Participants Selector */}
          <div className="flex flex-col md:flex-row gap-4 items-stretch">
            <div className="flex-1">
              {isLoaded ? (
                <LocationSearchBar
                  value={searchLocation}
                  onChange={(address, coords) => {
                    setSearchLocation(address);
                    if (coords) {
                      setCoordinates(coords);
                    }
                  }}
                  placeholder="Where do you want to go?"
                  className="w-full h-14 text-lg bg-white/20 backdrop-blur-md border-white/30 text-white placeholder:text-white/70 shadow-xl"
                />
              ) : (
                <div className="w-full h-14 flex items-center justify-center bg-white/20 backdrop-blur-md border border-white/30 text-white/70 rounded-md shadow-xl">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Loading map...
                </div>
              )}
            </div>
            <div className="md:w-48">
              <Select value={participants} onValueChange={setParticipants}>
                <SelectTrigger className="h-14 text-lg bg-white/20 backdrop-blur-md border-white/30 text-white shadow-xl">
                  <SelectValue placeholder="Participants" />
                </SelectTrigger>
                <SelectContent className="bg-white/90 backdrop-blur-md border-white/30">
                  <SelectItem value="1">1 Person</SelectItem>
                  <SelectItem value="2">2 People</SelectItem>
                  <SelectItem value="3">3 People</SelectItem>
                  <SelectItem value="4">4 People</SelectItem>
                  <SelectItem value="5">5 People</SelectItem>
                  <SelectItem value="6">6 People</SelectItem>
                  <SelectItem value="7">7 People</SelectItem>
                  <SelectItem value="8">8 People</SelectItem>
                  <SelectItem value="9">9 People</SelectItem>
                  <SelectItem value="10">10+ People</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Create Trip Button */}
          <div>
            <Button
              size="lg"
              className="h-14 px-12 text-lg font-semibold bg-white/90 backdrop-blur-md border-2 border-white text-primary hover:bg-white hover:scale-105 shadow-2xl transition-all duration-200 cursor-pointer"
              onClick={handleCreateTrip}
              disabled={createTripMutation.isPending}
            >
              {createTripMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Creating Trip...
                </>
              ) : (
                <>
                  <MapPin className="mr-2 h-5 w-5" />
                  Create Trip
                </>
              )}
            </Button>
          </div>

          {/* Feature Highlights */}
          <div className="pt-8 grid grid-cols-1 md:grid-cols-3 gap-6 text-white">
            <div className="space-y-2">
              <div className="text-3xl">🗺️</div>
              <h3 className="font-semibold text-lg">Interactive Maps</h3>
              <p className="text-white/80 text-sm">Explore and pin your favorite places</p>
            </div>
            <div className="space-y-2">
              <div className="text-3xl">👥</div>
              <h3 className="font-semibold text-lg">Collaborate</h3>
              <p className="text-white/80 text-sm">Plan together with friends and family</p>
            </div>
            <div className="space-y-2">
              <div className="text-3xl">📅</div>
              <h3 className="font-semibold text-lg">Smart Calendar</h3>
              <p className="text-white/80 text-sm">Organize activities and schedules</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
