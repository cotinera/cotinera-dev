import { useState, useRef, useCallback, useMemo } from "react";
import { Loader2, Search, MapPin, Phone, Globe, Star, Clock, X, Plus, ChevronDown, ChevronUp, Image } from "lucide-react";
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
  type PlaceDetails,
  type PinnedPlace,
} from "@/lib/google-maps";
import usePlacesAutocomplete, { getGeocode, getLatLng } from "use-places-autocomplete";

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
  const placeDetailsRef = useRef<HTMLDivElement | null>(null);

  const [selectedPlace, setSelectedPlace] = useState<PlaceDetails | null>(null);
  const [expandedReviews, setExpandedReviews] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);

  const { isLoaded, loadError } = useGoogleMapsScript();
  const { coordinates, setCoordinates, geocodeLocation } = useMapCoordinates(location);
  const { placesService, initPlacesService, getPlaceDetails } = usePlacesService();

  // Initialize Places Autocomplete with proper configuration
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
      radius: 50000, // 50km radius
    },
    debounce: 300,
  });

  const allPinnedPlaces = useMemo(() => {
    if (Array.isArray(pinnedPlaces)) return pinnedPlaces;
    if ('places' in pinnedPlaces) return pinnedPlaces.places;
    return [];
  }, [pinnedPlaces]);

  const fetchPlaceDetails = useCallback((placeId: string) => {
    getPlaceDetails(placeId, (place, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && place) {
        setSelectedPlace(place);
      }
    });
  }, [getPlaceDetails]);

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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
  };

  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    const event = e as unknown as { placeId?: string; stop?: () => void };

    if (event.stop) {
      event.stop();
    }

    if (!event.placeId) {
      setSelectedPlace(null);
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
    initPlacesService(map);
    map.addListener('click', handleMapClick);
  }, [initPlacesService, handleMapClick]);

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
    <Card className={cn("overflow-hidden relative", className)} ref={placeDetailsRef}>
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
              <h2 className="text-2xl font-semibold text-foreground">{selectedPlace.name}</h2>
              {selectedPlace.rating && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center">
                    <Star className="h-4 w-4 text-yellow-400 fill-current" />
                    <span className="ml-1 font-medium">{selectedPlace.rating}</span>
                  </div>
                  <span className="text-muted-foreground text-sm">
                    {selectedPlace.reviews?.length} reviews
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-4 gap-2 p-4 border-b">
            <button className="flex flex-col items-center justify-center p-2 hover:bg-accent rounded-lg gap-1">
              <MapPin className="h-6 w-6 text-primary" />
              <span className="text-xs">Directions</span>
            </button>
            <button
              className="flex flex-col items-center justify-center p-2 hover:bg-accent rounded-lg gap-1"
              onClick={tripId ? handlePinPlace : undefined}
            >
              <Plus className="h-6 w-6 text-primary" />
              <span className="text-xs">Pin</span>
            </button>
            <button className="flex flex-col items-center justify-center p-2 hover:bg-accent rounded-lg gap-1">
              <Phone className="h-6 w-6 text-primary" />
              <span className="text-xs">Call</span>
            </button>
            <button className="flex flex-col items-center justify-center p-2 hover:bg-accent rounded-lg gap-1">
              <Globe className="h-6 w-6 text-primary" />
              <span className="text-xs">Website</span>
            </button>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-6 space-y-6">
              {/* Photos grid */}
              {selectedPlace.photos && selectedPlace.photos.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-muted-foreground">Photos</h3>
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
                        className="w-full h-32 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => setSelectedPhotoIndex(index)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Address section */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">Address</h3>
                <div className="flex items-start gap-4">
                  <MapPin className="h-5 w-5 mt-0.5 text-primary" />
                  <p className="text-sm">{selectedPlace.formatted_address}</p>
                </div>
              </div>

              {/* Contact section */}
              {(selectedPlace.formatted_phone_number || selectedPlace.website) && (
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-muted-foreground">Contact</h3>
                  {selectedPlace.formatted_phone_number && (
                    <div className="flex items-center gap-4">
                      <Phone className="h-5 w-5 text-primary" />
                      <a href={`tel:${selectedPlace.formatted_phone_number}`} className="text-sm hover:underline">
                        {selectedPlace.formatted_phone_number}
                      </a>
                    </div>
                  )}
                  {selectedPlace.website && (
                    <div className="flex items-center gap-4">
                      <Globe className="h-5 w-5 text-primary" />
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
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-muted-foreground">Opening hours</h3>
                  <div className="flex items-start gap-4">
                    <Clock className="h-5 w-5 text-primary" />
                    <ul className="space-y-1 text-sm">
                      {selectedPlace.opening_hours.weekday_text.map((hours, index) => (
                        <li key={index} className="text-sm">{hours}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Reviews section */}
              {selectedPlace.reviews && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-muted-foreground">Reviews</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedReviews(!expandedReviews)}
                      className="text-primary"
                    >
                      {expandedReviews ? "Show less" : "View all"}
                    </Button>
                  </div>
                  <div className="space-y-4">
                    {(expandedReviews ? selectedPlace.reviews : selectedPlace.reviews.slice(0, 2)).map((review, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{review.author_name}</span>
                          <div className="flex items-center">
                            <Star className="h-4 w-4 text-yellow-400 fill-current" />
                            <span className="ml-1 text-sm">{review.rating}</span>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-3">{review.text}</p>
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