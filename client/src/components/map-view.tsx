import { useLoadScript, GoogleMap, MarkerF } from "@react-google-maps/api";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { CATEGORY_ICONS, PlaceCategory } from "./pinned-places";

// Libraries for Google Maps
const libraries: ("places")[] = ["places"];

const mapContainerStyle = {
  width: "100%",
  height: "600px", // Increased from 400px to make it more square-like
  position: "relative" as const,
};

const defaultOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  scrollwheel: true,
  clickableIcons: true, // Enable clicking on POIs
};

interface Coordinates {
  lat: number;
  lng: number;
}

interface PinnedPlace {
  id: number;
  name: string;
  address: string;
  category: PlaceCategory;
  coordinates: Coordinates;
  placeId?: string;
  tripId: number;
  destinationId?: number;
  phone?: string;
  website?: string;
  rating?: number;
  openingHours?: string[];
  photos?: string[];
}

interface PlaceDetails {
  name: string;
  formatted_address: string;
  formatted_phone_number?: string;
  rating?: number;
  opening_hours?: {
    weekday_text: string[];
    isOpen: () => boolean;
  };
  website?: string;
  photos?: google.maps.places.PlacePhoto[];
}

interface MapViewProps {
  location: string;
  tripId: number;
  pinnedPlaces?: PinnedPlace[] | { places: PinnedPlace[] };
  onPinClick?: (place: PinnedPlace, details?: PlaceDetails) => void;
  className?: string;
}

export function MapView({ location, tripId, pinnedPlaces = [], onPinClick, className }: MapViewProps) {
  const [coordinates, setCoordinates] = useState<Coordinates>({
    lat: 37.7749,
    lng: -122.4194,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const placeDetailsRef = useRef<HTMLElement | null>(null);

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries,
    version: "beta" // Use beta version for Places UI components
  });

  // Fetch all pinned places for the trip if not provided
  const { data: fetchedPinnedPlaces } = useQuery({
    queryKey: [`/api/trips/${tripId}/pinned-places`],
    queryFn: async () => {
      if (Array.isArray(pinnedPlaces) || 'places' in pinnedPlaces) return null;
      const res = await fetch(`/api/trips/${tripId}/pinned-places`);
      if (!res.ok) throw new Error("Failed to fetch pinned places");
      return res.json();
    },
    enabled: tripId > 0 && !Array.isArray(pinnedPlaces) && !('places' in pinnedPlaces),
  });

  // Combine provided and fetched pinned places
  const allPinnedPlaces = useMemo(() => {
    if (Array.isArray(pinnedPlaces)) return pinnedPlaces;
    if ('places' in pinnedPlaces) return pinnedPlaces.places;
    return fetchedPinnedPlaces?.places || [];
  }, [pinnedPlaces, fetchedPinnedPlaces]);

  // Initialize map and place details
  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;

    // Create a container for place details
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '400px';
    container.style.maxHeight = '100%';
    container.style.margin = '10px';
    container.style.zIndex = '1';
    container.style.display = 'none';
    map.getDiv().appendChild(container);

    // Create place details element
    const placeDetailsElement = document.createElement('gmp-place-details') as HTMLElement & {
      configureFromPlaceId?: (placeId: string) => Promise<void>;
    };

    // Configure the place details element
    placeDetailsElement.setAttribute('full', '');
    container.appendChild(placeDetailsElement);

    placeDetailsRef.current = placeDetailsElement;
  }, []);

  // Handle map click events
  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    const event = e as unknown as { placeId?: string; stop?: () => void };

    if (event.stop) {
      event.stop();
    }

    if (!placeDetailsRef.current || !event.placeId) {
      if (placeDetailsRef.current?.parentElement) {
        placeDetailsRef.current.parentElement.style.display = 'none';
      }
      return;
    }

    const placeDetails = placeDetailsRef.current as HTMLElement & {
      configureFromPlaceId?: (placeId: string) => Promise<void>;
    };

    if (placeDetails.configureFromPlaceId) {
      placeDetails.configureFromPlaceId(event.placeId)
        .then(() => {
          if (placeDetails.parentElement) {
            placeDetails.parentElement.style.display = 'block';
          }
        })
        .catch((error) => {
          console.error('Error showing place details:', error);
        });
    }
  }, []);

  useEffect(() => {
    if (mapRef.current) {
      google.maps.event.clearListeners(mapRef.current, 'click');
      mapRef.current.addListener('click', handleMapClick);
    }
  }, [handleMapClick]);

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
    <Card className={cn("overflow-hidden", className)}>
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        zoom={13}
        center={coordinates}
        options={defaultOptions}
        onLoad={onMapLoad}
      >
        {/* Main location marker */}
        <MarkerF
          position={coordinates}
          icon={{
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: "#1E88E5",
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: "#FFFFFF",
          }}
        />

        {/* Render all pinned places */}
        {allPinnedPlaces.map((place: PinnedPlace) => (
          <MarkerF
            key={place.id}
            position={place.coordinates}
            title={place.name}
            onClick={() => {
              if (placeDetailsRef.current && place.placeId) {
                const placeDetails = placeDetailsRef.current as HTMLElement & {
                  configureFromPlaceId?: (placeId: string) => Promise<void>;
                };

                if (placeDetails.configureFromPlaceId) {
                  placeDetails.configureFromPlaceId(place.placeId)
                    .then(() => {
                      if (placeDetails.parentElement) {
                        placeDetails.parentElement.style.display = 'block';
                      }
                    })
                    .catch((error) => {
                      console.error('Error showing place details:', error);
                    });
                }
              }
              onPinClick?.(place);
            }}
          />
        ))}
      </GoogleMap>
    </Card>
  );
}