import { useLoadScript, GoogleMap, MarkerF, StreetViewPanorama } from "@react-google-maps/api";
import { Loader2, Map, MapPinOff } from "lucide-react"; 
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

const mapContainerStyle = {
  width: "100%",
  height: "400px",
};

const defaultOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  scrollwheel: true,
};

// Define libraries array outside component to prevent recreation
const libraries: ("places" | "streetView")[] = ["places", "streetView"];

interface MapViewProps {
  location: string;
}

interface Coordinates {
  lat: number;
  lng: number;
}

export function MapView({ location }: MapViewProps) {
  const [coordinates, setCoordinates] = useState<Coordinates>({
    lat: 37.7749,
    lng: -122.4194, // Default to San Francisco
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showStreetView, setShowStreetView] = useState(false);
  const [streetViewAvailable, setStreetViewAvailable] = useState(true);

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries,
  });

  useEffect(() => {
    async function geocodeLocation() {
      try {
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
            location
          )}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`
        );

        if (!response.ok) {
          throw new Error("Failed to geocode location");
        }

        const data = await response.json();

        if (data.status === "OK" && data.results?.[0]?.geometry?.location) {
          const { lat, lng } = data.results[0].geometry.location;
          setCoordinates({ lat, lng });

          // Check if Street View is available at this location
          if (window.google && window.google.maps) {
            const streetViewService = new window.google.maps.StreetViewService();
            streetViewService.getPanorama(
              {
                location: { lat, lng },
                radius: 50, // Search radius in meters
              },
              (data, status) => {
                setStreetViewAvailable(status === "OK");
              }
            );
          }
        } else {
          console.warn("Location not found:", data.status);
          // Keep default coordinates if geocoding fails
        }
      } catch (err) {
        console.error("Geocoding error:", err);
        setError("Failed to load location");
      } finally {
        setIsLoading(false);
      }
    }

    if (location && isLoaded) {
      geocodeLocation();
    }
  }, [location, isLoaded]);

  if (loadError) {
    return (
      <Card className="p-4 text-center">
        <p className="text-destructive">Error loading map</p>
      </Card>
    );
  }

  if (!isLoaded || isLoading) {
    return (
      <Card className="p-4 flex items-center justify-center h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-4 text-center">
        <p className="text-destructive">{error}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant={!showStreetView ? "default" : "outline"}
            size="sm"
            onClick={() => setShowStreetView(false)}
          >
            <Map className="h-4 w-4 mr-2" />
            Map View
          </Button>
          <Button
            variant={showStreetView ? "default" : "outline"}
            size="sm"
            onClick={() => setShowStreetView(true)}
            disabled={!streetViewAvailable}
          >
            <MapPinOff className="h-4 w-4 mr-2" />
            Street View
          </Button>
        </div>
        {!streetViewAvailable && (
          <Badge variant="secondary">Street View not available</Badge>
        )}
      </div>

      <Card className="overflow-hidden">
        {showStreetView && streetViewAvailable ? (
          <div style={mapContainerStyle}>
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              zoom={13}
              center={coordinates}
              options={defaultOptions}
            >
              <StreetViewPanorama
                options={{
                  position: coordinates,
                  visible: true,
                  enableCloseButton: false,
                  addressControl: false,
                }}
              />
            </GoogleMap>
          </div>
        ) : (
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            zoom={13}
            center={coordinates}
            options={defaultOptions}
          >
            <MarkerF position={coordinates} />
          </GoogleMap>
        )}
      </Card>
    </div>
  );
}