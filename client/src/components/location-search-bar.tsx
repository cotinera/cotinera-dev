import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import { MapPin } from "lucide-react";

interface LocationSearchBarProps {
  value: string;
  onChange: (address: string, coordinates?: { lat: number; lng: number }) => void;
  placeholder?: string;
  className?: string;
}

export function LocationSearchBar({
  value,
  onChange,
  placeholder = "Search for a location...",
  className,
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
    // Create a hidden map element for PlacesService
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
      const response = await autocompleteService.current.getPlacePredictions({
        input: searchValue,
        types: ['(cities)'],
      });

      setPredictions(response.predictions);
      setIsOpen(true);
    } catch (err) {
      console.error('Autocomplete error:', err);
      setError('Failed to load suggestions');
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
        <Command className="absolute top-full left-0 right-0 z-50 mt-1 overflow-hidden rounded-md border bg-popover shadow-md">
          <CommandGroup>
            {predictions.map((prediction) => (
              <CommandItem
                key={prediction.place_id}
                onSelect={() => handleSelect(prediction.place_id)}
                className="flex items-center gap-2 px-4 py-2 hover:bg-accent"
              >
                <MapPin className="h-4 w-4" />
                <span>{prediction.description}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          {predictions.length === 0 && (
            <CommandEmpty>No locations found</CommandEmpty>
          )}
        </Command>
      )}
    </div>
  );
}
