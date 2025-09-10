import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { MapPin } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface LocationSearchBarProps {
  value: string;
  onChange: (address: string, coordinates?: { lat: number; lng: number }, name?: string) => void;
  placeholder?: string;
  className?: string;
  searchBias?: {
    lat: number;
    lng: number;
    radius?: number;
  };
  onInputRef?: (ref: HTMLInputElement | null) => void;
}

export function LocationSearchBar({
  value,
  onChange,
  placeholder = "Search for a location...",
  className,
  searchBias,
  onInputRef,
}: LocationSearchBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (onInputRef && inputRef.current) {
      onInputRef(inputRef.current);
    }
  }, [onInputRef]);

  useEffect(() => {
    // Check if Google Maps and Places library are fully loaded
    if (!window.google || !window.google.maps || !window.google.maps.places) {
      console.log('Google Maps or Places library not loaded yet');
      return;
    }

    try {

      autocompleteService.current = new google.maps.places.AutocompleteService();
      if (mapRef.current) {
        placesService.current = new google.maps.places.PlacesService(mapRef.current);
      }
    } catch (error) {
      console.error('Error initializing Google Places services:', error);
    }
  }, []);

  const handleSearch = async (searchValue: string) => {
    if (!searchValue || !autocompleteService.current) {
      setPredictions([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let locationBias: google.maps.places.AutocompletionRequest['locationBias'] | undefined;

      if (searchBias && searchBias.lat && searchBias.lng) {
        const radius = searchBias.radius || 5000; // Default 5km radius for tighter local search
        const location = new google.maps.LatLng(searchBias.lat, searchBias.lng);

        // Create a tight circular bias around the current location
        locationBias = {
          center: location,
          radius: radius
        };
      }

      const response = await autocompleteService.current.getPlacePredictions({
        input: searchValue,
        types: ['establishment', 'geocode'],
        locationBias: locationBias,
        strictBounds: true, // This makes the location bias stronger
        fields: ['formatted_address', 'geometry', 'name', 'place_id']
      });

      // Sort predictions by distance if we have location bias
      if (searchBias && response.predictions.length > 0) {
        const location = new google.maps.LatLng(searchBias.lat, searchBias.lng);

        // Calculate distances and sort
        const predictionsWithDistance = await Promise.all(
          response.predictions.map(async (prediction) => {
            const details = await new Promise<google.maps.places.PlaceResult>((resolve, reject) => {
              placesService.current!.getDetails(
                {
                  placeId: prediction.place_id,
                  fields: ['geometry']
                },
                (result, status) => {
                  if (status === google.maps.places.PlacesServiceStatus.OK && result) {
                    resolve(result);
                  } else {
                    reject(new Error('Failed to get place details'));
                  }
                }
              );
            });

            const distance = google.maps.geometry.spherical.computeDistanceBetween(
              location,
              details.geometry!.location!
            );

            return { prediction, distance };
          })
        );

        // Sort by distance
        predictionsWithDistance.sort((a, b) => a.distance - b.distance);
        setPredictions(predictionsWithDistance.map(p => p.prediction));
      } else {
        setPredictions(response.predictions);
      }

      setIsOpen(true);
    } catch (err) {
      console.error('Autocomplete error:', err);
      setError('Failed to load suggestions. Please try again.');
      setPredictions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = async (placeId: string) => {
    if (!placesService.current) return;

    setIsLoading(true);
    setError(null);

    try {
      const place = await new Promise<google.maps.places.PlaceResult>((resolve, reject) => {
        placesService.current!.getDetails(
          {
            placeId: placeId,
            fields: ['formatted_address', 'geometry', 'name', 'types'],
          },
          (result, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && result) {
              resolve(result);
            } else {
              reject(new Error('Failed to get place details'));
            }
          }
        );
      });

      if (place.geometry?.location) {
        const coordinates = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        };
        onChange(place.formatted_address || '', coordinates, place.name || '');
      }
    } catch (err) {
      console.error('Place details error:', err);
      setError('Failed to get location details');
    } finally {
      setIsLoading(false);
      setIsOpen(false);
    }
  };

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="relative">
      <div ref={mapRef} className="hidden" />
      <div className="relative">
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            handleSearch(e.target.value);
          }}
          placeholder={placeholder}
          className={className}
        />
        {isLoading && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        )}
      </div>
      {isOpen && predictions.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-md border bg-popover shadow-md">
          <Command>
            <CommandList>
              <CommandGroup>
                <ScrollArea className="h-[200px]">
                  {predictions.map((prediction) => (
                    <CommandItem
                      key={prediction.place_id}
                      onSelect={() => handleSelect(prediction.place_id)}
                      className="flex items-center gap-2 px-4 py-2 hover:bg-accent cursor-pointer"
                    >
                      <MapPin className="h-4 w-4 shrink-0" />
                      <div className="flex flex-col">
                        <span className="text-sm">{prediction.structured_formatting.main_text}</span>
                        <span className="text-xs text-muted-foreground">
                          {prediction.structured_formatting.secondary_text}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </ScrollArea>
              </CommandGroup>
              {predictions.length === 0 && (
                <CommandEmpty>No locations found</CommandEmpty>
              )}
            </CommandList>
          </Command>
        </div>
      )}
    </div>
  );
}