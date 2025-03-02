import { useState, useRef, useCallback, useMemo } from "react";
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

const CategoryIcon = ({ category }: { category: PlaceCategory }) => {
  const IconComponent = CATEGORY_ICONS[category];
  return IconComponent ? <IconComponent className="h-4 w-4 text-[#70757a]" /> : null;
};

const StarRating = ({ rating }: { rating: number }) => {
  return (
    <div className="flex items-center">
      {[1, 2, 3, 4, 5].map((star) => {
        const roundedRating = Math.round(rating * 2) / 2;
        const difference = star - roundedRating;
        let starClass = "text-yellow-400 fill-current";

        if (difference > 0) {
          if (difference === 0.5) {
            starClass = "text-yellow-400 fill-[50%]";
          } else if (difference >= 1) {
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

export interface MapViewProps {
  location: string;
  tripId?: number;
  pinnedPlaces?: PinnedPlace[] | { places: PinnedPlace[] };
  onPinClick?: (place: PinnedPlace) => void;
  onPlaceNameClick?: (place: PinnedPlace) => void;
  className?: string;
}

export const handlePlaceNameClick = (
  place: PinnedPlace,
  mapRef: React.RefObject<google.maps.Map | null>,
  fetchPlaceDetails: (placeId: string) => void
): void => {
  if (mapRef.current && place.coordinates) {
    mapRef.current.panTo(place.coordinates);
    mapRef.current.setZoom(17);
  }
  if (place.placeId) {
    fetchPlaceDetails(place.placeId);
  }
};

export function MapView({
  location,
  tripId,
  pinnedPlaces = [],
  onPinClick,
  onPlaceNameClick,
  className
}: MapViewProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const mapRef = useRef<google.maps.Map | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<PlaceDetails | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [expandedReviews, setExpandedReviews] = useState(false);

  const { isLoaded, loadError } = useGoogleMapsScript();
  const { coordinates, setCoordinates } = useMapCoordinates(location);
  const { placesService, initPlacesService, getPlaceDetails } = usePlacesService();

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

  const allPinnedPlaces = useMemo(() => {
    if (!pinnedPlaces) return [];
    if (Array.isArray(pinnedPlaces)) return pinnedPlaces;
    if ('places' in pinnedPlaces) return pinnedPlaces.places;
    return [];
  }, [pinnedPlaces]);

  const fetchDetails = useCallback((placeId: string) => {
    getPlaceDetails(placeId, (place, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && place) {
        setSelectedPlace(place);
      }
    });
  }, [getPlaceDetails]);

  const handleMarkerClick = useCallback((place: PinnedPlace) => {
    handlePlaceNameClick(place, mapRef, fetchDetails);
    onPinClick?.(place);
  }, [onPinClick, fetchDetails, handlePlaceNameClick]);

  const handleLocalPlaceNameClick = useCallback((place: PinnedPlace) => {
    handlePlaceNameClick(place, mapRef, fetchDetails);
    onPlaceNameClick?.(place);
  }, [onPlaceNameClick, fetchDetails, handlePlaceNameClick]);

  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    const event = e as unknown as { placeId?: string; stop?: () => void };
    if (event.stop) event.stop();
    if (!event.placeId) {
      setSelectedPlace(null);
      return;
    }
    fetchDetails(event.placeId);
  }, [fetchDetails]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    initPlacesService(map);
    map.addListener('click', handleMapClick);
  }, [initPlacesService, handleMapClick]);

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

      fetchDetails(placeId);
    } catch (error) {
      console.error("Error selecting place:", error);
    }
  }, [clearSuggestions, setValue, setCoordinates, fetchDetails]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
  };

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
          coordinates: placeCoordinates,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to pin place');
      }

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

  if (loadError) {
    return (
      <Card className={cn("p-4 text-center text-destructive", className)}>
        Error loading map
      </Card>
    );
  }

  if (!isLoaded) {
    return (
      <Card className={cn("p-4 flex items-center justify-center h-[400px]", className)}>
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

      {/* Place details sidebar */}
      {selectedPlace && (
        <div className="absolute top-0 left-0 bottom-0 w-[400px] bg-background shadow-lg z-40 flex flex-col">
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
                          {selectedPlace.price_level && (
                            <span className="ml-1">
                              {"$".repeat(selectedPlace.price_level)}
                            </span>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          </div>

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

            {tripId && (
              <button
                className="flex flex-col items-center justify-center p-3 hover:bg-accent rounded-lg gap-1.5 transition-colors"
                onClick={handlePinPlace}
              >
                <Plus className="h-5 w-5 text-primary" />
                <span className="text-xs font-medium">Pin</span>
              </button>
            )}

            {selectedPlace.formatted_phone_number && (
              <a
                href={`tel:${selectedPlace.formatted_phone_number}`}
                className="flex flex-col items-center justify-center p-3 hover:bg-accent rounded-lg gap-1.5 transition-colors"
              >
                <Phone className="h-5 w-5 text-primary" />
                <span className="text-xs font-medium">Call</span>
              </a>
            )}

            {selectedPlace.website && (
              <a
                href={selectedPlace.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center p-3 hover:bg-accent rounded-lg gap-1.5 transition-colors"
              >
                <Globe className="h-5 w-5 text-primary" />
                <span className="text-xs font-medium">Website</span>
              </a>
            )}
          </div>

          {/* Booking/Reservation Button */}
          {(selectedPlace.reservable || selectedPlace.booking_url) && (
            <div className="p-4 border-b">
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium"
                size="lg"
                onClick={() => window.open(selectedPlace.booking_url || selectedPlace.url, '_blank')}
              >
                {selectedPlace.types?.includes('restaurant') ? 'Reserve a table' : 'Book Now'}
              </Button>
            </div>
          )}

          <ScrollArea className="flex-1">
            <div className="p-6 space-y-8">
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

              <div className="space-y-3">
                <h3 className="text-sm font-medium text-foreground">Location</h3>
                <div className="flex items-start gap-4">
                  <MapPin className="h-5 w-5 mt-1 text-primary flex-shrink-0" />
                  <p className="text-sm leading-relaxed">{selectedPlace.formatted_address}</p>
                </div>
              </div>

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

              {selectedPlace.opening_hours && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-foreground">Hours</h3>
                    <span className={`text-sm font-medium ${
                      selectedPlace.opening_hours.isOpen() ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {selectedPlace.opening_hours.isOpen() ? 'Open' : 'Closed'}
                    </span>
                  </div>
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

              {selectedPlace.types?.includes('restaurant') && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-foreground">Service options</h3>
                  <div className="space-y-2">
                    {selectedPlace.dine_in && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm">✓ Dine-in</span>
                      </div>
                    )}
                    {selectedPlace.takeout && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm">✓ Takeout</span>
                      </div>
                    )}
                    {selectedPlace.delivery && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm">✓ Delivery</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selectedPlace.types?.includes('lodging') && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-foreground">Compare prices</h3>
                    <div className="space-y-2 border rounded-lg divide-y">
                      {[
                        { site: 'Official site', price: selectedPlace.price_level ? selectedPlace.price_level * 200 : 300 },
                        { site: 'Booking.com', price: selectedPlace.price_level ? selectedPlace.price_level * 180 : 280 },
                        { site: 'Hotels.com', price: selectedPlace.price_level ? selectedPlace.price_level * 190 : 290 }
                      ].map((option, index) => (
                        <div key={index} className="p-3 flex items-center justify-between hover:bg-accent cursor-pointer">
                          <span className="text-sm">{option.site}</span>
                          <span className="text-sm font-medium">${option.price}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

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
                      {expandedReviews ? (
                        <>
                          Show less
                          <ChevronUp className="h-4 w-4 ml-1" />
                        </>
                      ) : (
                        <>
                          More
                          <ChevronDown className="h-4 w-4 ml-1" />
                        </>
                      )}
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
            icon={{
              path: google.maps.SymbolPath.MARKER,
              scale: 30,
              fillColor: "#DC2626",
              fillOpacity: 1,
              strokeWeight: 2,
              strokeColor: "#FFFFFF",
              labelOrigin: new google.maps.Point(0, -15)
            }}
            onClick={() => handleMarkerClick(place)}
          />
        ))}
      </GoogleMap>
    </Card>
  );
}