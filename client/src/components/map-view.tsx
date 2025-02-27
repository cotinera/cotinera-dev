import { useLoadScript, GoogleMap, MarkerF } from "@react-google-maps/api";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { CATEGORY_ICONS, PlaceCategory } from "./pinned-places";
import { ScrollArea } from "@/components/ui/scroll-area";

// Include Places library
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

interface PlaceDetails {
  name: string;
  formatted_address: string;
  formatted_phone_number?: string;
  rating?: number;
  opening_hours?: {
    weekday_text: string[];
    isOpen: () => boolean;
  };
  photos?: google.maps.places.PlacePhoto[];
  website?: string;
  reviews?: google.maps.places.PlaceReview[];
}

interface MapViewProps {
  location: string;
  tripId: number;
  pinnedPlaces?: PinnedPlace[] | { places: PinnedPlace[] };
  onPinClick?: (place: PinnedPlace) => void;
  className?: string;
}

export function MapView({ location, tripId, pinnedPlaces = [], onPinClick, className }: MapViewProps) {
  const [coordinates, setCoordinates] = useState<google.maps.LatLngLiteral>({
    lat: 37.7749,
    lng: -122.4194, // Default to San Francisco
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<PinnedPlace | null>(null);
  const [placeDetails, setPlaceDetails] = useState<PlaceDetails | null>(null);
  const [placesService, setPlacesService] = useState<google.maps.places.PlacesService | null>(null);

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

  // Initialize Places service when map is loaded
  const onMapLoad = (map: google.maps.Map) => {
    setPlacesService(new google.maps.places.PlacesService(map));
  };

  // Fetch place details when a place is selected
  useEffect(() => {
    if (!selectedPlace || !placesService) return;

    const request = {
      query: selectedPlace.name,
      fields: [
        'name',
        'formatted_address',
        'formatted_phone_number',
        'rating',
        'opening_hours',
        'photos',
        'website',
        'reviews'
      ],
      locationBias: {
        center: { lat: selectedPlace.coordinates.lat, lng: selectedPlace.coordinates.lng },
        radius: 100 // meters
      }
    };

    placesService.findPlaceFromQuery(request, (results, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && results?.[0]) {
        const placeId = results[0].place_id;

        placesService.getDetails(
          {
            placeId,
            fields: [
              'name',
              'formatted_address',
              'formatted_phone_number',
              'rating',
              'opening_hours',
              'photos',
              'website',
              'reviews'
            ]
          },
          (place, detailsStatus) => {
            if (detailsStatus === google.maps.places.PlacesServiceStatus.OK && place) {
              setPlaceDetails({
                name: place.name || '',
                formatted_address: place.formatted_address || '',
                formatted_phone_number: place.formatted_phone_number,
                rating: place.rating,
                opening_hours: place.opening_hours,
                photos: place.photos,
                website: place.website,
                reviews: place.reviews
              });
            }
          }
        );
      }
    });
  }, [selectedPlace, placesService]);

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

  // Create a function to get the icon for a category
  const getCategoryIcon = (category: PlaceCategory) => {
    const IconComponent = CATEGORY_ICONS[category] || CATEGORY_ICONS[PlaceCategory.TOURIST];
    // Convert the Lucide icon to an SVG path.  This is a placeholder, replace with actual icon generation
    const svgString = `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="hsl(var(--primary))" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
        <circle cx="12" cy="10" r="3"/>
      </svg>
    `;
    return svgString;
  };

  return (
    <div className="space-y-4">
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
          {allPinnedPlaces.map((place: PinnedPlace) => (
            <MarkerF
              key={place.id}
              position={place.coordinates}
              title={place.name}
              onClick={() => {
                setSelectedPlace(place);
                if (onPinClick) onPinClick(place);
              }}
              icon={{
                url: `data:image/svg+xml,${encodeURIComponent(getCategoryIcon(place.category))}`,
                scaledSize: new google.maps.Size(24, 24),
              }}
            />
          ))}
        </GoogleMap>
      </Card>

      {/* Place Details Panel */}
      {selectedPlace && placeDetails && (
        <Card className="p-4">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">{placeDetails.name}</h3>
              <p className="text-sm text-muted-foreground">{placeDetails.formatted_address}</p>
            </div>

            {placeDetails.photos && placeDetails.photos.length > 0 && (
              <ScrollArea className="w-full whitespace-nowrap rounded-md">
                <div className="flex gap-2 p-2">
                  {placeDetails.photos.slice(0, 5).map((photo, index) => (
                    <img
                      key={index}
                      src={photo.getUrl({ maxWidth: 200, maxHeight: 200 })}
                      alt={`${placeDetails.name} photo ${index + 1}`}
                      className="h-[150px] w-[150px] rounded-md object-cover"
                    />
                  ))}
                </div>
              </ScrollArea>
            )}

            {placeDetails.opening_hours && (
              <div>
                <h4 className="font-medium mb-2">Opening Hours</h4>
                <div className="text-sm space-y-1">
                  {placeDetails.opening_hours.weekday_text.map((hours, index) => (
                    <p key={index}>{hours}</p>
                  ))}
                </div>
              </div>
            )}

            {placeDetails.formatted_phone_number && (
              <div>
                <h4 className="font-medium mb-1">Phone</h4>
                <p className="text-sm">{placeDetails.formatted_phone_number}</p>
              </div>
            )}

            {placeDetails.website && (
              <div>
                <h4 className="font-medium mb-1">Website</h4>
                <a
                  href={placeDetails.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  {placeDetails.website}
                </a>
              </div>
            )}

            {placeDetails.reviews && placeDetails.reviews.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Reviews</h4>
                <div className="space-y-3">
                  {placeDetails.reviews.slice(0, 3).map((review, index) => (
                    <div key={index} className="text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{review.author_name}</span>
                        <span className="text-muted-foreground">
                          {new Date(review.time * 1000).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="mt-1">{review.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}