import { useLoadScript, GoogleMap, MarkerF } from "@react-google-maps/api";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useEffect, useState } from "react";

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
const libraries: ("places")[] = ["places"];

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
    <Card className="overflow-hidden">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        zoom={13}
        center={coordinates}
        options={defaultOptions}
      >
        <MarkerF position={coordinates} />
      </GoogleMap>
    </Card>
  );
}