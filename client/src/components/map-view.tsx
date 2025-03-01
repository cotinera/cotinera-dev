import { useLoadScript, GoogleMap, MarkerF } from "@react-google-maps/api";
import { Loader2, Search, MapPin, Phone, Globe, Star, Clock, X, Plus, ChevronDown, ChevronUp, Image } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import usePlacesAutocomplete, { getGeocode, getLatLng } from "use-places-autocomplete";
import { MdRestaurant, MdHotel } from "react-icons/md";
import { FaLandmark, FaShoppingBag, FaUmbrellaBeach, FaGlassCheers, FaStore, FaTree } from "react-icons/fa";

// Category icons mapping
export const CATEGORY_ICONS = {
  restaurant: MdRestaurant,
  hotel: MdHotel,
  attraction: FaLandmark,
  shopping: FaShoppingBag,
  beach: FaUmbrellaBeach,
  nightlife: FaGlassCheers,
  store: FaStore,
  park: FaTree,
} as const;

export type PlaceCategory = keyof typeof CATEGORY_ICONS;

// Function to generate SVG icon for a category
const getCategoryIcon = (category: PlaceCategory = 'attraction') => {
  const IconComponent = CATEGORY_ICONS[category];
  const svgString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
    ${IconComponent ? IconComponent({}).props.children : ''}
  </svg>`;

  return {
    url: `data:image/svg+xml;base64,${btoa(svgString)}`,
    scaledSize: new google.maps.Size(32, 32),
    anchor: new google.maps.Point(16, 16),
    fillColor: "#1E88E5",
    fillOpacity: 1,
    strokeWeight: 2,
    strokeColor: "#FFFFFF",
  };
};

// Libraries for Google Maps
const libraries: ("places")[] = ["places"];

const mapContainerStyle = {
  width: "100%",
  height: "600px",
  position: "relative" as const,
};

const defaultOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  scrollwheel: true,
  clickableIcons: true,
};

interface Coordinates {
  lat: number;
  lng: number;
}

interface PinnedPlace {
  id: number;
  name: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  category?: PlaceCategory;
  placeId?: string;
}

interface PlaceDetails {
  place_id: string;
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
  reviews?: google.maps.places.PlaceReview[];
  geometry?: google.maps.places.PlaceGeometry;
}

interface MapViewProps {
  location: string;
  tripId?: number;
  pinnedPlaces?: PinnedPlace[] | { places: PinnedPlace[] };
  onPinClick?: (place: PinnedPlace) => void;
  className?: string;
}

export function MapView({ location, tripId, pinnedPlaces = [], onPinClick, className }: MapViewProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const mapRef = useRef<google.maps.Map | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);
  const placeDetailsRef = useRef<HTMLDivElement | null>(null);


  const [coordinates, setCoordinates] = useState<Coordinates>({
    lat: 37.7749,
    lng: -122.4194,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<PlaceDetails | null>(null);
  const [expandedReviews, setExpandedReviews] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries,
  });

  const {
    ready,
    value,
    suggestions: { status, data },
    setValue,
    clearSuggestions,
  } = usePlacesAutocomplete({
    debounce: 300,
    cache: 24 * 60 * 60,
    requestOptions: useMemo(() => ({
      location: isLoaded ? new google.maps.LatLng(coordinates.lat, coordinates.lng) : undefined,
      radius: 50000, // 50km radius
      types: ['establishment', 'geocode']
    }), [isLoaded, coordinates]),
  });

  const allPinnedPlaces = useMemo(() => {
    console.log("Pinned places:", pinnedPlaces);
    if (Array.isArray(pinnedPlaces)) return pinnedPlaces;
    if ('places' in pinnedPlaces) return pinnedPlaces.places;
    return [];
  }, [pinnedPlaces]);

  const fetchPlaceDetails = useCallback((placeId: string) => {
    if (!placesService.current) return;

    const request = {
      placeId,
      fields: [
        'name',
        'formatted_address',
        'formatted_phone_number',
        'rating',
        'opening_hours',
        'website',
        'photos',
        'reviews',
        'place_id',
        'geometry'
      ],
    };

    placesService.current.getDetails(request, (place, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && place) {
        setSelectedPlace(place as PlaceDetails);
      }
    });
  }, []);

  const handleSearchSelect = useCallback(async (placeId: string) => {
    clearSuggestions();
    setValue(""); // Clear input after selection

    try {
      const results = await getGeocode({ placeId });
      const { lat, lng } = await getLatLng(results[0]);

      setCoordinates({ lat, lng });
      if (mapRef.current) {
        mapRef.current.panTo({ lat, lng });
        mapRef.current.setZoom(15);
      }
      fetchPlaceDetails(placeId);
    } catch (error) {
      console.error("Error selecting place:", error);
    }
  }, [clearSuggestions, setValue, fetchPlaceDetails]);

  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    const event = e as unknown as { placeId?: string; stop?: () => void };

    if (event.stop) {
      event.stop();
    }

    if (!event.placeId || !placesService.current) {
      if (placeDetailsRef.current?.parentElement) {
        placeDetailsRef.current.parentElement.style.display = 'none';
      }
      return;
    }

    fetchPlaceDetails(event.placeId);
  }, [fetchPlaceDetails]);

  const handlePinPlace = useCallback(async () => {
    if (!selectedPlace || !tripId) return;

    try {
      const placeCoordinates = selectedPlace.geometry?.location
        ? {
            lat: selectedPlace.geometry.location.lat(),
            lng: selectedPlace.geometry.location.lng(),
          }
        : coordinates;

      const response = await fetch(`/api/trips/${tripId}/pinned-places`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: selectedPlace.name,
          placeId: selectedPlace.place_id,
          address: selectedPlace.formatted_address,
          coordinates: placeCoordinates,
          phone: selectedPlace.formatted_phone_number,
          website: selectedPlace.website,
          rating: selectedPlace.rating,
          openingHours: selectedPlace.opening_hours?.weekday_text,
          photos: selectedPlace.photos?.map(photo => photo.getUrl())
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to pin place');
      }

      toast({
        title: "Success",
        description: "Place has been pinned to your trip",
      });

      // Use proper invalidation format
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/pinned-places`] });
    } catch (error) {
      console.error('Error pinning place:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to pin place to your trip",
      });
    }
  }, [selectedPlace, tripId, coordinates, toast, queryClient]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    placesService.current = new google.maps.places.PlacesService(map);

    // Add click listener to handle place clicks
    google.maps.event.addListener(map, 'click', handleMapClick);
  }, [handleMapClick]);

  // Effect for initial geocoding
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

  // Effect for map click listener - Removed as listener is now added in onMapLoad
  //useEffect(() => {
  //  if (mapRef.current) {
  //    google.maps.event.clearListeners(mapRef.current, 'click');
  //    mapRef.current.addListener('click', handleMapClick);
  //  }
  //}, [handleMapClick]);

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
    <Card className={cn("overflow-hidden relative", className)} ref={placeDetailsRef}>
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 w-[400px]">
        <div className="relative">
          <Input
            type="text"
            placeholder="Search on map"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full h-12 pl-4 pr-10 rounded-lg shadow-lg bg-background"
            disabled={!ready}
          />
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />

          {status === "OK" && (
            <ul className="absolute top-full left-0 right-0 mt-1 bg-background rounded-lg shadow-lg overflow-hidden z-50">
              {data.map(({ place_id, description }) => (
                <li
                  key={place_id}
                  onClick={() => handleSearchSelect(place_id)}
                  className="px-4 py-2 hover:bg-accent cursor-pointer"
                >
                  {description}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {selectedPlace && (
        <div className="absolute top-0 left-0 bottom-0 w-[400px] bg-background shadow-lg z-40 flex flex-col">
          <div className="p-4 border-b flex justify-between items-center">
            <h2 className="text-xl font-semibold">{selectedPlace.name}</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedPlace(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-6">
              {tripId && (
                <Button
                  className="w-full flex items-center justify-center gap-2"
                  onClick={handlePinPlace}
                >
                  <Plus className="h-4 w-4" />
                  Pin this place
                </Button>
              )}

              {selectedPlace.photos && selectedPlace.photos.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Photos</h3>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedPhotoIndex(0)}>
                      <Image className="h-4 w-4 mr-2" />
                      View all
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedPlace.photos.slice(0, 4).map((photo, index) => (
                      <img
                        key={index}
                        src={photo.getUrl()}
                        alt={`Place photo ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg cursor-pointer"
                        onClick={() => setSelectedPhotoIndex(index)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {selectedPhotoIndex !== null && selectedPlace.photos && (
                <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-4 right-4 text-white"
                    onClick={() => setSelectedPhotoIndex(null)}
                  >
                    <X className="h-6 w-6" />
                  </Button>
                  <img
                    src={selectedPlace.photos[selectedPhotoIndex].getUrl({ maxWidth: 1200, maxHeight: 800 })}
                    alt={`Photo ${selectedPhotoIndex + 1}`}
                    className="max-w-[90vw] max-h-[90vh] object-contain"
                  />
                  <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white">
                    {selectedPhotoIndex + 1} / {selectedPlace.photos.length}
                  </div>
                </div>
              )}

              <div className="flex items-start gap-2">
                <MapPin className="h-5 w-5 mt-0.5 text-muted-foreground" />
                <p>{selectedPlace.formatted_address}</p>
              </div>

              {selectedPlace.formatted_phone_number && (
                <div className="flex items-center gap-2">
                  <Phone className="h-5 w-5 text-muted-foreground" />
                  <a
                    href={`tel:${selectedPlace.formatted_phone_number}`}
                    className="hover:underline"
                  >
                    {selectedPlace.formatted_phone_number}
                  </a>
                </div>
              )}

              {selectedPlace.website && (
                <div className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-muted-foreground" />
                  <a
                    href={selectedPlace.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    Website
                  </a>
                </div>
              )}

              {selectedPlace.rating && (
                <div className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-400 fill-current" />
                  <span>{selectedPlace.rating} / 5</span>
                </div>
              )}

              {selectedPlace.opening_hours && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <h3 className="font-semibold">Opening Hours</h3>
                  </div>
                  <ul className="space-y-1 text-sm">
                    {selectedPlace.opening_hours.weekday_text.map((hours, index) => (
                      <li key={index}>{hours}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedPlace.reviews && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Reviews</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedReviews(!expandedReviews)}
                    >
                      {expandedReviews ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  {(expandedReviews ? selectedPlace.reviews : selectedPlace.reviews.slice(0, 2)).map((review, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{review.author_name}</span>
                        <div className="flex items-center">
                          <Star className="h-4 w-4 text-yellow-400 fill-current" />
                          <span className="ml-1">{review.rating}</span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">{review.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      )}

      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        zoom={13}
        center={coordinates}
        options={{
          ...defaultOptions,
          clickableIcons: true,
          streetViewControl: false,
        }}
        onLoad={onMapLoad}
      >
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

        {allPinnedPlaces.map((place: PinnedPlace) => (
          <MarkerF
            key={place.id}
            position={place.coordinates}
            title={place.name}
            icon={getCategoryIcon(place.category)}
            onClick={() => {
              if (place.placeId) {
                fetchPlaceDetails(place.placeId);
              }
              onPinClick?.(place);
            }}
          />
        ))}
      </GoogleMap>
    </Card>
  );
}