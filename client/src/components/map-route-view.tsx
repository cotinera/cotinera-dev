import { useCallback, useEffect, useState } from "react";
import { GoogleMap, DirectionsRenderer, useJsApiLoader } from "@react-google-maps/api";
import type { Destination } from "@db/schema";
import { Loader2 } from "lucide-react";

const mapContainerStyle = {
  width: "100%",
  height: "400px",
  borderRadius: "0.5rem",
};

const defaultCenter = {
  lat: 20.0,
  lng: -97.0,
};

interface MapRouteViewProps {
  destinations: Destination[];
}

export function MapRouteView({ destinations }: MapRouteViewProps) {
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: ["places"],
  });

  const calculateRoute = useCallback(async () => {
    if (!window.google || destinations.length < 2) return;

    const directionsService = new google.maps.DirectionsService();

    try {
      const origin = destinations[0];
      const destination = destinations[destinations.length - 1];
      const waypoints = destinations.slice(1, -1).map(dest => ({
        location: { lat: dest.coordinates.lat, lng: dest.coordinates.lng },
        stopover: true,
      }));

      const result = await directionsService.route({
        origin: { lat: origin.coordinates.lat, lng: origin.coordinates.lng },
        destination: { lat: destination.coordinates.lat, lng: destination.coordinates.lng },
        waypoints,
        travelMode: google.maps.TravelMode.DRIVING,
      });

      setDirections(result);
    } catch (error) {
      console.error("Error calculating route:", error);
    }
  }, [destinations]);

  useEffect(() => {
    if (isLoaded && destinations.length >= 2) {
      calculateRoute();
    }
  }, [isLoaded, destinations, calculateRoute]);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-[400px] bg-muted rounded-lg">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={mapContainerStyle}
      center={destinations[0]?.coordinates || defaultCenter}
      zoom={5}
      options={{
        disableDefaultUI: true,
        zoomControl: true,
        streetViewControl: true,
        mapTypeControl: true,
      }}
    >
      {directions && (
        <DirectionsRenderer
          directions={directions}
          options={{
            suppressMarkers: false,
            polylineOptions: {
              strokeColor: "hsl(var(--primary))",
              strokeWeight: 4,
            },
          }}
        />
      )}
    </GoogleMap>
  );
}
