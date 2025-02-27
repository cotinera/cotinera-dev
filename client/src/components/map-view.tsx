import { useLoadScript, GoogleMap, MarkerF } from "@react-google-maps/api";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { CATEGORY_ICONS, PlaceCategory } from "./pinned-places";

const libraries: ("places")[] = ["places"];

const mapContainerStyle = {
  width: "100%",
  height: "400px",
};

const defaultOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  scrollwheel: true,
};

// Default to London if no valid coordinates are provided
const DEFAULT_CENTER = {
  lat: 51.5074,
  lng: -0.1278
};

interface PinnedPlace {
  id: number;
  name: string;
  category: PlaceCategory;
  coordinates: {
    lat: number;
    lng: number;
  };
}

interface MapViewProps {
  location: string;
  tripId: number;
  pinnedPlaces?: PinnedPlace[] | { places: PinnedPlace[] };
  onPinClick?: (place: PinnedPlace) => void;
  className?: string;
}

interface Coordinates {
  lat: number;
  lng: number;
}

// Map of icon paths by category
const ICON_PATHS: Record<PlaceCategory, string> = {
  [PlaceCategory.FOOD]: "M18.06 22.99h1.66c.84 0 1.53-.64 1.63-1.46L23 5.05h-5V1h-1.97v4.05h-4.97l.3 2.34c1.71.47 3.31 1.32 4.27 2.26 1.44 1.42 2.43 2.89 2.43 5.29v8.05zM1 21.99V21h15.03v.99c0 .55-.45 1-1.01 1H2.01c-.56 0-1.01-.45-1.01-1zm15.03-7c0-8-15.03-8-15.03 0h15.03zM1.02 17h15v2h-15z",
  [PlaceCategory.BAR]: "M3 14c0 1.3.84 2.4 2 2.82V20H3v2h6v-2H7v-3.18C8.16 16.4 9 15.3 9 14V6H3v8zm2-6h2v3H5V8zm0 5h2v1H5v-1zm15.5-4.5c0 2.07-1.68 3.75-3.75 3.75s-3.75-1.68-3.75-3.75S14.68 4 16.75 4s3.75 1.68 3.75 3.75z",
  [PlaceCategory.CAFE]: "M18.5 3H6c-1.1 0-2 .9-2 2v5.71c0 3.83 2.95 7.18 6.78 7.29 3.96.12 7.22-3.06 7.22-7v-1h.5c1.93 0 3.5-1.57 3.5-3.5S20.43 3 18.5 3zM16 5v3H6V5h10zm2.5 3H18V5h.5c.83 0 1.5.67 1.5 1.5S19.33 8 18.5 8zM4 19h16v2H4v-2z",
  [PlaceCategory.WINE]: "M6 3v6c0 2.97 2.16 5.43 5 5.91V19H8v2h8v-2h-3v-4.09c2.84-.48 5-2.94 5-5.91V3H6zm10 5H8V5h8v3z",
  [PlaceCategory.SHOPPING]: "M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z",
  [PlaceCategory.GROCERY]: "M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z",
  [PlaceCategory.ARTS]: "M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z",
  [PlaceCategory.LIGHTHOUSE]: "M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z",
  [PlaceCategory.THEATRE]: "M4 21h16v-2H4v2zm0-4h16v-2H4v2zm0-12v2h16V5H4zm0 4h16V7H4v2zm0 4h16v-2H4v2z",
  [PlaceCategory.TOURIST]: "M14 6l-3.75 5 2.85 3.8-1.6 1.2C9.81 13.75 7 10 7 10l-6 8h22L14 6z",
  [PlaceCategory.CASINO]: "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM7.5 18c-.83 0-1.5-.67-1.5-1.5S6.67 15 7.5 15s1.5.67 1.5 1.5S8.33 18 7.5 18zm0-9C6.67 9 6 8.33 6 7.5S6.67 6 7.5 6 9 6.67 9 7.5 8.33 9 7.5 9zm4.5 4.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4.5 4.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm0-9c-.83 0-1.5-.67-1.5-1.5S15.67 6 16.5 6s1.5.67 1.5 1.5S17.33 9 16.5 9z",
  [PlaceCategory.AQUARIUM]: "M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z",
  [PlaceCategory.EVENT_VENUE]: "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z",
  [PlaceCategory.AMUSEMENT_PARK]: "M6 19h12v2H6z",
  [PlaceCategory.HISTORIC]: "M12 2l-5.5 9h11z",
  [PlaceCategory.MUSEUM]: "M22 11V3h-7v3H9V3H2v8h7V8h2v10h4v3h7v-8h-7v3h-2V8h2v3z",
  [PlaceCategory.MOVIE_THEATRE]: "M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z",
  [PlaceCategory.MONUMENT]: "M12 2l-5.5 9h11z",
  [PlaceCategory.MUSIC]: "M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z",
  [PlaceCategory.RELIC]: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"
};

export function MapView({ location, tripId, pinnedPlaces = [], onPinClick, className }: MapViewProps) {
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
    <Card className={cn("overflow-hidden", className)}>
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        zoom={13}
        center={coordinates}
        options={defaultOptions}
      >
        {/* Main location marker */}
        <MarkerF 
          position={coordinates}
          icon={{
            url: `data:image/svg+xml,${encodeURIComponent(`
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10" fill="#000000"/>
                <circle cx="12" cy="12" r="3" fill="#ffffff"/>
              </svg>
            `)}`,
            scaledSize: new google.maps.Size(30, 30),
          }}
        />

        {/* Render all pinned places with category-specific styling */}
        {allPinnedPlaces.map((place: PinnedPlace) => {
          const iconPath = ICON_PATHS[place.category] || ICON_PATHS[PlaceCategory.TOURIST];

          return (
            <MarkerF
              key={place.id}
              position={place.coordinates}
              title={place.name}
              onClick={() => onPinClick?.(place)}
              icon={{
                url: `data:image/svg+xml,${encodeURIComponent(
                  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="hsl(var(--primary))" stroke="white" stroke-width="2">
                    <path d="${iconPath}"/>
                  </svg>`
                )}`,
                scaledSize: new google.maps.Size(24, 24),
              }}
            />
          );
        })}
      </GoogleMap>
    </Card>
  );
}