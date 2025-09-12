import { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, MapPin } from 'lucide-react';

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
  const [isGoogleMapsReady, setIsGoogleMapsReady] = useState(false);
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Handle input ref callback
  useEffect(() => {
    if (onInputRef && inputRef.current) {
      onInputRef(inputRef.current);
    }
  }, [onInputRef]);

  // Initialize Google Maps services when available
  useEffect(() => {
    const initializeServices = () => {
      if (window.google && window.google.maps && window.google.maps.places) {
        try {
          autocompleteService.current = new google.maps.places.AutocompleteService();
          if (mapRef.current) {
            placesService.current = new google.maps.places.PlacesService(mapRef.current);
          }
          setIsGoogleMapsReady(true);
          setError(null); // Clear any error when successfully initialized
          return true;
        } catch (error) {
          console.error('Error initializing Google Places services:', error);
          return false;
        }
      }
      return false;
    };

    // Try to initialize immediately
    if (!initializeServices()) {
      // If not ready, poll until ready
      const interval = setInterval(() => {
        if (initializeServices()) {
          clearInterval(interval);
        }
      }, 1000);

      // Clear interval after 30 seconds (increase timeout)
      const timeout = setTimeout(() => {
        clearInterval(interval);
        // Only show error if Google Maps truly didn't load
        if (!window.google || !window.google.maps) {
          setError('Google Maps failed to load. Please refresh the page.');
        }
      }, 30000);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, []);

  const handleSearch = useCallback(async (searchValue: string) => {
    if (!searchValue || !autocompleteService.current || !isGoogleMapsReady) {
      setPredictions([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let locationBias: google.maps.places.AutocompletionRequest['locationBias'] | undefined;

      if (searchBias && searchBias.lat && searchBias.lng) {
        const radius = searchBias.radius || 50000; // Default 50km radius
        const location = new google.maps.LatLng(searchBias.lat, searchBias.lng);

        locationBias = {
          center: location,
          radius: radius
        };
      }

      const response = await autocompleteService.current.getPlacePredictions({
        input: searchValue,
        types: ['establishment', 'geocode'],
        locationBias: locationBias
      });

      // Sort predictions by distance if we have location bias
      if (searchBias && response.predictions.length > 0) {
        const location = new google.maps.LatLng(searchBias.lat, searchBias.lng);

        // Calculate distances and sort
        const predictionsWithDistance = await Promise.all(
          response.predictions.map(async (prediction) => {
            try {
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
            } catch (error) {
              return { prediction, distance: Infinity };
            }
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
      setIsOpen(false);
    } finally {
      setIsLoading(false);
    }
  }, [searchBias, isGoogleMapsReady]);

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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    handleSearch(newValue);
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
          onChange={handleInputChange}
          onFocus={() => {
            if (predictions.length > 0) {
              setIsOpen(true);
            }
          }}
          onBlur={() => {
            // Delay hiding to allow for click events
            setTimeout(() => setIsOpen(false), 200);
          }}
          placeholder={placeholder}
          className={className}
          disabled={!isGoogleMapsReady}
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