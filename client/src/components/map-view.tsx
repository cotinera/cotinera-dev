import { useLoadScript, GoogleMap, MarkerF } from "@react-google-maps/api";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { CATEGORY_ICONS, PlaceCategory } from "./pinned-places";

// Add Places library to the libraries array
const libraries: ("places")[] = ["places"];

// ... (keep existing constants)

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
  const [placesService, setPlacesService] = useState<google.maps.places.PlacesService | null>(null);

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries,
  });

  // ... (keep existing query and pinnedPlaces logic)

  // Initialize Places service when map loads
  const onMapLoad = useCallback((map: google.maps.Map) => {
    setPlacesService(new google.maps.places.PlacesService(map));
  }, []);

  // Handle place details fetching
  const fetchPlaceDetails = useCallback(async (placeId: string): Promise<PlaceDetails | null> => {
    if (!placesService) return null;

    return new Promise((resolve, reject) => {
      placesService.getDetails(
        {
          placeId,
          fields: [
            'name',
            'formatted_address',
            'formatted_phone_number',
            'rating',
            'opening_hours',
            'website',
            'photos'
          ]
        },
        (result, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && result) {
            resolve({
              name: result.name || '',
              formatted_address: result.formatted_address || '',
              formatted_phone_number: result.formatted_phone_number,
              rating: result.rating,
              opening_hours: result.opening_hours ? {
                weekday_text: result.opening_hours.weekday_text || [],
                isOpen: () => result.opening_hours?.isOpen() || false
              } : undefined,
              website: result.website,
              photos: result.photos
            });
          } else {
            reject(new Error(`Places service error: ${status}`));
          }
        }
      );
    });
  }, [placesService]);

  // Handle map click events
  const handleMapClick = useCallback(async (e: google.maps.MapMouseEvent) => {
    if (!e.placeId) return;

    try {
      const placeDetails = await fetchPlaceDetails(e.placeId);
      console.log('Place details:', placeDetails);
      // You can use these details in your UI or pass them to a parent component
    } catch (error) {
      console.error('Error fetching place details:', error);
    }
  }, [fetchPlaceDetails]);

  // Handle marker click events
  const handleMarkerClick = useCallback(async (place: PinnedPlace) => {
    if (!onPinClick) return;

    try {
      // First try to fetch place details if we have a placeId
      if (place.placeId) {
        const details = await fetchPlaceDetails(place.placeId);
        onPinClick(place, details || undefined);
      } else {
        // If no placeId, just use the basic place info
        onPinClick(place);
      }
    } catch (error) {
      console.error('Error fetching place details:', error);
      onPinClick(place);
    }
  }, [onPinClick, fetchPlaceDetails]);

  // ... (keep existing useEffect and error handling)

  return (
    <Card className={cn("overflow-hidden", className)}>
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        zoom={13}
        center={coordinates}
        options={defaultOptions}
        onLoad={onMapLoad}
        onClick={handleMapClick}
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
              onClick={() => handleMarkerClick(place)}
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