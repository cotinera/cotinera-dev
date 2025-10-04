import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { Loader2, Search, MapPin, Phone, Globe, Star, Clock, X, Plus, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Image, Building2, Calendar, Utensils, Hotel, Camera, Building, DollarSign } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAccommodations } from "@/hooks/use-accommodations";
import { cn } from "@/lib/utils";
import { useGoogleMapsScript, useMapCoordinates, GoogleMap, MarkerF, PlaceDetails, PinnedPlace, SearchResultMarkers, useSearchResultMarkers } from "@/lib/google-maps";
import type { PlaceSearchResult } from "@/lib/google-maps";
import { LocationSearchBar } from "@/components/location-search-bar";
import { IconPicker } from "@/components/icon-picker";
import { PlaceDetailsSidebar } from "@/components/place-details-sidebar";
import { CategoryPills, CategoryId } from "@/components/map/CategoryPills";
import { ResultsList } from "@/components/map/ResultsList";
import { SearchResultsPanel } from "@/components/map/SearchResultsPanel";
import { PlacesSearchService } from "@/lib/places/search";
import type { PlaceSearchResult as SearchServiceResult, SearchFilters } from "@/lib/places/search";
import { useSearchStateAdapter } from "@/hooks/use-search-state-adapter";

// Helpers and components
function calculateDistance(point1: { lat: number; lng: number }, point2: { lat: number; lng: number }): number {
  const R = 6371; // Earth's radius in km
  const dLat = (point2.lat - point1.lat) * Math.PI / 180;
  const dLon = (point2.lng - point1.lng) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Smooth map animation function for transitions between locations
const smoothMapAnimation = (
  mapRef: React.RefObject<google.maps.Map>,
  currentCoordinates: { lat: number; lng: number },
  targetCoordinates: { lat: number; lng: number },
  onComplete?: () => void
) => {
  if (!mapRef.current) return;
  
  // Get current zoom and position
  const currentZoom = mapRef.current.getZoom() || 12;
  
  // Calculate zoom levels for animation - find best values for different distance ranges
  const distance = calculateDistance(currentCoordinates, targetCoordinates);
  
  // Adjust zoom level based on distance between points for better spatial context
  let midZoom;
  if (distance < 1) { // Very close points (<1km)
    midZoom = Math.max(currentZoom - 1, 10); // Minimal zoom out
  } else if (distance < 5) { // Close points (1-5km)
    midZoom = Math.max(currentZoom - 2, 9);
  } else if (distance < 20) { // Medium distance (5-20km)
    midZoom = Math.max(currentZoom - 3, 8);
  } else { // Long distance (>20km)
    midZoom = Math.max(currentZoom - 4, 7); // More zoom out to see relation
  }
  
  const finalZoom = 16; // Standardized final zoom level for better context
  
  // Animation parameters
  let step = 0;
  const totalSteps = 36; // More steps for smoother animation
  const initialZoom = currentZoom;
  
  // Animation function
  const animate = () => {
    if (!mapRef.current) return;
    
    step++;
    
    // Create an easing function for smoother transitions
    const easingFactor = Math.sin(Math.PI * step / totalSteps) * 0.5 + 0.5;
    
    // Calculate the current position in the animation
    const frameProgress = step / totalSteps;
    
    // Determine the current zoom level
    let currentStepZoom;
    if (frameProgress < 0.3) {
      // First third: zoom out
      currentStepZoom = initialZoom - (initialZoom - midZoom) * (frameProgress * 3.33);
    } else if (frameProgress < 0.7) {
      // Middle portion: stay at mid zoom
      currentStepZoom = midZoom;
    } else {
      // Last third: zoom in to final
      const zoomInProgress = (frameProgress - 0.7) * 3.33;
      currentStepZoom = midZoom + (finalZoom - midZoom) * zoomInProgress;
    }
    
    // Calculate current lat/lng with easing
    const lat = currentCoordinates.lat + (targetCoordinates.lat - currentCoordinates.lat) * easingFactor;
    const lng = currentCoordinates.lng + (targetCoordinates.lng - currentCoordinates.lng) * easingFactor;
    
    // Update the map
    mapRef.current.setZoom(currentStepZoom);
    mapRef.current.setCenter({ lat, lng });
    
    // Continue animation until complete
    if (step < totalSteps) {
      requestAnimationFrame(animate);
    } else {
      // Animation complete
      mapRef.current.setZoom(finalZoom);
      mapRef.current.setCenter(targetCoordinates);
      if (onComplete) onComplete();
    }
  };
  
  // Start the animation
  animate();
};

// Category buttons for map filtering
const categoryButtons = [
  {
    id: "restaurants",
    label: "Restaurants",
    icon: <Utensils className="h-4 w-4" />,
    type: ["restaurant"],
    searchTerms: ["restaurant", "food", "eat", "dining", "cafe", "coffee", "breakfast", "lunch", "dinner"]
  },
  {
    id: "hotels",
    label: "Hotels",
    icon: <Hotel className="h-4 w-4" />,
    type: ["lodging"],
    searchTerms: ["hotel", "lodging", "stay", "accommodation", "motel", "hostel", "airbnb", "bed and breakfast"]
  },
  {
    id: "attractions",
    label: "Attractions",
    icon: <Camera className="h-4 w-4" />,
    type: ["tourist_attraction"],
    searchTerms: ["attraction", "sightseeing", "tourism", "museum", "landmark", "monument", "gallery", "park", "tour"]
  },
  {
    id: "shopping",
    label: "Shopping",
    icon: <Building className="h-4 w-4" />,
    type: ["shopping_mall"],
    searchTerms: ["shopping", "store", "mall", "shop", "retail", "market", "boutique", "outlet"]
  }
];

// Sub-filters for more detailed filtering
const subFilters = [
  {
    id: "rating",
    label: "Rating",
    icon: <Star className="h-4 w-4" />,
    options: [
      { id: "rating-any", label: "Any", value: 0 },
      { id: "rating-3", label: "3+ stars", value: 3 },
      { id: "rating-4", label: "4+ stars", value: 4 },
      { id: "rating-4.5", label: "4.5+ stars", value: 4.5 }
    ]
  },
  {
    id: "price",
    label: "Price",
    icon: <DollarSign className="h-4 w-4" />,
    options: [
      { id: "price-any", label: "Any", value: null },
      { id: "price-1", label: "$", value: 1 },
      { id: "price-2", label: "$$", value: 2 },
      { id: "price-3", label: "$$$", value: 3 },
      { id: "price-4", label: "$$$$", value: 4 }
    ]
  },
  {
    id: "hours",
    label: "Opening Hours",
    icon: <Clock className="h-4 w-4" />,
    options: [
      { id: "hours-any", label: "Any", value: null },
      { id: "hours-open", label: "Open Now", value: true }
    ]
  }
];

// Types for component props
interface MapViewProps {
  location: { lat: number; lng: number } | string;
  tripId?: string | number;
  pinnedPlaces?: PinnedPlace[] | { places: PinnedPlace[], tripLocation: { lat: number; lng: number } | null };
  onPinClick?: (place: PinnedPlace) => void;
  onPlaceNameClick?: (place: PinnedPlace) => void;
  className?: string;
  selectedPlace?: PinnedPlace | null;
  hideSearchAndFilters?: boolean;
  showPlaceDetailsSidebar?: boolean;
  selectedPlaceForDetails?: string | null;
  onShowPlaceDetails?: (placeId: string) => void;
  onSelectPlaceFromDetails?: (address: string, coordinates: { lat: number; lng: number }, name: string) => void;
  onClosePlaceDetails?: () => void;
}

// Types for search results
interface SearchResult {
  type: 'category' | 'place';
  id: string;
  description: string;
  placeId?: string;
  icon?: React.ReactNode;
  secondaryText?: string;
}

// Category button interface
interface CategoryButton {
  id: string;
  label: string;
  icon: React.ReactNode;
  type: string[];
  searchTerms: string[];
}

// Sub-filter interface
interface SubFilter {
  id: string;
  label: string;
  icon?: React.ReactNode;
  options: {
    id: string;
    label: string;
    value: any;
  }[];
}

// Activity interface
interface Activity {
  id: number; 
  location: string | null;
  tripId: number;
  title: string;
  description: string | null;
  coordinates: { lat: number; lng: number } | null;
  createdAt: Date | null;
  startTime: Date;
  endTime: Date;
}

// Accommodation interface
interface Accommodation {
  id: string | number;
  name: string;
  coordinates: { lat: number; lng: number } | null;
  checkInTime?: string;
  checkOutTime?: string;
  address?: string;
  location?: string;
}

export function MapView({
  location,
  tripId,
  pinnedPlaces = [],
  onPinClick,
  onPlaceNameClick,
  className,
  selectedPlace,
  hideSearchAndFilters = false,
  showPlaceDetailsSidebar = false,
  selectedPlaceForDetails,
  onShowPlaceDetails,
  onSelectPlaceFromDetails,
  onClosePlaceDetails
}: MapViewProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const mapRef = useRef<google.maps.Map | null>(null);
  const [selectedIcon, setSelectedIcon] = useState('📍'); // Icon for pinning places
  const numericTripId = tripId && !isNaN(Number(tripId)) ? Number(tripId) : 0;
  const { accommodations = [] } = useAccommodations(numericTripId || 0);
  // Category filter state - using CategoryId type from CategoryPills
  const [selectedCategory, setSelectedCategory] = useState<CategoryId | null>(null);
  const [openNow, setOpenNow] = useState(false);
  const [withinMap, setWithinMap] = useState(true);
  const [hoveredResultId, setHoveredResultId] = useState<string | null>(null);
  
  // Legacy state removed - using only new search flow
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchedLocation, setSearchedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  
  // Places search service
  const placesSearchServiceRef = useRef<PlacesSearchService | null>(null);
  
  // Handle both string locations and coordinate objects
  const locationObj = typeof location === 'string' 
    ? undefined  // Will use default in useMapCoordinates
    : location;  // Pass through lat/lng object directly
  
  const { coordinates, setCoordinates } = useMapCoordinates(locationObj || "");
  
  // Search state adapter - provides stable state machine with legacy compatibility
  const {
    searchResults,
    isLoadingSearch,
    hasNextPage,
    selectedResultId,
    isLoadingMore,
    setSelectedResultId,
    performSearch: controllerPerformSearch,
    loadMore: controllerLoadMore,
    sortBy,
    setSortBy,
    updateOnMapMove,
    setUpdateOnMapMove,
    getSortedResults,
    searchState,
    error: searchError,
  } = useSearchStateAdapter(mapRef.current, coordinates);
  
  // Search result markers management - updated to use adapter state
  const {
    markers: searchMarkers,
    selectedPlaceId: selectedSearchPlaceId,
    setSelectedPlaceId: setSelectedSearchPlaceId,
    handleMarkerClick: handleSearchMarkerClick,
  } = useSearchResultMarkers(
    mapRef.current,
    searchResults,
    (place) => {
      if (place.place_id) {
        setSelectedResultId(place.place_id);
        if (onShowPlaceDetails) {
          onShowPlaceDetails(place.place_id);
        } else {
          fetchDetails(place.place_id);
        }
      }
    }
  );

  // Load Google Maps script
  const { isLoaded, loadError, errorMessage } = useGoogleMapsScript();
  
  // If Google Maps fails to load, display an error message
  if (loadError || errorMessage) {
    return (
      <Card className={cn("w-full shadow-md", className)}>
        <div className="p-8 text-center">
          <div className="mb-4 text-red-500">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
          <h3 className="font-bold text-xl mb-2">Map Loading Error</h3>
          <p className="text-muted-foreground mb-4">
            {errorMessage || "Unable to load Google Maps. Please check your API key and internet connection."}
          </p>
          <p className="text-sm text-muted-foreground mb-8">
            Error details: {loadError?.message || "Unknown error. Google Maps API may require billing to be enabled."}
          </p>
          <div className="space-y-2">
            <p className="text-muted-foreground">You can still use other features of the application:</p>
            <div className="flex flex-wrap gap-2 justify-center">
              <Button variant="outline" size="sm">View Trip Details</Button>
              <Button variant="outline" size="sm">Manage Participants</Button>
              <Button variant="outline" size="sm">Track Expenses</Button>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  const initPlacesService = useCallback((map: google.maps.Map) => {
    placesServiceRef.current = new google.maps.places.PlacesService(map);
  }, []);

  const getPlaceDetails = useCallback((placeId: string, callback: (place: PlaceDetails | null, status: google.maps.places.PlacesServiceStatus) => void) => {
    if (!placesServiceRef.current) return;

    placesServiceRef.current.getDetails(
      { placeId, fields: ['name', 'formatted_address', 'geometry', 'photos', 'rating', 'user_ratings_total', 'types', 'price_level', 'website', 'formatted_phone_number', 'opening_hours', 'reviews'] },
      (place, status) => callback(place as PlaceDetails, status)
    );
  }, []);

  const findPlaceByQuery = useCallback((name: string, location: google.maps.LatLng, callback: (placeId: string | null) => void) => {
    if (!placesServiceRef.current) return;

    const request = {
      query: name,
      locationBias: {
        center: location,
        radius: 100
      },
      fields: ['place_id']
    };

    placesServiceRef.current.findPlaceFromQuery(
      request,
      (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results && results[0] && results[0].place_id) {
          callback(results[0].place_id);
        } else {
          callback(null);
        }
      }
    );
  }, []);

  const [searchValue, setSearchValue] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [categorySuggestions, setCategorySuggestions] = useState<SearchResult[]>([]);

  const allPinnedPlaces = useMemo(() => {
    if (!pinnedPlaces) return [];
    if (Array.isArray(pinnedPlaces)) return pinnedPlaces;
    if ('places' in pinnedPlaces) return pinnedPlaces.places;
    return [];
  }, [pinnedPlaces]);
  
  // Convert google.maps.places.PlaceResult to PlaceSearchResult
  const convertPlaceResult = useCallback((place: google.maps.places.PlaceResult): PlaceSearchResult => {
    return {
      place_id: place.place_id || '',
      name: place.name || '',
      formatted_address: place.formatted_address || place.vicinity || '',
      geometry: {
        location: {
          lat: place.geometry?.location?.lat() || 0,
          lng: place.geometry?.location?.lng() || 0,
        },
      },
      rating: place.rating,
      user_ratings_total: place.user_ratings_total,
      price_level: place.price_level,
      opening_hours: place.opening_hours ? {
        open_now: place.opening_hours.open_now || false
      } : undefined,
      types: place.types || [],
      photos: place.photos,
      vicinity: place.vicinity,
      business_status: place.business_status,
    };
  }, []);

  const fetchDetails = useCallback((placeId: string) => {
    if (onShowPlaceDetails) {
      onShowPlaceDetails(placeId);
    }
  }, [onShowPlaceDetails]);

  const handlePlaceNameClick = useCallback(async (place: PinnedPlace) => {
    if (mapRef.current && place.coordinates) {
      // Use our shared animation function for better spatial context
      smoothMapAnimation(
        mapRef, 
        coordinates, 
        place.coordinates,
        // Optional callback when animation completes
        undefined
      );
    }
    
    if (place.placeId) {
      // If we have a placeId, show details directly
      if (onShowPlaceDetails) {
        onShowPlaceDetails(place.placeId);
      } else {
        fetchDetails(place.placeId);
      }
    } else if (place.coordinates && onShowPlaceDetails) {
      // If no placeId but have coordinates, try to find placeId via reverse geocoding
      try {
        const geocoder = new google.maps.Geocoder();
        const result = await geocoder.geocode({ location: place.coordinates });
        
        if (result.results && result.results.length > 0) {
          const firstResult = result.results[0];
          if (firstResult.place_id) {
            onShowPlaceDetails(firstResult.place_id);
          }
        }
      } catch (error) {
        console.error('Error reverse geocoding:', error);
        // Fallback to legacy details if reverse geocoding fails
        fetchDetails(place.placeId || '');
      }
    }
  }, [fetchDetails, coordinates, onShowPlaceDetails]);

  const handleMarkerClick = useCallback(async (item: PinnedPlace | Accommodation | Activity) => {
    if (mapRef.current && 'coordinates' in item && item.coordinates) {
      // Use our shared animation function with easing and better spatial context
      smoothMapAnimation(
        mapRef, 
        coordinates, 
        item.coordinates
      );
    }

    // Resolve to place_id for all items
    if ('placeId' in item && item.placeId) {
      // Already has place_id - show details
      if (onShowPlaceDetails) {
        onShowPlaceDetails(item.placeId);
      }
      onPinClick?.(item as PinnedPlace);
    } else if (item.coordinates) {
      // Try to find place_id via reverse geocoding or findPlaceByQuery
      const query = 'title' in item ? item.title : ('name' in item ? item.name : 'Unnamed Place');
      const latlng = new google.maps.LatLng(item.coordinates.lat, item.coordinates.lng);
      
      findPlaceByQuery(query, latlng, (placeId) => {
        if (placeId && onShowPlaceDetails) {
          onShowPlaceDetails(placeId);
        } else {
          // Fallback to reverse geocoding
          const geocoder = new google.maps.Geocoder();
          geocoder.geocode({ location: item.coordinates }, (results, status) => {
            if (status === 'OK' && results && results.length > 0 && results[0].place_id) {
              if (onShowPlaceDetails) {
                onShowPlaceDetails(results[0].place_id);
              }
            } else {
              toast({
                title: "No details available",
                description: "Could not find details for this location",
                variant: "default",
              });
            }
          });
        }
      });
      
      if ('placeId' in item) {
        onPinClick?.(item as PinnedPlace);
      }
    }
  }, [onPinClick, findPlaceByQuery, coordinates, onShowPlaceDetails, toast]);

  const handleLocalPlaceNameClick = useCallback((place: PinnedPlace) => {
    handlePlaceNameClick(place);
    onPlaceNameClick?.(place);
  }, [onPlaceNameClick, handlePlaceNameClick]);

  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    const event = e as unknown as { placeId?: string; stop?: () => void };
    if (event.stop) event.stop();
    if (!event.placeId) {
      if (onClosePlaceDetails) {
        onClosePlaceDetails();
      }
      return;
    }
    if (onShowPlaceDetails) {
      onShowPlaceDetails(event.placeId);
    }
  }, [onShowPlaceDetails, onClosePlaceDetails]);

  // Search functionality using adapter with stable state machine
  const performSearch = useCallback(async () => {
    if (!mapRef.current) return;
    
    const bounds = withinMap ? mapRef.current.getBounds() : null;
    
    await controllerPerformSearch({
      category: selectedCategory,
      openNow,
      withinMap,
      keyword: '',
      bounds,
    });
  }, [selectedCategory, openNow, withinMap, controllerPerformSearch]);

  // Load more results using adapter
  const loadMoreResults = useCallback(async () => {
    await controllerLoadMore();
  }, [controllerLoadMore]);

  // Legacy refreshPlaces function removed - using new search flow with PlacesSearchService

  // Effect to trigger search when filters change
  useEffect(() => {
    if (placesSearchServiceRef.current && mapRef.current) {
      performSearch();
    }
  }, [selectedCategory, openNow, withinMap, performSearch]);

  // Handler for category filter changes
  const handleCategoryChange = useCallback((category: CategoryId | null) => {
    setSelectedCategory(category);
  }, []);

  // Handler for open now filter changes
  const handleOpenNowChange = useCallback((openNowValue: boolean) => {
    setOpenNow(openNowValue);
  }, []);

  // Handler for within map filter changes
  const handleWithinMapChange = useCallback((withinMapValue: boolean) => {
    setWithinMap(withinMapValue);
  }, []);


  // Throttle utility for map move events
  const throttleRef = useRef<NodeJS.Timeout | null>(null);
  
  const throttledMapSearch = useCallback(() => {
    if (throttleRef.current) {
      clearTimeout(throttleRef.current);
    }
    
    throttleRef.current = setTimeout(() => {
      if (withinMap && placesSearchServiceRef.current && mapRef.current) {
        performSearch();
      }
    }, 400); // 400ms throttling for optimal performance
  }, [withinMap, performSearch]);

  // Handler for search result clicks
  const handleResultClick = useCallback((result: SearchServiceResult) => {
    setSelectedResultId(result.place_id);
    
    // Animate to result location
    if (mapRef.current) {
      const resultCoords = result.geometry.location;
      smoothMapAnimation(mapRef, coordinates, resultCoords);
    }
    
    // Show place details
    if (onShowPlaceDetails) {
      onShowPlaceDetails(result.place_id);
    } else {
      // Fallback to local place details
      fetchDetails(result.place_id);
    }
  }, [coordinates, onShowPlaceDetails, fetchDetails]);

  // Category click handler using new search flow
  const handleCategoryClick = useCallback((category: CategoryButton) => {
    setSelectedCategory(currentCategory => {
      const newCategory: CategoryId | null = currentCategory === category.id ? null : (category.id as CategoryId);
      return newCategory;
    });
  }, []);

  // Modern map bounds change handler with throttling
  const handleMapBoundsChanged = useCallback(() => {
    // Only trigger search if withinMap filter is enabled
    if (withinMap) {
      throttledMapSearch();
    }
  }, [withinMap, throttledMapSearch]);

  // Cleanup effect for throttled search and map listeners
  useEffect(() => {
    return () => {
      // Cleanup throttled search timeout
      if (throttleRef.current) {
        clearTimeout(throttleRef.current);
      }
      // Cleanup map event listeners
      if (mapRef.current) {
        google.maps.event.clearListeners(mapRef.current, 'bounds_changed');
      }
      // Cleanup places search service
      if (placesSearchServiceRef.current) {
        placesSearchServiceRef.current.destroy();
      }
    };
  }, []);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    initPlacesService(map);
    
    // Initialize the places search service
    placesSearchServiceRef.current = new PlacesSearchService(map);
    
    // Clear any existing listeners
    google.maps.event.clearListeners(map, 'bounds_changed');
    google.maps.event.clearListeners(map, 'idle');
    
    // Add throttled bounds change listener for map movement
    map.addListener('bounds_changed', handleMapBoundsChanged);
    
    // Set initial center explicitly to ensure the map displays properly on first load
    if (coordinates) {
      map.setCenter(coordinates);
      map.setZoom(12);
    }
  }, [initPlacesService, handleMapBoundsChanged, coordinates]);

  const handleSearchSelect = useCallback((result: SearchResult) => {
    if (result.type === 'category') {
      // Handle category selection
      const category = categoryButtons.find(c => c.id === result.id);
      if (category) {
        setSelectedCategory(category.id as CategoryId);
        setSearchValue(category.label);
        setShowSearchResults(false);
      }
    }
  }, []);

  const handleLocationChange = useCallback((address: string, coords?: { lat: number; lng: number }, name?: string) => {
    if (coords) {
      setCoordinates(coords);
      setSearchedLocation(coords);
      
      if (mapRef.current) {
        smoothMapAnimation(
          mapRef, 
          coordinates, 
          coords
        );
      }
      
      // Try to get place details if we have a name
      if (name && placesServiceRef.current) {
        const request = {
          query: name,
          locationBias: {
            center: new google.maps.LatLng(coords.lat, coords.lng),
            radius: 100
          },
          fields: ['place_id']
        };
        
        placesServiceRef.current.findPlaceFromQuery(
          request,
          (results, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && results && results[0] && results[0].place_id) {
              fetchDetails(results[0].place_id);
            }
          }
        );
      }
    }
    setShowSearchResults(false);
  }, [setCoordinates, coordinates, fetchDetails]);

  const handleSavePlace = useCallback(async (placeDetails: any) => {
    if (!tripId) return;

    try {
      const placeCoordinates = placeDetails.geometry?.location
        ? {
            lat: placeDetails.geometry.location.lat(),
            lng: placeDetails.geometry.location.lng(),
          }
        : coordinates;

      const response = await fetch(`/api/trips/${tripId}/pinned-places`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: placeDetails.name,
          placeId: placeDetails.place_id,
          coordinates: placeCoordinates,
          category: placeDetails.types?.[0] || "attraction",
          address: placeDetails.formatted_address,
          icon: selectedIcon,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save place");
      }

      await queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/pinned-places`] });
      toast({
        title: "Place saved",
        description: `${placeDetails.name} has been added to your trip.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save the place. Please try again.",
      });
    }
  }, [tripId, coordinates, selectedIcon, queryClient, toast]);

  const handleAddToItinerary = useCallback(async (placeDetails: any) => {
    toast({
      title: "Coming soon",
      description: "Add to itinerary feature will be available soon!",
    });
  }, [toast]);

  // Check if a place is already pinned
  const isPlacePinned = useCallback((placeId: string) => {
    if (!allPinnedPlaces || allPinnedPlaces.length === 0) return false;
    return allPinnedPlaces.some(p => p.placeId === placeId);
  }, [allPinnedPlaces]);

  const handleFilterChange = useCallback((filterId: string, value: any) => {
    // Legacy filter handling removed - using new CategoryPills component for filters
    // Trigger search with new category selection
    if (selectedCategory) {
      performSearch();
    }
  }, [selectedCategory, performSearch]);

  const handleSearchInputChange = useCallback((value: string) => {
    setSearchValue(value);
    
    // Show categories when searching
    if (value.length >= 2) {
      const matchingCategories = categoryButtons.filter(category =>
        category.searchTerms.some(term =>
          term.toLowerCase().includes(value.toLowerCase()) ||
          value.toLowerCase().includes(term.toLowerCase())
        )
      );
      
      const categoryResults: SearchResult[] = matchingCategories.map(category => ({
        type: 'category',
        id: category.id,
        description: category.label,
        icon: category.icon
      }));
      
      setCategorySuggestions(categoryResults);
      setShowSearchResults(true);
    } else {
      setCategorySuggestions([]);
      setShowSearchResults(false);
      // Clear category when search is cleared
      if (value.trim() === '') {
        setSelectedCategory(null);
      }
    }
  }, []);

  // Create a stable key for selectedPlace to ensure effect runs on every click
  const selectedPlaceKey = selectedPlace 
    ? `${selectedPlace.id}:${selectedPlace.placeId || ''}:${selectedPlace.coordinates?.lat},${selectedPlace.coordinates?.lng}`
    : null;

  // Effect to simulate a search based on a place name if provided
  useEffect(() => {
    if (selectedPlace && mapRef.current && placesServiceRef.current && isLoaded) {
      console.log("Selected place coordinates:", selectedPlace.coordinates);
      console.log("Trip coordinates:", coordinates);
      console.log("Selected coordinates:", searchedLocation);

      // Center map on the selected place (without animation)
      if (selectedPlace.coordinates) {
        mapRef.current.setCenter(selectedPlace.coordinates);
        mapRef.current.setZoom(16);
      }

      // If we have a placeId, fetch details directly
      if (selectedPlace.placeId) {
        console.log('Fetching place details with placeId:', selectedPlace.placeId);
        fetchDetails(selectedPlace.placeId);
      } 
      // Otherwise, try to find place by name + coordinates using Nearby Search
      else if (selectedPlace.name && selectedPlace.coordinates) {
        console.log('No placeId, searching for place:', selectedPlace.name);
        
        // Use Nearby Search to find the place by location and name
        if (placesServiceRef.current) {
          const request = {
            location: new google.maps.LatLng(selectedPlace.coordinates.lat, selectedPlace.coordinates.lng),
            radius: 50, // Very small radius since we have exact coordinates
            keyword: selectedPlace.name
          };
          
          placesServiceRef.current.nearbySearch(request, (results, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
              // Found the place, now get full details with photos
              const foundPlace = results[0];
              console.log('Found place via nearby search:', foundPlace.name, foundPlace.place_id);
              if (foundPlace.place_id) {
                fetchDetails(foundPlace.place_id);
              }
            } else {
              // Still try findPlaceByQuery as fallback
              console.log('Nearby search failed, trying findPlaceByQuery');
              findPlaceByQuery(
                selectedPlace.name,
                new google.maps.LatLng(selectedPlace.coordinates.lat, selectedPlace.coordinates.lng),
                (placeId) => {
                  if (placeId) {
                    fetchDetails(placeId);
                  } else {
                    console.log('All place lookups failed for:', selectedPlace.name);
                    toast({
                      title: "Place not found",
                      description: "Could not find details for this location",
                      variant: "default",
                    });
                  }
                }
              );
            }
          });
        }
      }
    }
  }, [selectedPlaceKey, isLoaded, fetchDetails, findPlaceByQuery, coordinates, searchedLocation]);

  // Removed legacy renderPlaceDetails() - now using PlaceDetailsSidebar exclusively

  // Determine if panels should be visible
  // Left panel shows when there are search results, active filters, or user is searching
  const hasActiveSearch = searchValue.trim().length > 0 || selectedCategory !== null || searchResults.length > 0 || isLoadingSearch;
  const showLeftPanel = !hideSearchAndFilters && hasActiveSearch;
  const showRightPanel = showPlaceDetailsSidebar && !!selectedPlaceForDetails;

  // Dynamic grid layout based on panel visibility
  const getGridClasses = () => {
    if (showLeftPanel && showRightPanel) {
      // Both panels: 3-column layout
      return "grid grid-cols-1 md:grid-cols-[380px_minmax(0,1fr)] lg:grid-cols-[380px_minmax(0,1fr)_380px]";
    } else if (showLeftPanel) {
      // Only left panel: 2-column layout
      return "grid grid-cols-1 md:grid-cols-[380px_minmax(0,1fr)]";
    } else if (showRightPanel) {
      // Only right panel: 2-column layout
      return "grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px]";
    }
    // No panels: full-width centered map
    return "grid grid-cols-1";
  };

  return (
    <Card className={cn("w-full shadow-md relative overflow-hidden", className)}>
      {/* Dynamic Grid Layout: Centered map by default, panels appear when needed */}
      <div className={getGridClasses()}>
        {/* LEFT PANEL: Search Results - Only visible when search is active */}
        {showLeftPanel && (
          <div className="border-r bg-background h-[600px]">
            <SearchResultsPanel
              searchState={isLoadingSearch ? 'LOADING' : searchResults.length > 0 ? 'RENDERED' : 'EMPTY'}
              results={searchResults}
              sortedResults={searchResults}
              isLoading={isLoadingSearch}
              hasNextPage={hasNextPage}
              error={null}
              selectedCategoryLabel={selectedCategory ? categoryButtons.find(c => c.id === selectedCategory)?.label || null : null}
              sortBy="recommended"
              updateOnMapMove={withinMap}
              selectedResultId={selectedResultId}
              hoveredResultId={hoveredResultId}
              onResultClick={handleResultClick}
              onResultHover={setHoveredResultId}
              onSavePlace={async (place, e) => {
                e.stopPropagation();
                if (!tripId) {
                  toast({
                    variant: "destructive",
                    title: "Error",
                    description: "No trip selected",
                  });
                  return;
                }

                try {
                  const placeCoordinates = place.geometry?.location 
                    ? { lat: place.geometry.location.lat, lng: place.geometry.location.lng }
                    : coordinates;

                  const response = await fetch(`/api/trips/${tripId}/pinned-places`, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      name: place.name,
                      placeId: place.place_id,
                      coordinates: placeCoordinates,
                      category: place.types?.[0] || "attraction",
                      address: place.formatted_address || place.vicinity,
                      icon: selectedIcon,
                    }),
                  });

                  if (!response.ok) {
                    throw new Error("Failed to save place");
                  }

                  await queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/pinned-places`] });
                  toast({
                    title: "Place saved",
                    description: `${place.name} has been added to your trip.`,
                  });
                } catch (error) {
                  toast({
                    variant: "destructive",
                    title: "Error",
                    description: "Failed to save the place. Please try again.",
                  });
                }
              }}
              onAddToItinerary={(place, e) => {
                e.stopPropagation();
                // TODO: Implement add to itinerary functionality
                toast({ title: "Add to itinerary feature coming soon!" });
              }}
              onLoadMore={loadMoreResults}
              onSortChange={(sort) => {
                // TODO: Implement sorting
                console.log("Sort by:", sort);
              }}
              onUpdateOnMapMoveChange={setWithinMap}
              onUpdateResultsClick={() => {
                performSearch();
              }}
              mapCenter={coordinates}
              map={mapRef.current}
            />
          </div>
        )}
        
        {/* CENTER PANEL: Map - Always visible */}
        <div className="relative h-[600px]">
          {!hideSearchAndFilters && (
            <div className="absolute top-4 left-4 right-4 z-10 flex flex-col gap-2">
              <div className="relative w-full">
                <LocationSearchBar
                  value={searchValue}
                  onChange={(address, coords, name) => {
                    // Always update the search value when user types
                    setSearchValue(address);
                    
                    // Only handle location change when coordinates are provided (user selected a place)
                    if (coords) {
                      handleLocationChange(address, coords, name);
                    }
                  }}
                  placeholder="Search for places..."
                  className="w-full bg-background/90 backdrop-blur-sm"
                  searchBias={{
                    lat: coordinates.lat,
                    lng: coordinates.lng,
                    radius: 50000
                  }}
                  onInputRef={(ref) => {
                    // Store the input ref for potential focus management
                    if (ref) {
                      (searchInputRef as React.MutableRefObject<HTMLInputElement | null>).current = ref;
                    }
                  }}
                  showDetailedView={showPlaceDetailsSidebar}
                  onShowPlaceDetails={onShowPlaceDetails}
                />
                
                {/* Show category suggestions only when typing */}
                {showSearchResults && categorySuggestions.length > 0 && (
                  <Card className="absolute top-full left-0 right-0 mt-1 max-h-60 overflow-y-auto shadow-lg z-20">
                    <ScrollArea className="p-2">
                      {categorySuggestions.map((result) => (
                        <div
                          key={`${result.type}-${result.id}`}
                          className="flex items-center p-2 hover:bg-muted rounded cursor-pointer"
                          onClick={() => handleSearchSelect(result)}
                        >
                          {result.icon && (
                            <div className="mr-2 text-primary">{result.icon}</div>
                          )}
                          <div className="flex-1 overflow-hidden">
                            <div className="text-sm font-medium truncate">
                              {result.description}
                            </div>
                          </div>
                          <Badge variant="outline" className="ml-2 text-xs">
                            Category
                          </Badge>
                        </div>
                      ))}
                    </ScrollArea>
                  </Card>
                )}
              </div>

              {/* Category Pills Component */}
              <CategoryPills
                selectedCategory={selectedCategory}
                onCategoryChange={handleCategoryChange}
                openNow={openNow}
                onOpenNowChange={handleOpenNowChange}
                withinMap={withinMap}
                onWithinMapChange={handleWithinMapChange}
                className="bg-background/90 backdrop-blur-sm rounded-lg p-3"
              />
            </div>
          )}

          {isLoaded ? (
            <GoogleMap
              mapContainerStyle={{
                width: "100%",
                height: "600px",
              }}
              options={{
                disableDefaultUI: true,
                zoomControl: true,
                clickableIcons: true,
                scrollwheel: true,
                streetViewControl: false,
              }}
              center={coordinates}
              zoom={12}
              onLoad={onMapLoad}
              onClick={handleMapClick}
            >
              {/* Render user-pinned places */}
              {allPinnedPlaces.map((place: PinnedPlace) => (
                <MarkerF
                  key={`pinned-${place.id}`}
                  position={place.coordinates}
                  onClick={() => handleMarkerClick(place)}
                  icon={{
                    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
                      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
                        <circle cx="16" cy="16" r="15" fill="${selectedPlace?.id === place.id ? '#22c55e' : '#ffffff'}" stroke="#333" stroke-width="2"/>
                        <text x="16" y="22" text-anchor="middle" font-size="16" fill="black">📍</text>
                      </svg>
                    `)}`,
                    scaledSize: new google.maps.Size(32, 32),
                    anchor: new google.maps.Point(16, 16),
                  }}
                />
              ))}
              
              {/* Render searched/selected location */}
              {searchedLocation && (
                <MarkerF
                  position={searchedLocation}
                  icon={{
                    path: google.maps.SymbolPath.CIRCLE,
                    fillColor: '#ef4444',
                    fillOpacity: 1,
                    strokeWeight: 2,
                    strokeColor: '#ffffff',
                    scale: 8,
                  }}
                />
              )}
              
              {/* Render place search results using regular Markers */}
              <SearchResultMarkers
                markers={searchMarkers}
                map={mapRef.current}
                onMarkerClick={handleSearchMarkerClick}
                selectedMarkerId={selectedSearchPlaceId}
                hoveredMarkerId={hoveredResultId}
              />

              {/* Render accommodations */}
              {accommodations.filter((accom: any) => accom.coordinates !== null).map((accom: any) => (
                <MarkerF
                  key={`accom-${accom.id}`}
                  position={accom.coordinates as google.maps.LatLngLiteral}
                  onClick={() => handleMarkerClick(accom as Accommodation)}
                  icon={{
                    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
                      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
                        <circle cx="16" cy="16" r="15" fill="#ffffff" stroke="#f97316" stroke-width="2"/>
                        <text x="16" y="22" text-anchor="middle" font-size="16" fill="black">🏨</text>
                      </svg>
                    `)}`,
                    scaledSize: new google.maps.Size(32, 32),
                    anchor: new google.maps.Point(16, 16),
                  }}
                />
              ))}
            </GoogleMap>
          ) : (
            <div className="w-full h-[600px] flex items-center justify-center bg-muted">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          )}
          
        </div>

        {/* RIGHT PANEL: Place Details - Only visible when a place is selected */}
        {showRightPanel && selectedPlaceForDetails && (
          <div className="border-l bg-background h-[600px]">
            <ScrollArea className="h-full">
              <div className="p-4">
                <PlaceDetailsSidebar
                  placeId={selectedPlaceForDetails}
                  tripId={tripId}
                  isPinned={isPlacePinned(selectedPlaceForDetails)}
                  onSelectPlace={onSelectPlaceFromDetails}
                  onClose={onClosePlaceDetails}
                  onSave={handleSavePlace}
                  onAddToItinerary={handleAddToItinerary}
                />
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </Card>
  );
}

// Components needed for rendering
function Badge({ variant, className, children }: { variant: string; className: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
      variant === 'outline' ? 'border border-muted-foreground/30 text-foreground' : 'bg-primary text-primary-foreground'
    } ${className}`}>
      {children}
    </span>
  );
}