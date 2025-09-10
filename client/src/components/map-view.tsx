import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { Loader2, Search, MapPin, Phone, Globe, Star, Clock, X, Plus, ChevronDown, ChevronUp, Image, Building2, Calendar, Utensils, Hotel, Camera, Building, DollarSign } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAccommodations } from "@/hooks/use-accommodations";
import { cn } from "@/lib/utils";
import { useGoogleMapsScript, useMapCoordinates, GoogleMap, MarkerF, PlaceDetails, PinnedPlace } from "@/lib/google-maps";
import { LocationSearchBar } from "@/components/location-search-bar";
import { IconPicker } from "@/components/icon-picker";

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
  hideSearchAndFilters = false
}: MapViewProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const mapRef = useRef<google.maps.Map | null>(null);
  const [selectedPlaceDetails, setSelectedPlaceDetails] = useState<PlaceDetails | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [expandedReviews, setExpandedReviews] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState('📍'); // Icon for pinning places
  const numericTripId = tripId && !isNaN(Number(tripId)) ? Number(tripId) : undefined;
  const { accommodations = [] } = useAccommodations(numericTripId);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [placeResults, setPlaceResults] = useState<google.maps.places.PlaceResult[]>([]);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Record<string, any>>({});
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchedLocation, setSearchedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);

  // Load Google Maps script
  const { isLoaded, loadError, errorMessage } = useGoogleMapsScript();
  
  // Handle both string locations and coordinate objects
  const locationObj = typeof location === 'string' 
    ? undefined  // Will use default in useMapCoordinates
    : location;  // Pass through lat/lng object directly
  
  const { coordinates, setCoordinates } = useMapCoordinates(locationObj || "");
  
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

  const allPinnedPlaces = useMemo(() => {
    if (!pinnedPlaces) return [];
    if (Array.isArray(pinnedPlaces)) return pinnedPlaces;
    if ('places' in pinnedPlaces) return pinnedPlaces.places;
    return [];
  }, [pinnedPlaces]);

  const fetchDetails = useCallback((placeId: string) => {
    getPlaceDetails(placeId, (place, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && place) {
        setSelectedPlaceDetails(place);
      }
    });
  }, [getPlaceDetails]);

  const handlePlaceNameClick = useCallback((place: PinnedPlace) => {
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
      fetchDetails(place.placeId);
    }
  }, [fetchDetails, coordinates]);

  const handleMarkerClick = useCallback((item: PinnedPlace | Accommodation | Activity) => {
    if (mapRef.current && 'coordinates' in item && item.coordinates) {
      // Use our shared animation function with easing and better spatial context
      smoothMapAnimation(
        mapRef, 
        coordinates, 
        item.coordinates
      );
    }

    if ('placeId' in item && item.placeId) {
      fetchDetails(item.placeId);
    } else {
      setSelectedPlaceDetails({
        name: 'title' in item ? item.title : ('name' in item ? item.name : 'Unnamed Place'),
        formatted_address: 'location' in item ? item.location || '' : ('address' in item ? item.address || '' : ''),
        geometry: {
          location: new google.maps.LatLng(
            item.coordinates?.lat || 0,
            item.coordinates?.lng || 0
          )
        },
        types: ['activity' in item ? 'event' : 'lodging'],
        opening_hours: {
          weekday_text: 'startTime' in item ? [
            `Start: ${new Date(item.startTime).toLocaleTimeString()}`,
            `End: ${new Date(item.endTime).toLocaleTimeString()}`
          ] : [
            `Check-in: ${('checkInTime' in item) ? item.checkInTime || 'Not specified' : 'Not specified'}`,
            `Check-out: ${('checkOutTime' in item) ? item.checkOutTime || 'Not specified' : 'Not specified'}`
          ],
          isOpen: () => true
        }
      } as PlaceDetails);
    }

    if ('placeId' in item) {
      onPinClick?.(item as PinnedPlace);
    }
  }, [onPinClick, fetchDetails, coordinates]);

  const handleLocalPlaceNameClick = useCallback((place: PinnedPlace) => {
    handlePlaceNameClick(place);
    onPlaceNameClick?.(place);
  }, [onPlaceNameClick, handlePlaceNameClick]);

  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    const event = e as unknown as { placeId?: string; stop?: () => void };
    if (event.stop) event.stop();
    if (!event.placeId) {
      setSelectedPlaceDetails(null);
      return;
    }
    fetchDetails(event.placeId);
  }, [fetchDetails]);

  const refreshPlaces = useCallback(() => {
    if (!selectedCategory || !placesServiceRef.current || !mapRef.current) return;

    setIsLoadingPlaces(true);
    const category = categoryButtons.find(c => c.id === selectedCategory);

    if (!category) return;

    const bounds = mapRef.current.getBounds();
    if (!bounds) return;

    const request: google.maps.places.PlaceSearchRequest = {
      bounds,
      type: category.type[0],
    };

    // Add price level filter if set
    if (activeFilters.price) {
      request.minPriceLevel = activeFilters.price;
      request.maxPriceLevel = activeFilters.price;
    }

    placesServiceRef.current.nearbySearch(request, (results, status) => {
      setIsLoadingPlaces(false);
      if (status === google.maps.places.PlacesServiceStatus.OK && results) {
        // Apply post-query filters
        let filteredResults = results;

        // Filter by rating
        if (activeFilters.rating) {
          filteredResults = filteredResults.filter(
            place => (place.rating || 0) >= activeFilters.rating
          );
        }

        // Filter by open now
        if (activeFilters.hours === true) {
          filteredResults = filteredResults.filter(
            place => place.opening_hours?.isOpen?.() === true
          );
        }

        setPlaceResults(filteredResults);
      }
    });
  }, [selectedCategory, activeFilters]);

  const handleCategoryClick = useCallback((category: CategoryButton) => {
    setSelectedCategory(currentCategory => {
      const newCategory = currentCategory === category.id ? null : category.id;
      if (newCategory) {
        refreshPlaces();
      } else {
        setPlaceResults([]);
      }
      return newCategory;
    });
  }, [refreshPlaces]);

  const handleMapIdle = useCallback(() => {
    if (selectedCategory) {
      refreshPlaces();
    }
  }, [selectedCategory, refreshPlaces]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    initPlacesService(map);
    
    // Only add the idle listener once
    google.maps.event.clearListeners(map, 'idle');
    map.addListener('idle', handleMapIdle);
    
    // Set initial center explicitly to ensure the map displays properly on first load
    if (coordinates) {
      map.setCenter(coordinates);
      map.setZoom(12);
    }
  }, [initPlacesService, handleMapIdle, coordinates]);

  const handleSearchSelect = useCallback((result: SearchResult) => {
    if (result.type === 'category') {
      // Handle category selection
      const category = categoryButtons.find(c => c.id === result.id);
      if (category) {
        setSelectedCategory(category.id);
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

  const handlePinPlace = useCallback(async () => {
    if (!selectedPlaceDetails || !tripId) return;

    try {
      const placeCoordinates = selectedPlaceDetails.geometry?.location
        ? {
            lat: selectedPlaceDetails.geometry.location.lat(),
            lng: selectedPlaceDetails.geometry.location.lng(),
          }
        : coordinates;

      const response = await fetch(`/api/trips/${tripId}/pinned-places`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: selectedPlaceDetails.name,
          placeId: selectedPlaceDetails.place_id,
          coordinates: placeCoordinates,
          category: selectedPlaceDetails.types?.[0] || "attraction",
          address: selectedPlaceDetails.formatted_address,
          icon: selectedIcon, // Include the selected icon
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to pin place");
      }

      // Invalidate pinned places query to refresh the list
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/pinned-places`] });

      toast({
        title: "Place pinned successfully",
        description: `${selectedPlaceDetails.name} has been added to your pinned places.`,
      });

      setSelectedPlaceDetails(null);
    } catch (error) {
      toast({
        title: "Error pinning place",
        description: "An error occurred while trying to pin this place.",
        variant: "destructive",
      });
    }
  }, [selectedPlaceDetails, tripId, coordinates, queryClient, toast]);

  const handleFilterChange = useCallback((filterId: string, value: any) => {
    setActiveFilters(prev => ({
      ...prev,
      [filterId]: value === prev[filterId] ? null : value
    }));

    // Refresh places with new filters
    if (selectedCategory) {
      refreshPlaces();
    }
  }, [selectedCategory, refreshPlaces]);

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
      
      setSearchResults(categoryResults);
      setShowSearchResults(true);
    } else {
      setSearchResults([]);
      setShowSearchResults(false);
    }
  }, []);

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
        fetchDetails(selectedPlace.placeId);
      } 
      // Otherwise, try to find place by name + coordinates
      else if (selectedPlace.name && selectedPlace.coordinates) {
        findPlaceByQuery(
          selectedPlace.name,
          new google.maps.LatLng(selectedPlace.coordinates.lat, selectedPlace.coordinates.lng),
          (placeId) => {
            if (placeId) {
              fetchDetails(placeId);
            } else {
              // If place not found, just show basic info
              setSelectedPlaceDetails({
                name: selectedPlace.name,
                formatted_address: '',
                geometry: {
                  location: new google.maps.LatLng(
                    selectedPlace.coordinates?.lat || 0,
                    selectedPlace.coordinates?.lng || 0
                  )
                },
                types: ['point_of_interest']
              } as PlaceDetails);
            }
          }
        );
      }
    }
  }, [selectedPlace, isLoaded, fetchDetails, findPlaceByQuery, coordinates, searchedLocation]);

  // Function for rendering the place details panel
  const renderPlaceDetails = () => {
    if (!selectedPlaceDetails) return null;

    // Get photos or show a placeholder
    const photos = selectedPlaceDetails.photos || [];
    
    return (
      <div className="p-4 border-t">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xl font-bold">{selectedPlaceDetails.name}</h3>
            <p className="text-sm text-muted-foreground">{selectedPlaceDetails.formatted_address}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setSelectedPlaceDetails(null)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {photos.length > 0 && (
          <div className="mb-4 relative">
            <div className="aspect-video overflow-hidden rounded-md">
              {selectedPhotoIndex !== null ? (
                <div className="relative h-full">
                  <img 
                    src={photos[selectedPhotoIndex].getUrl()} 
                    alt={`${selectedPlaceDetails.name} - photo ${selectedPhotoIndex + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="absolute top-2 right-2 bg-background/80 rounded-full p-1"
                    onClick={() => setSelectedPhotoIndex(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1 h-full">
                  {photos.slice(0, 3).map((photo, idx) => (
                    <div 
                      key={idx} 
                      className="relative aspect-video cursor-pointer"
                      onClick={() => setSelectedPhotoIndex(idx)}
                    >
                      <img 
                        src={photo.getUrl({ maxWidth: 400 })} 
                        alt={`${selectedPlaceDetails.name} - thumbnail ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      {idx === 2 && photos.length > 3 && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-medium">
                          +{photos.length - 3}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          {selectedPlaceDetails.rating && (
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" />
              <span className="font-medium">{selectedPlaceDetails.rating}</span>
              <span className="text-sm text-muted-foreground">
                ({selectedPlaceDetails.user_ratings_total} reviews)
              </span>
            </div>
          )}

          {selectedPlaceDetails.formatted_phone_number && (
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              <span>{selectedPlaceDetails.formatted_phone_number}</span>
            </div>
          )}

          {selectedPlaceDetails.website && (
            <div className="flex items-center gap-2 col-span-2">
              <Globe className="h-4 w-4" />
              <a 
                href={selectedPlaceDetails.website} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline truncate"
              >
                {selectedPlaceDetails.website.replace(/^https?:\/\//, '')}
              </a>
            </div>
          )}
        </div>

        {selectedPlaceDetails.opening_hours?.weekday_text && (
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium flex items-center">
                <Clock className="h-4 w-4 mr-2" />
                Hours
              </h4>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setExpandedReviews(!expandedReviews)}
              >
                {expandedReviews ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
            {expandedReviews && (
              <div className="mt-2 text-sm space-y-1">
                {selectedPlaceDetails.opening_hours.weekday_text.map((day, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span className="text-muted-foreground">
                      {day.split(': ')[0]}:
                    </span>
                    <span>{day.split(': ')[1]}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tripId && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Choose an icon:</span>
              <IconPicker
                selectedIcon={selectedIcon}
                onIconSelect={setSelectedIcon}
                className="flex-shrink-0"
              />
            </div>
            <Button 
              onClick={handlePinPlace} 
              className="w-full"
            >
              <span className="mr-2">{selectedIcon}</span>
              Pin to Trip
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className={cn("w-full shadow-md relative", className)}>
      <div className="flex flex-col md:flex-row">
        <div className={`w-full ${selectedPlaceDetails ? "md:w-3/5" : "md:w-full"} relative`}>
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
                />
                
                {/* Show category suggestions only when typing */}
                {showSearchResults && searchResults.length > 0 && (
                  <Card className="absolute top-full left-0 right-0 mt-1 max-h-60 overflow-y-auto shadow-lg z-20">
                    <ScrollArea className="p-2">
                      {searchResults.map((result) => (
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

              <div className="flex flex-wrap gap-2">
                {categoryButtons.map((category) => (
                  <Button
                    key={category.id}
                    size="sm"
                    variant={selectedCategory === category.id ? "default" : "outline"}
                    className="bg-background/90 backdrop-blur-sm"
                    onClick={() => handleCategoryClick(category)}
                  >
                    {category.icon}
                    <span className="ml-2">{category.label}</span>
                  </Button>
                ))}
              </div>

              {selectedCategory && (
                <div className="flex flex-wrap gap-2">
                  {subFilters.map((filter) => (
                    <div key={filter.id} className="relative group">
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-background/90 backdrop-blur-sm"
                      >
                        {filter.icon && <span className="mr-2">{filter.icon}</span>}
                        {filter.label}
                        <ChevronDown className="h-4 w-4 ml-1" />
                      </Button>
                      <div className="absolute top-full left-0 mt-1 w-44 hidden group-hover:block z-20">
                        <Card className="p-2 shadow-lg">
                          {filter.options.map((option) => (
                            <div
                              key={option.id}
                              className={`p-2 cursor-pointer rounded text-sm ${
                                activeFilters[filter.id] === option.value
                                  ? "bg-primary text-primary-foreground"
                                  : "hover:bg-muted"
                              }`}
                              onClick={() => handleFilterChange(filter.id, option.value)}
                            >
                              {option.label}
                            </div>
                          ))}
                        </Card>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
                    path: google.maps.SymbolPath.CIRCLE,
                    fillColor: selectedPlace?.id === place.id ? '#22c55e' : '#3b82f6',
                    fillOpacity: 1,
                    strokeWeight: 2,
                    strokeColor: '#ffffff',
                    scale: 8,
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
              
              {/* Render place search results */}
              {placeResults.map((place, idx) => (
                place.geometry?.location && (
                  <MarkerF
                    key={`search-${place.place_id || idx}`}
                    position={{
                      lat: place.geometry.location.lat(),
                      lng: place.geometry.location.lng(),
                    }}
                    onClick={() => {
                      if (place.place_id) {
                        fetchDetails(place.place_id);
                      }
                    }}
                    icon={{
                      path: google.maps.SymbolPath.CIRCLE,
                      fillColor: '#a855f7',
                      fillOpacity: 0.8,
                      strokeWeight: 2,
                      strokeColor: '#ffffff',
                      scale: 7,
                    }}
                  />
                )
              ))}

              {/* Render accommodations */}
              {accommodations.filter((accom: any) => accom.coordinates !== null).map((accom: any) => (
                <MarkerF
                  key={`accom-${accom.id}`}
                  position={accom.coordinates as google.maps.LatLngLiteral}
                  onClick={() => handleMarkerClick(accom as Accommodation)}
                  icon={{
                    path: google.maps.SymbolPath.CIRCLE,
                    fillColor: '#f97316',
                    fillOpacity: 0.8,
                    strokeWeight: 2,
                    strokeColor: '#ffffff',
                    scale: 7,
                  }}
                />
              ))}
            </GoogleMap>
          ) : (
            <div className="w-full h-[600px] flex items-center justify-center bg-muted">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          )}
          
          {isLoadingPlaces && (
            <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
              <div className="bg-background p-4 rounded-lg shadow-lg flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span>Loading places...</span>
              </div>
            </div>
          )}
        </div>

        {selectedPlaceDetails ? (
          <div className="w-full md:w-2/5 border-t md:border-t-0 md:border-l">
            <ScrollArea className="h-[600px]">
              {renderPlaceDetails()}
            </ScrollArea>
          </div>
        ) : (
          <div className={`w-full md:w-2/5 border-t md:border-t-0 md:border-l ${!hideSearchAndFilters ? 'block' : 'hidden'}`}>
            <ScrollArea className="h-[600px] p-4">
              <h3 className="text-lg font-semibold mb-4">Pinned Places</h3>
              {allPinnedPlaces.length > 0 ? (
                <div className="space-y-3">
                  {allPinnedPlaces.map((place: PinnedPlace) => (
                    <div
                      key={place.id}
                      className={`p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${
                        selectedPlace?.id === place.id ? "border-primary bg-primary/10" : ""
                      }`}
                      onClick={() => handleLocalPlaceNameClick(place)}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium">{place.name}</h4>
                          <p className="text-sm text-muted-foreground truncate">
                            {place.name}
                          </p>
                        </div>
                        <MapPin className={`h-4 w-4 flex-shrink-0 ${
                          selectedPlace?.id === place.id ? "text-primary" : "text-muted-foreground"
                        }`} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <MapPin className="h-10 w-10 mx-auto mb-2 opacity-20" />
                  <p>No places pinned yet</p>
                  <p className="text-sm mt-1">
                    Search for places and pin them to your trip
                  </p>
                </div>
              )}
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