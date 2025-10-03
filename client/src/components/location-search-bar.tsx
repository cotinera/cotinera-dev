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
  activeCategory?: string; // Active category for biasing suggestions
  mapRef?: React.RefObject<google.maps.Map>; // Map reference for animation
}

interface BasicPrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
  types: string[];
  terms: Array<{ offset: number; value: string }>;
  distance_meters?: number;
  matched_substrings: Array<{ length: number; offset: number }>;
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
  
  // Filter out technical types like 'geocode', 'establishment', 'point_of_interest'
  const filteredTypes = types.filter(type => 
    !['geocode', 'establishment', 'point_of_interest'].includes(type)
  );
  
  return filteredTypes[0]?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || null;
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
  activeCategory,
  mapRef,
}: LocationSearchBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [predictions, setPredictions] = useState<BasicPrediction[]>([]);
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGoogleMapsReady, setIsGoogleMapsReady] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [isPlaceDetailsOpen, setIsPlaceDetailsOpen] = useState(false);
  const [lastSearchValue, setLastSearchValue] = useState('');
  const [isPrewarmed, setIsPrewarmed] = useState(false);
  const sessionToken = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);
  const dummyMapRef = useRef<HTMLDivElement | null>(null);
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
          // Initialize AutocompleteService and PlacesService
          autocompleteService.current = new google.maps.places.AutocompleteService();
          
          // Create a dummy map element for PlacesService
          const dummyMapEl = document.createElement('div');
          placesService.current = new google.maps.places.PlacesService(dummyMapEl);
          
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

  const handleSearch = useCallback((searchValue: string, isLeadingEdge = false) => {
    if (!searchValue || !isGoogleMapsReady || !autocompleteService.current || !sessionToken.current) {
      setPredictions([]);
      setIsOpen(false);
      return;
    }

    // For first character or immediate search, execute without debounce
    if (isLeadingEdge || (lastSearchValue === '' && searchValue.length === 1)) {
      performSearch(searchValue);
      setLastSearchValue(searchValue);
      return;
    }

    // Clear existing debounce timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    // Set new debounce timer
    const timer = setTimeout(async () => {
      performSearch(searchValue);
    }, 130); // 130ms debounce for faster response

    setDebounceTimer(timer);
    setLastSearchValue(searchValue);
  }, [searchBias, isGoogleMapsReady, activeCategory, debounceTimer, lastSearchValue]);

  const performSearch = useCallback(async (searchValue: string) => {
    setIsLoading(true);
    setError(null);

    try {
        // Prepare the autocomplete request
        const request: google.maps.places.AutocompletionRequest = {
          input: searchValue,
          sessionToken: sessionToken.current!,
          types: ['establishment', 'geocode'],
          language: 'en-US',
          componentRestrictions: { country: 'us' },
        };

        // Add location bias if provided
        if (searchBias && searchBias.lat && searchBias.lng) {
          const radius = searchBias.radius || 50000;
          request.bounds = new google.maps.LatLngBounds(
            new google.maps.LatLng(
              searchBias.lat - (radius / 111320), // Rough conversion from meters to degrees
              searchBias.lng - (radius / (111320 * Math.cos(searchBias.lat * Math.PI / 180)))
            ),
            new google.maps.LatLng(
              searchBias.lat + (radius / 111320),
              searchBias.lng + (radius / (111320 * Math.cos(searchBias.lat * Math.PI / 180)))
            )
          );
          
          // Also set location for better biasing
          request.location = new google.maps.LatLng(searchBias.lat, searchBias.lng);
          request.radius = radius;
        }

        // Note: We don't filter by category types to preserve exact matches
        // Category biasing will be handled client-side in ranking

        // Use AutocompleteService to get predictions
        const predictions = await new Promise<google.maps.places.AutocompletePrediction[]>((resolve, reject) => {
          autocompleteService.current!.getPlacePredictions(request, (results, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && results) {
              resolve(results);
            } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
              resolve([]);
            } else {
              reject(new Error(`Autocomplete failed: ${status}`));
            }
          });
        });

        // Convert to our format and rank by category relevance
        let rankedPredictions = predictions.slice(0, 8);
        
        // Apply client-side category ranking if activeCategory is set
        if (activeCategory) {
          const categoryTypes: Record<string, string[]> = {
            'restaurants': ['restaurant', 'food', 'meal_takeaway', 'cafe'],
            'hotels': ['lodging', 'hotel', 'motel'],
            'attractions': ['tourist_attraction', 'museum', 'amusement_park', 'zoo'],
            'shopping': ['shopping_mall', 'store', 'clothing_store', 'department_store']
          };
          
          const relevantTypes = categoryTypes[activeCategory] || [];
          
          rankedPredictions = rankedPredictions.sort((a, b) => {
            const aHasRelevantType = a.types?.some(type => relevantTypes.includes(type)) || false;
            const bHasRelevantType = b.types?.some(type => relevantTypes.includes(type)) || false;
            
            // Prioritize exact matches first (when search term matches main text closely)
            const searchLower = searchValue.toLowerCase();
            const aExactMatch = a.structured_formatting?.main_text?.toLowerCase().includes(searchLower) || false;
            const bExactMatch = b.structured_formatting?.main_text?.toLowerCase().includes(searchLower) || false;
            
            if (aExactMatch && !bExactMatch) return -1;
            if (!aExactMatch && bExactMatch) return 1;
            
            // Then prioritize category matches
            if (aHasRelevantType && !bHasRelevantType) return -1;
            if (!aHasRelevantType && bHasRelevantType) return 1;
            
            return 0; // Keep original order for same ranking
          });
        }
        
        // Limit to 6 items for faster rendering
        const basicPredictions: BasicPrediction[] = rankedPredictions.slice(0, 6).map((prediction) => ({
          place_id: prediction.place_id,
          description: prediction.description,
          structured_formatting: {
            main_text: prediction.structured_formatting.main_text,
            secondary_text: prediction.structured_formatting.secondary_text
          },
          types: prediction.types || [],
          terms: prediction.terms || [],
          distance_meters: prediction.distance_meters,
          matched_substrings: prediction.matched_substrings || []
        }));

        setPredictions(basicPredictions);
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
  }, [searchBias, isGoogleMapsReady, activeCategory]);

  const handleSelect = async (placeId: string) => {
    setIsOpen(false);
    setIsLoading(true);
    
    try {
      if (!placesService.current || !sessionToken.current) {
        throw new Error('Places service not initialized');
      }

      // Get minimal place information first for quick display
      const minimalPlaceDetails = await new Promise<google.maps.places.PlaceResult>((resolve, reject) => {
        placesService.current!.getDetails(
          {
            placeId: placeId,
            fields: [
              'place_id',
              'name', 
              'formatted_address',
              'geometry',
              'types'
            ],
            sessionToken: sessionToken.current!
          },
          (result, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && result) {
              resolve(result);
            } else {
              reject(new Error(`Place details failed: ${status}`));
            }
          }
        );
      });
      
      // Create a new session token for the next search session
      sessionToken.current = new google.maps.places.AutocompleteSessionToken();
      
      if (!minimalPlaceDetails.geometry?.location) {
        throw new Error('Place has no geometry');
      }
      
      const coordinates = {
        lat: minimalPlaceDetails.geometry.location.lat(),
        lng: minimalPlaceDetails.geometry.location.lng()
      };
      
      // PARALLEL EXECUTION: Start animation and show sheet immediately
      
      // 1. Show place details immediately with minimal data
      if (showDetailedView && onShowPlaceDetails) {
        onShowPlaceDetails(placeId);
      } else {
        setSelectedPlaceId(placeId);
        setIsPlaceDetailsOpen(true);
      }
      
      // 2. Start map animation in parallel (if map is available)
      if (mapRef?.current && searchBias) {
        // Helper function to calculate distance
        const calculateDistance = (point1: { lat: number; lng: number }, point2: { lat: number; lng: number }): number => {
          const R = 6371;
          const dLat = (point2.lat - point1.lat) * Math.PI / 180;
          const dLon = (point2.lng - point1.lng) * Math.PI / 180;
          const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
                    Math.sin(dLon/2) * Math.sin(dLon/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          return R * c;
        };
        
        // Start smooth map animation (non-blocking)
        const smoothMapAnimation = (
          mapRef: React.RefObject<google.maps.Map>,
          currentCoordinates: { lat: number; lng: number },
          targetCoordinates: { lat: number; lng: number }
        ) => {
          if (!mapRef.current) return;
          
          const currentZoom = mapRef.current.getZoom() || 12;
          const distance = calculateDistance(currentCoordinates, targetCoordinates);
          
          let midZoom;
          if (distance < 1) midZoom = Math.max(currentZoom - 1, 10);
          else if (distance < 5) midZoom = Math.max(currentZoom - 2, 9);
          else if (distance < 20) midZoom = Math.max(currentZoom - 3, 8);
          else midZoom = Math.max(currentZoom - 4, 7);
          
          const finalZoom = 16;
          let step = 0;
          const totalSteps = 30; // Reduced for faster animation
          const initialZoom = currentZoom;
          
          const animate = () => {
            if (!mapRef.current) return;
            
            step++;
            const easingFactor = Math.sin(Math.PI * step / totalSteps) * 0.5 + 0.5;
            const frameProgress = step / totalSteps;
            
            let currentStepZoom;
            if (frameProgress < 0.3) {
              currentStepZoom = initialZoom - (initialZoom - midZoom) * (frameProgress * 3.33);
            } else if (frameProgress < 0.7) {
              currentStepZoom = midZoom;
            } else {
              const zoomInProgress = (frameProgress - 0.7) * 3.33;
              currentStepZoom = midZoom + (finalZoom - midZoom) * zoomInProgress;
            }
            
            const lat = currentCoordinates.lat + (targetCoordinates.lat - currentCoordinates.lat) * easingFactor;
            const lng = currentCoordinates.lng + (targetCoordinates.lng - currentCoordinates.lng) * easingFactor;
            
            mapRef.current.setZoom(currentStepZoom);
            mapRef.current.setCenter({ lat, lng });
            
            if (step < totalSteps) {
              requestAnimationFrame(animate);
            } else {
              mapRef.current.setZoom(finalZoom);
              mapRef.current.setCenter(targetCoordinates);
            }
          };
          
          animate();
        };
        
        // Start animation (non-blocking)
        smoothMapAnimation(mapRef, searchBias, coordinates);
      }
      
    } catch (err) {
      console.error('Error selecting place:', err);
      setError('Failed to load place details. Please try again.');
      
      // Create a new session token for the next search session
      sessionToken.current = new google.maps.places.AutocompleteSessionToken();
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlaceSelect = (address: string, coordinates: { lat: number; lng: number }, name: string) => {
    onChange(address, coordinates, name);
    setIsPlaceDetailsOpen(false);
    setSelectedPlaceId(null);
    
    // Create a new session token for the next search session
    sessionToken.current = new google.maps.places.AutocompleteSessionToken();
  };

  // Pre-warm services on focus for faster first search
  const handleInputFocus = () => {
    if (!isPrewarmed && isGoogleMapsReady && autocompleteService.current) {
      // Pre-warm with a dummy search to initialize caches
      const dummyRequest: google.maps.places.AutocompletionRequest = {
        input: ' ', // Minimal input
        types: ['establishment'],
        language: 'en-US',
        componentRestrictions: { country: 'us' },
      };
      
      autocompleteService.current.getPlacePredictions(dummyRequest, () => {
        // Ignore results, just pre-warm the service
      });
      
      setIsPrewarmed(true);
    }
    
    if (predictions.length > 0) {
      setIsOpen(true);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    
    // If this is the first keystroke of a new search session, create a new session token
    if (!sessionToken.current || lastSearchValue === '') {
      sessionToken.current = new google.maps.places.AutocompleteSessionToken();
    }
    
    handleSearch(newValue);
  };
  
  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [debounceTimer]);

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="relative">
      <div ref={mapRef as any} className="hidden" />
      <div className="relative">
        <Input
          ref={inputRef}
          value={value}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
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
                        </div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-muted-foreground truncate">
                            {prediction.structured_formatting.secondary_text}
                          </span>
                          {prediction.types.length > 0 && getPlaceCategory(prediction.types) && (
                            <Badge variant="secondary" className="text-xs px-1.5 py-0.5 h-auto">
                              {getPlaceCategory(prediction.types)}
                            </Badge>
                          )}
                        </div>
                        {prediction.distance_meters && (
                          <div className="text-xs text-muted-foreground">
                            {prediction.distance_meters < 1000 
                              ? `${prediction.distance_meters}m away`
                              : `${(prediction.distance_meters / 1000).toFixed(1)}km away`
                            }
                          </div>
                        )}
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