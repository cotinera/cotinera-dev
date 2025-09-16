import { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, MapPin, Star, Clock, Phone, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PlaceDetailsSheet } from './place-details-sheet';

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
  showDetailedView?: boolean; // When true, shows detailed sidebar instead of immediate selection
  onShowPlaceDetails?: (placeId: string) => void; // Callback to show place details in sidebar
}

interface EnhancedPrediction {
  place_id: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  opening_hours?: {
    open_now: boolean;
  };
  types: string[];
  photos?: google.maps.places.PlacePhoto[];
  geometry?: {
    location: {
      lat: () => number;
      lng: () => number;
    };
  };
}

const getPlaceCategory = (types: string[]) => {
  const priorityTypes = {
    restaurant: 'Restaurant',
    food: 'Food',
    lodging: 'Hotel',
    tourist_attraction: 'Attraction',
    shopping_mall: 'Shopping',
    store: 'Store',
    hospital: 'Hospital',
    bank: 'Bank',
    gas_station: 'Gas Station',
    park: 'Park'
  };
  
  for (const [type, label] of Object.entries(priorityTypes)) {
    if (types.includes(type)) {
      return label;
    }
  }
  
  return types[0]?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Place';
};

export function LocationSearchBar({
  value,
  onChange,
  placeholder = "Search for a location...",
  className,
  searchBias,
  onInputRef,
  showDetailedView = false,
  onShowPlaceDetails,
}: LocationSearchBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [predictions, setPredictions] = useState<EnhancedPrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGoogleMapsReady, setIsGoogleMapsReady] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [isPlaceDetailsOpen, setIsPlaceDetailsOpen] = useState(false);
  const sessionToken = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Handle input ref callback
  useEffect(() => {
    if (onInputRef && inputRef.current) {
      onInputRef(inputRef.current);
    }
  }, [onInputRef]);

  // Initialize Google Maps and session token when available
  useEffect(() => {
    const initializeServices = () => {
      if (window.google && window.google.maps && window.google.maps.places) {
        try {
          // Create a new session token for the autocomplete session
          sessionToken.current = new google.maps.places.AutocompleteSessionToken();
          setIsGoogleMapsReady(true);
          setError(null);
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

      // Clear interval after 30 seconds
      const timeout = setTimeout(() => {
        clearInterval(interval);
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
    if (!searchValue || !isGoogleMapsReady || !sessionToken.current) {
      setPredictions([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Prepare the autocomplete request using new API
      const request: google.maps.places.AutocompleteRequest = {
        input: searchValue,
        sessionToken: sessionToken.current,
        includedPrimaryTypes: ['establishment', 'geocode'],
        language: 'en-US',
        region: 'us',
      };

      // Add location bias if provided
      if (searchBias && searchBias.lat && searchBias.lng) {
        const radius = searchBias.radius || 50000;
        request.locationBias = {
          circle: {
            center: {
              latitude: searchBias.lat,
              longitude: searchBias.lng
            },
            radius: radius
          }
        };
      }

      // Use the new AutocompleteSuggestion API
      const { suggestions } = await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions(request);

      // Convert suggestions to our enhanced prediction format
      const enhancedPredictions: EnhancedPrediction[] = await Promise.all(
        suggestions.slice(0, 8).map(async (suggestion) => {
          try {
            // Fetch place details using the new Place API
            const place = new google.maps.places.Place({
              id: suggestion.placePrediction?.placeId || '',
              requestedLanguage: 'en-US'
            });

            // Fetch fields we need
            await place.fetchFields({
              fields: ['rating', 'userRatingCount', 'priceLevel', 'regularOpeningHours', 'types', 'photos', 'location', 'displayName', 'formattedAddress']
            });

            return {
              place_id: suggestion.placePrediction?.placeId || '',
              structured_formatting: {
                main_text: suggestion.placePrediction?.structuredFormat?.mainText?.text || '',
                secondary_text: suggestion.placePrediction?.structuredFormat?.secondaryText?.text || ''
              },
              rating: place.rating,
              user_ratings_total: place.userRatingCount,
              price_level: place.priceLevel,
              opening_hours: place.regularOpeningHours ? {
                open_now: place.regularOpeningHours.openNow || false
              } : undefined,
              types: place.types || [],
              photos: place.photos || [],
              geometry: place.location ? {
                location: {
                  lat: () => place.location!.lat(),
                  lng: () => place.location!.lng()
                }
              } : undefined
            } as EnhancedPrediction;
          } catch {
            // Fallback to basic prediction data if place details fail
            return {
              place_id: suggestion.placePrediction?.placeId || '',
              structured_formatting: {
                main_text: suggestion.placePrediction?.structuredFormat?.mainText?.text || '',
                secondary_text: suggestion.placePrediction?.structuredFormat?.secondaryText?.text || ''
              },
              types: [],
            } as EnhancedPrediction;
          }
        })
      );

      // Sort enhanced predictions by distance if we have location bias and geometry
      if (searchBias && enhancedPredictions.length > 0) {
        const biasLocation = new google.maps.LatLng(searchBias.lat, searchBias.lng);

        const predictionsWithDistance = enhancedPredictions.map((prediction) => {
          try {
            if (prediction.geometry?.location) {
              const distance = google.maps.geometry.spherical.computeDistanceBetween(
                biasLocation,
                new google.maps.LatLng(
                  prediction.geometry.location.lat(),
                  prediction.geometry.location.lng()
                )
              );
              return { prediction, distance };
            } else {
              return { prediction, distance: Infinity };
            }
          } catch {
            return { prediction, distance: Infinity };
          }
        });

        // Sort by distance
        predictionsWithDistance.sort((a, b) => a.distance - b.distance);
        setPredictions(predictionsWithDistance.map(item => item.prediction));
      } else {
        setPredictions(enhancedPredictions);
      }

      setIsOpen(true);
    } catch (err) {
      console.error('Autocomplete error:', err);
      if (err instanceof Error) {
        if (err.message.includes('ZERO_RESULTS')) {
          setPredictions([]);
          setIsOpen(false);
        } else if (err.message.includes('OVER_QUERY_LIMIT')) {
          setError('Search quota exceeded. Please try again later.');
        } else if (err.message.includes('INVALID_REQUEST')) {
          setError('Invalid search request. Please try different criteria.');
        } else {
          setError('Failed to load suggestions. Please try again.');
        }
      } else {
        setError('Failed to load suggestions. Please try again.');
      }
      setPredictions([]);
      setIsOpen(false);
    } finally {
      setIsLoading(false);
    }
  }, [searchBias, isGoogleMapsReady]);

  const handleSelect = (placeId: string) => {
    setIsOpen(false);
    
    // Create a new session token for the next search session
    sessionToken.current = new google.maps.places.AutocompleteSessionToken();
    
    if (showDetailedView && onShowPlaceDetails) {
      // For interactive map - show place details in sidebar
      onShowPlaceDetails(placeId);
    } else {
      // For calendar/other contexts - show bottom sheet
      setSelectedPlaceId(placeId);
      setIsPlaceDetailsOpen(true);
    }
  };

  const handlePlaceSelect = (address: string, coordinates: { lat: number; lng: number }, name: string) => {
    onChange(address, coordinates, name);
    setIsPlaceDetailsOpen(false);
    setSelectedPlaceId(null);
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
                      className="flex items-start gap-3 px-4 py-3 hover:bg-accent cursor-pointer"
                    >
                      <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium truncate">{prediction.structured_formatting.main_text}</span>
                          {prediction.rating && (
                            <div className="flex items-center gap-1">
                              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                              <span className="text-xs font-medium">{prediction.rating.toFixed(1)}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-muted-foreground truncate">
                            {prediction.structured_formatting.secondary_text}
                          </span>
                          {prediction.types.length > 0 && (
                            <Badge variant="secondary" className="text-xs px-1.5 py-0.5 h-auto">
                              {getPlaceCategory(prediction.types)}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {prediction.opening_hours?.open_now !== undefined && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span className={cn(
                                prediction.opening_hours.open_now ? "text-green-600" : "text-red-600"
                              )}>
                                {prediction.opening_hours.open_now ? "Open" : "Closed"}
                              </span>
                            </div>
                          )}
                          {prediction.price_level && (
                            <span className="text-green-600 font-medium">
                              {'$'.repeat(prediction.price_level)}
                            </span>
                          )}
                          {prediction.user_ratings_total && (
                            <span>({prediction.user_ratings_total} reviews)</span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
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
      
      {!showDetailedView && (
        <PlaceDetailsSheet
          open={isPlaceDetailsOpen}
          onOpenChange={setIsPlaceDetailsOpen}
          placeId={selectedPlaceId}
          onSelectPlace={handlePlaceSelect}
        />
      )}
    </div>
  );
}