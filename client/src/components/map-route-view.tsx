import { useCallback, useEffect, useState } from "react";
import { GoogleMap, DirectionsRenderer, useJsApiLoader } from "@react-google-maps/api";
import type { Destination, Trip } from "@db/schema";
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
  trip: Trip;
  destinations: Destination[];
}

export function MapRouteView({ trip, destinations }: MapRouteViewProps) {
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: ["places"],
  });

  const calculateRoute = useCallback(async () => {
    if (!window.google || !trip.coordinates) return;

    const directionsService = new google.maps.DirectionsService();
    const validDestinations = destinations.filter(d => d.coordinates !== null);

    if (validDestinations.length === 0) return;

    try {
      let origin = { 
        lat: trip.coordinates.lat, 
        lng: trip.coordinates.lng 
      };

      const waypoints = validDestinations.slice(0, -1).map(dest => ({
        location: { 
          lat: dest.coordinates!.lat, 
          lng: dest.coordinates!.lng 
        },
        stopover: true,
      }));

      const lastDestination = validDestinations[validDestinations.length - 1];
      const destination = { 
        lat: lastDestination.coordinates!.lat, 
        lng: lastDestination.coordinates!.lng 
      };

      const result = await directionsService.route({
        origin,
        destination,
        waypoints,
        travelMode: google.maps.TravelMode.DRIVING,
      });

      setDirections(result);
    } catch (error) {
      console.error("Error calculating route:", error);
    }
  }, [trip.coordinates, destinations]);

  useEffect(() => {
    if (isLoaded && trip.coordinates) {
      calculateRoute();
    }
  }, [isLoaded, trip.coordinates, calculateRoute]);

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
      center={trip.coordinates || defaultCenter}
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