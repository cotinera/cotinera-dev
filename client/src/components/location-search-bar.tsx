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
  onChange: (address: string, coordinates?: { lat: number; lng: number }) => void;
  placeholder?: string;
  className?: string;
  searchBias?: {
    lat: number;
    lng: number;
    radius?: number;
  };
}

export function LocationSearchBar({
  value,
  onChange,
  placeholder = "Search for a location...",
  className,
  searchBias,
}: LocationSearchBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!window.google) return;

    autocompleteService.current = new google.maps.places.AutocompleteService();
    if (mapRef.current) {
      placesService.current = new google.maps.places.PlacesService(mapRef.current);
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
      // Create location bias using bounds instead of circle
      let locationBias: google.maps.places.AutocompletionRequest['bounds'] | undefined;

      if (searchBias && searchBias.lat && searchBias.lng) {
        const radius = searchBias.radius || 50000; // Default 50km radius
        const metersPerDegree = 111320; // Approximate meters per degree at the equator
        const latDelta = radius / metersPerDegree;
        const lngDelta = radius / (metersPerDegree * Math.cos(searchBias.lat * Math.PI / 180));

        locationBias = new google.maps.LatLngBounds(
          new google.maps.LatLng(searchBias.lat - latDelta, searchBias.lng - lngDelta),
          new google.maps.LatLng(searchBias.lat + latDelta, searchBias.lng + lngDelta)
        );
      }

      const response = await autocompleteService.current.getPlacePredictions({
        input: searchValue,
        types: ['establishment', 'geocode'],
        bounds: locationBias,
      });

      setPredictions(response.predictions);
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
            fields: ['formatted_address', 'geometry', 'name'],
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
        onChange(place.formatted_address || place.name || '', coordinates);
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