import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { Loader2, Search, MapPin, Phone, Globe, Star, Clock, X, Plus, ChevronDown, ChevronUp, Image } from "lucide-react";
import { MdRestaurant, MdHotel } from "react-icons/md";
import { FaLandmark, FaShoppingBag, FaUmbrellaBeach, FaGlassCheers, FaStore, FaTree } from "react-icons/fa";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  useGoogleMapsScript,
  useMapCoordinates,
  usePlacesService,
  GoogleMap,
  MarkerF,
  MAP_CONTAINER_STYLE,
  DEFAULT_MAP_OPTIONS,
  getCategoryIcon,
  getPrimaryCategory,
  CATEGORY_ICONS,
  type PlaceDetails,
  type PinnedPlace,
  type PlaceCategory,
} from "@/lib/google-maps";
import usePlacesAutocomplete, { getGeocode, getLatLng } from "use-places-autocomplete";

interface MapViewProps {
  location: string;
  tripId?: number;
  pinnedPlaces?: PinnedPlace[] | { places: PinnedPlace[] };
  onPinClick?: (place: PinnedPlace) => void;
  className?: string;
}

const CategoryIcon = ({ category }: { category: PlaceCategory }) => {
  const IconComponent = CATEGORY_ICONS[category];
  return IconComponent ? <IconComponent className="h-4 w-4 text-[#70757a]" /> : null;
};

const StarRating = ({ rating }: { rating: number }) => {
  return (
    <div className="flex items-center">
      {[1, 2, 3, 4, 5].map((star) => {
        const roundedRating = Math.round(rating * 2) / 2; // Round to nearest 0.5
        const difference = star - roundedRating;
        let starClass = "text-yellow-400 fill-current"; // Full star

        if (difference > 0) {
          if (difference === 0.5) {
            // Half star
            starClass = "text-yellow-400 fill-[50%]";
          } else if (difference >= 1) {
            // Empty star
            starClass = "text-gray-300 fill-current";
          }
        }

        return (
          <Star
            key={star}
            className={`h-3.5 w-3.5 -ml-0.5 first:ml-0 ${starClass}`}
          />
        );
      })}
    </div>
  );
};

export function MapView({ location, tripId, pinnedPlaces = [], onPinClick, className }: MapViewProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const mapRef = useRef<google.maps.Map | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<PlaceDetails | null>(null);
  const [expandedReviews, setExpandedReviews] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);

  const { isLoaded, loadError } = useGoogleMapsScript();
  const { coordinates, setCoordinates, geocodeLocation } = useMapCoordinates(location);
  const { placesService, initPlacesService, getPlaceDetails } = usePlacesService();

  // Process pinned places data with better error handling and logging
  const allPinnedPlaces = useMemo(() => {
    console.log("Processing pinnedPlaces input:", pinnedPlaces);

    if (!pinnedPlaces) {
      console.log("No pinned places provided");
      return [];
    }

    if (Array.isArray(pinnedPlaces)) {
      console.log("Pinned places is an array:", pinnedPlaces);
      return pinnedPlaces;
    }

    if ('places' in pinnedPlaces) {
      console.log("Pinned places is an object with places:", pinnedPlaces.places);
      return pinnedPlaces.places;
    }

    console.log("Unknown pinned places format, defaulting to empty array");
    return [];
  }, [pinnedPlaces]);

  useEffect(() => {
    console.log("Pinned places updated:", allPinnedPlaces);
  }, [allPinnedPlaces]);

  // Base functions that other functions depend on
  const fetchPlaceDetails = useCallback((placeId: string) => {
    getPlaceDetails(placeId, (place, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && place) {
        setSelectedPlace(place);
      }
    });
  }, [getPlaceDetails]);

  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    const event = e as unknown as { placeId?: string; stop?: () => void };
    if (event.stop) event.stop();
    if (!event.placeId) {
      setSelectedPlace(null);
      return;
    }
    fetchPlaceDetails(event.placeId);
  }, [fetchPlaceDetails]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    initPlacesService(map);
    map.addListener('click', handleMapClick);
  }, [initPlacesService, handleMapClick]);

  // Initialize Places Autocomplete
  const {
    ready,
    value,
    suggestions: { status, data },
    setValue,
    clearSuggestions,
  } = usePlacesAutocomplete({
    requestOptions: {
      types: ['establishment', 'geocode'],
      location: isLoaded ? new google.maps.LatLng(coordinates.lat, coordinates.lng) : undefined,
      radius: 50000,
    },
    debounce: 300,
  });

  const handleSearchSelect = useCallback(async (placeId: string, description: string) => {
    try {
      clearSuggestions();
      setValue(description, false);

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
  }, [clearSuggestions, setValue, setCoordinates, fetchPlaceDetails]);

  const handlePinPlace = useCallback(async () => {
    if (!selectedPlace || !tripId) return;

    try {
      const placeCoordinates = selectedPlace.geometry?.location
        ? {
            lat: selectedPlace.geometry.location.lat(),
            lng: selectedPlace.geometry.location.lng(),
          }
        : coordinates;

      console.log("Pinning place with coordinates:", placeCoordinates);

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
          rating: selectedPlace.rating
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to pin place');
      }

      const newPinnedPlace = await response.json();
      console.log("Successfully pinned new place:", newPinnedPlace);

      // Invalidate and refetch pinned places
      await queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/pinned-places`] });

      toast({
        title: "Success",
        description: "Place has been pinned to your trip",
      });
    } catch (error) {
      console.error('Error pinning place:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to pin place to your trip",
      });
    }
  }, [selectedPlace, tripId, coordinates, toast, queryClient]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
  };

  if (loadError) {
    return (
      <Card className="p-4 text-center">
        <p className="text-destructive">Error loading map</p>
      </Card>
    );
  }

  if (!isLoaded) {
    return (
      <Card className="p-4 flex items-center justify-center h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </Card>
    );
  }

  return (
    <Card className={cn("overflow-hidden relative", className)}>
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 w-[400px]">
        <div className="relative">
          <Input
            type="text"
            placeholder="Search on map"
            value={value}
            onChange={handleInputChange}
            className="w-full h-12 pl-4 pr-10 rounded-lg shadow-lg bg-background"
            disabled={!ready}
          />
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />

          {status === "OK" && (
            <ul className="absolute top-full left-0 right-0 mt-1 bg-background rounded-lg shadow-lg overflow-hidden z-50">
              {data.map(({ place_id, description }) => (
                <li
                  key={place_id}
                  onClick={() => handleSearchSelect(place_id, description)}
                  className="px-4 py-2 hover:bg-accent cursor-pointer"
                >
                  {description}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Main place details sidebar */}
      {selectedPlace && (
        <div className="absolute top-0 left-0 bottom-0 w-[400px] bg-background shadow-lg z-40 flex flex-col">
          {/* Header section */}
          <div className="p-6 border-b">
            <div className="space-y-2">
              <h2 className="text-[22px] font-medium leading-7 text-foreground">{selectedPlace.name}</h2>
              <div className="flex flex-col gap-1">
                {selectedPlace.rating && (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-0.5">
                      <StarRating rating={selectedPlace.rating} />
                      <span className="ml-1 text-sm font-medium">{selectedPlace.rating}</span>
                    </div>
                    <span className="text-[#70757a] text-sm">
                      ({selectedPlace.user_ratings_total?.toLocaleString()})
                    </span>
                  </div>
                )}
                {selectedPlace.types && (
                  <div className="flex items-center gap-2 text-[14px] text-[#70757a]">
                    {(() => {
                      const { category, label } = getPrimaryCategory(selectedPlace.types);
                      return (
                        <>
                          <CategoryIcon category={category} />
                          <span>{label}</span>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons - 4 columns grid */}
          <div className="grid grid-cols-4 p-2 border-b">
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(selectedPlace.formatted_address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center justify-center p-3 hover:bg-accent rounded-lg gap-1.5 transition-colors"
            >
              <MapPin className="h-5 w-5 text-primary" />
              <span className="text-xs font-medium">Directions</span>
            </a>

            {tripId ? (
              <button
                className="flex flex-col items-center justify-center p-3 hover:bg-accent rounded-lg gap-1.5 transition-colors"
                onClick={handlePinPlace}
                title={selectedPlace.place_id ? "Pin this place to your trip" : "Place cannot be pinned"}
              >
                <Plus className="h-5 w-5 text-primary" />
                <span className="text-xs font-medium">Pin</span>
              </button>
            ) : (
              <button
                className="flex flex-col items-center justify-center p-3 gap-1.5 transition-colors opacity-50 cursor-not-allowed"
                disabled
                title="Not available outside of a trip"
              >
                <Plus className="h-5 w-5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Pin</span>
              </button>
            )}

            {selectedPlace.formatted_phone_number ? (
              <a
                href={`tel:${selectedPlace.formatted_phone_number}`}
                className="flex flex-col items-center justify-center p-3 hover:bg-accent rounded-lg gap-1.5 transition-colors"
                title={`Call ${selectedPlace.formatted_phone_number}`}
              >
                <Phone className="h-5 w-5 text-primary" />
                <span className="text-xs font-medium">Call</span>
              </a>
            ) : (
              <button
                className="flex flex-col items-center justify-center p-3 gap-1.5 transition-colors opacity-50 cursor-not-allowed"
                disabled
                title="No phone number available"
              >
                <Phone className="h-5 w-5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Call</span>
              </button>
            )}

            {selectedPlace.website ? (
              <a
                href={selectedPlace.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center p-3 hover:bg-accent rounded-lg gap-1.5 transition-colors"
                title={selectedPlace.website}
              >
                <Globe className="h-5 w-5 text-primary" />
                <span className="text-xs font-medium">Website</span>
              </a>
            ) : (
              <button
                className="flex flex-col items-center justify-center p-3 gap-1.5 transition-colors opacity-50 cursor-not-allowed"
                disabled
                title="No website available"
              >
                <Globe className="h-5 w-5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Website</span>
              </button>
            )}
          </div>

          <ScrollArea className="flex-1">
            <div className="p-6 space-y-8">
              {/* Photos grid */}
              {selectedPlace.photos && selectedPlace.photos.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-foreground">Photos</h3>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedPhotoIndex(0)}>
                      <Image className="h-4 w-4 mr-2" />
                      View all
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {selectedPlace.photos.slice(0, 4).map((photo, index) => (
                      <img
                        key={index}
                        src={photo.getUrl()}
                        alt={`Place photo ${index + 1}`}
                        className="w-full h-32 object-cover hover:opacity-90 transition-opacity cursor-pointer"
                        onClick={() => setSelectedPhotoIndex(index)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Location section */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-foreground">Location</h3>
                <div className="flex items-start gap-4">
                  <MapPin className="h-5 w-5 mt-1 text-primary flex-shrink-0" />
                  <p className="text-sm leading-relaxed">{selectedPlace.formatted_address}</p>
                </div>
              </div>

              {/* Contact section */}
              {(selectedPlace.formatted_phone_number || selectedPlace.website) && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-foreground">Contact</h3>
                  {selectedPlace.formatted_phone_number && (
                    <div className="flex items-center gap-4">
                      <Phone className="h-5 w-5 text-primary flex-shrink-0" />
                      <a href={`tel:${selectedPlace.formatted_phone_number}`} className="text-sm hover:underline">
                        {selectedPlace.formatted_phone_number}
                      </a>
                    </div>
                  )}
                  {selectedPlace.website && (
                    <div className="flex items-center gap-4">
                      <Globe className="h-5 w-5 text-primary flex-shrink-0" />
                      <a
                        href={selectedPlace.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm hover:underline truncate"
                      >
                        {selectedPlace.website}
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Opening hours */}
              {selectedPlace.opening_hours && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-foreground">Hours</h3>
                  <div className="flex items-start gap-4">
                    <Clock className="h-5 w-5 mt-1 text-primary flex-shrink-0" />
                    <ul className="space-y-1.5">
                      {selectedPlace.opening_hours.weekday_text.map((hours, index) => (
                        <li key={index} className="text-sm leading-relaxed">{hours}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Reviews section */}
              {selectedPlace.reviews && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <h3 className="text-[16px] font-medium text-foreground">Reviews</h3>
                      {selectedPlace.rating && (
                        <div className="flex items-center gap-1">
                          <StarRating rating={selectedPlace.rating} />
                          <span className="text-sm">
                            {selectedPlace.rating}
                            <span className="text-[#70757a] ml-1">
                              ({selectedPlace.user_ratings_total?.toLocaleString()})
                            </span>
                          </span>
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedReviews(!expandedReviews)}
                      className="text-primary text-sm font-medium px-2"
                    >
                      {expandedReviews ? "Show less" : "More"}
                    </Button>
                  </div>
                  <div className="space-y-6">
                    {(expandedReviews ? selectedPlace.reviews : selectedPlace.reviews.slice(0, 2)).map((review, index) => (
                      <div key={index} className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[13px]">{review.author_name}</span>
                          <StarRating rating={review.rating || 0} />
                        </div>
                        <p className="text-[13px] text-[#70757a] leading-5 line-clamp-3">{review.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedPlace(null)}
            className="absolute top-4 right-4"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Photo Gallery Modal */}
      {selectedPhotoIndex !== null && selectedPlace?.photos && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white/10"
            onClick={() => setSelectedPhotoIndex(null)}
          >
            <X className="h-6 w-6" />
          </Button>
          <img
            src={selectedPlace.photos[selectedPhotoIndex].getUrl({ maxWidth: 1200, maxHeight: 800 })}
            alt={`Photo ${selectedPhotoIndex + 1}`}
            className="max-w-[90vw] max-h-[90vh] object-contain"
          />
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white text-sm">
            {selectedPhotoIndex + 1} / {selectedPlace.photos.length}
          </div>
        </div>
      )}

      <GoogleMap
        mapContainerStyle={MAP_CONTAINER_STYLE}
        zoom={13}
        center={coordinates}
        options={{
          ...DEFAULT_MAP_OPTIONS,
          clickableIcons: true,
          streetViewControl: false,
        }}
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

        {/* Pinned places markers */}
        {allPinnedPlaces.map((place: PinnedPlace) => {
          console.log("Rendering marker for place:", place);
          if (!place.coordinates || !place.coordinates.lat || !place.coordinates.lng) {
            console.warn("Invalid coordinates for place:", place);
            return null;
          }

          return (
            <MarkerF
              key={place.id}
              position={place.coordinates}
              title={place.name}
              icon={{
                path: google.maps.SymbolPath.MARKER,
                scale: 30,
                fillColor: "#DC2626", // Red color
                fillOpacity: 1,
                strokeWeight: 2,
                strokeColor: "#FFFFFF",
                labelOrigin: new google.maps.Point(0, -15)
              }}
              onClick={() => {
                if (place.placeId) {
                  fetchPlaceDetails(place.placeId);
                }
                onPinClick?.(place);
              }}
            />
          );
        })}
      </GoogleMap>
    </Card>
  );
}