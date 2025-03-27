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

import {
  useGoogleMapsScript,
  useMapCoordinates,
  GoogleMap,
  MarkerF,
  MAP_CONTAINER_STYLE,
  DEFAULT_MAP_OPTIONS,
  type PlaceDetails,
  type PinnedPlace,
} from "@/lib/google-maps";
import usePlacesAutocomplete, { getGeocode, getLatLng } from "use-places-autocomplete";
import { useQuery } from "@tanstack/react-query";
import type { Activity } from "@db/schema";

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

interface CategoryButton {
  id: string;
  label: string;
  icon: React.ReactNode;
  type: string[];
  searchTerms: string[];
}

const categoryButtons: CategoryButton[] = [
  {
    id: 'restaurants',
    label: 'Restaurants',
    icon: <Utensils className="w-4 h-4" />,
    type: ['restaurant'],
    searchTerms: ['restaurant', 'restaurants', 'food', 'dining', 'eat']
  },
  {
    id: 'hotels',
    label: 'Hotels',
    icon: <Hotel className="w-4 h-4" />,
    type: ['lodging'],
    searchTerms: ['hotel', 'hotels', 'lodging', 'motel', 'accommodation']
  },
  {
    id: 'attractions',
    label: 'Things to do',
    icon: <Camera className="w-4 h-4" />,
    type: ['tourist_attraction', 'point_of_interest'],
    searchTerms: ['attraction', 'attractions', 'activities', 'things to do', 'tourism']
  },
  {
    id: 'museums',
    label: 'Museums',
    icon: <Building className="w-4 h-4" />,
    type: ['museum'],
    searchTerms: ['museum', 'museums', 'gallery', 'galleries', 'exhibition']
  },
  {
    id: 'pharmacies',
    label: 'Pharmacies',
    icon: <Building className="w-4 h-4" />,
    type: ['pharmacy'],
    searchTerms: ['pharmacy', 'pharmacies', 'drugstore', 'chemist']
  },
];

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

const subFilters: Record<string, SubFilter[]> = {
  restaurants: [
    {
      id: 'price',
      label: 'Price',
      icon: <DollarSign className="w-4 h-4" />,
      options: [
        { id: '1', label: '$', value: 1 },
        { id: '2', label: '$$', value: 2 },
        { id: '3', label: '$$$', value: 3 },
        { id: '4', label: '$$$$', value: 4 },
      ]
    },
    {
      id: 'rating',
      label: 'Rating',
      icon: <Star className="w-4 h-4" />,
      options: [
        { id: '4.5', label: '4.5+', value: 4.5 },
        { id: '4.0', label: '4.0+', value: 4.0 },
        { id: '3.5', label: '3.5+', value: 3.5 },
      ]
    },
    {
      id: 'hours',
      label: 'Hours',
      icon: <Clock className="w-4 h-4" />,
      options: [
        { id: 'open', label: 'Open now', value: true },
      ]
    }
  ],
  hotels: [
    {
      id: 'price',
      label: 'Price',
      icon: <DollarSign className="w-4 h-4" />,
      options: [
        { id: '1', label: '$', value: 1 },
        { id: '2', label: '$$', value: 2 },
        { id: '3', label: '$$$', value: 3 },
        { id: '4', label: '$$$$', value: 4 },
      ]
    },
    {
      id: 'rating',
      label: 'Rating',
      icon: <Star className="w-4 h-4" />,
      options: [
        { id: '4.5', label: '4.5+', value: 4.5 },
        { id: '4.0', label: '4.0+', value: 4.0 },
        { id: '3.5', label: '3.5+', value: 3.5 },
      ]
    }
  ],
  attractions: [
    {
      id: 'rating',
      label: 'Rating',
      icon: <Star className="w-4 h-4" />,
      options: [
        { id: '4.5', label: '4.5+', value: 4.5 },
        { id: '4.0', label: '4.0+', value: 4.0 },
        { id: '3.5', label: '3.5+', value: 3.5 },
      ]
    },
    {
      id: 'hours',
      label: 'Hours',
      icon: <Clock className="w-4 h-4" />,
      options: [
        { id: 'open', label: 'Open now', value: true },
      ]
    }
  ]
};

interface SearchResult {
  type: 'category' | 'place';
  id: string;
  description: string;
  placeId?: string;
  icon?: React.ReactNode;
  secondaryText?: string;
}

interface MapViewProps {
  location: { lat: number; lng: number };
  tripId?: string;
  pinnedPlaces?: PinnedPlace[];
  onPinClick?: (place: PinnedPlace) => void;
  onPlaceNameClick?: (place: PinnedPlace) => void;
  className?: string;
  selectedPlace?: PinnedPlace | null;
}

interface Accommodation {
  id: string;
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
  selectedPlace
}: MapViewProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const mapRef = useRef<google.maps.Map | null>(null);
  const [selectedPlaceDetails, setSelectedPlaceDetails] = useState<PlaceDetails | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [expandedReviews, setExpandedReviews] = useState(false);
  const { accommodations = [] } = useAccommodations(tripId);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [placeResults, setPlaceResults] = useState<google.maps.places.PlaceResult[]>([]);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Record<string, any>>({});
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchedLocation, setSearchedLocation] = useState<{ lat: number; lng: number } | null>(null);

  const { isLoaded, loadError } = useGoogleMapsScript();
  const { coordinates, setCoordinates } = useMapCoordinates(location);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);

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
        if (status === google.maps.places.PlacesServiceStatus.OK && results && results[0]) {
          callback(results[0].place_id);
        } else {
          callback(null);
        }
      }
    );
  }, []);

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
        setSelectedPlaceDetails(place);
      }
    });
  }, [getPlaceDetails]);

  const handlePlaceNameClick = useCallback((place: PinnedPlace) => {
    if (mapRef.current && place.coordinates) {
      mapRef.current.panTo(place.coordinates);
      mapRef.current.setZoom(17);
    }
    if (place.placeId) {
      fetchDetails(place.placeId);
    }
  }, [fetchDetails]);

  const handleMarkerClick = useCallback((item: PinnedPlace | Accommodation | Activity) => {
    if (mapRef.current && 'coordinates' in item && item.coordinates) {
      mapRef.current.panTo(item.coordinates);
      mapRef.current.setZoom(17);
    }

    if ('placeId' in item && item.placeId) {
      fetchDetails(item.placeId);
    } else {
      setSelectedPlaceDetails({
        name: item.title || item.name,
        formatted_address: 'location' in item ? item.location : (item.address || ''),
        geometry: {
          location: new google.maps.LatLng(
            item.coordinates.lat,
            item.coordinates.lng
          )
        },
        types: ['activity' in item ? 'event' : 'lodging'],
        opening_hours: {
          weekday_text: 'startTime' in item ? [
            `Start: ${new Date(item.startTime).toLocaleTimeString()}`,
            `End: ${new Date(item.endTime).toLocaleTimeString()}`
          ] : [
            `Check-in: ${item.checkInTime || 'Not specified'}`,
            `Check-out: ${item.checkOutTime || 'Not specified'}`
          ],
          isOpen: () => true
        }
      } as PlaceDetails);
    }

    if ('placeId' in item) {
      onPinClick?.(item as PinnedPlace);
    }
  }, [onPinClick, fetchDetails]);

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
      type: category.type[0] as google.maps.places.PlaceType,
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
    map.addListener('idle', handleMapIdle);
  }, [initPlacesService, handleMapIdle]);

  const handleSearchSelect = useCallback(async (result: SearchResult) => {
    if (result.type === 'category') {
      // Handle category selection
      const category = categoryButtons.find(c => c.id === result.id);
      if (category) {
        setSelectedCategory(category.id);
        setValue(category.label, false);
        clearSuggestions();
      }
    } else {
      // Handle place selection
      if (result.placeId) {
        try {
          clearSuggestions();
          setValue(result.description, false);

          const results = await getGeocode({ placeId: result.placeId });
          const { lat, lng } = await getLatLng(results[0]);

          setCoordinates({ lat, lng });
          setSearchedLocation({ lat, lng }); // Set the searched location for the marker

          if (mapRef.current) {
            mapRef.current.panTo({ lat, lng });
            mapRef.current.setZoom(17); // Increased zoom level
          }

          fetchDetails(result.placeId);
        } catch (error) {
          console.error("Error selecting place:", error);
        }
      }
    }
  }, [clearSuggestions, setValue, setCoordinates, fetchDetails]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const searchValue = e.target.value;
    setValue(searchValue);

    // Find matching categories
    const matchingCategories = categoryButtons.filter(category =>
      category.searchTerms.some(term =>
        term.toLowerCase().includes(searchValue.toLowerCase()) ||
        searchValue.toLowerCase().includes(term.toLowerCase())
      )
    );

    // Combine category and place results
    const categoryResults: SearchResult[] = matchingCategories.map(category => ({
      type: 'category',
      id: category.id,
      description: category.label,
      icon: category.icon
    }));

    setSearchResults([...categoryResults]);
  }, [setValue]);

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
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: selectedPlaceDetails.name,
          placeId: selectedPlaceDetails.place_id,
          coordinates: placeCoordinates,
          address: selectedPlaceDetails.formatted_address,
          phone: selectedPlaceDetails.formatted_phone_number,
          website: selectedPlaceDetails.website,
          rating: selectedPlaceDetails.rating,
          openingHours: selectedPlaceDetails.opening_hours?.weekday_text
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
  }, [selectedPlaceDetails, tripId, coordinates, toast, queryClient]);

  useEffect(() => {
    if (status === "OK") {
      const placeResults: SearchResult[] = data.map(suggestion => ({
        type: 'place',
        id: suggestion.place_id,
        description: suggestion.description,
        placeId: suggestion.place_id,
        icon: <MapPin className="h-4 w-4" />,
      }));

      // Combine with any existing category results
      const categoryResults = searchResults.filter(r => r.type === 'category');
      setSearchResults([...categoryResults, ...placeResults]);
    }
  }, [status, data, searchResults]);

  useEffect(() => {
    if (selectedPlace) {
      if (mapRef.current && selectedPlace.coordinates) {
        mapRef.current.panTo(selectedPlace.coordinates);
        mapRef.current.setZoom(17);
      }

      if (selectedPlace.placeId) {
        getPlaceDetails(selectedPlace.placeId, (place, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && place) {
            setSelectedPlaceDetails(place);
          }
        });
      } else {
        const location = new google.maps.LatLng(
          selectedPlace.coordinates.lat,
          selectedPlace.coordinates.lng
        );

        findPlaceByQuery(selectedPlace.name, location, (placeId) => {
          if (placeId) {
            getPlaceDetails(placeId, (place, status) => {
              if (status === google.maps.places.PlacesServiceStatus.OK && place) {
                setSelectedPlaceDetails(place);
              }
            });
          } else {
            setSelectedPlaceDetails({
              name: selectedPlace.name,
              formatted_address: selectedPlace.address,
              geometry: {
                location: new google.maps.LatLng(
                  selectedPlace.coordinates.lat,
                  selectedPlace.coordinates.lng
                )
              }
            } as PlaceDetails);
          }
        });
      }
    } else {
      setSelectedPlaceDetails(null);
    }
  }, [selectedPlace, getPlaceDetails, findPlaceByQuery]);

  // Keep the blue marker visible even when place details are showing
  // Removed the effect that was clearing searchedLocation when selectedPlaceDetails is set


  const createAccommodationMarkers = useMemo(() => {
    return accommodations
      .filter((acc): acc is Accommodation & { coordinates: NonNullable<Accommodation['coordinates']> } =>
        acc.coordinates !== null
      )
      .map(acc => ({
        position: acc.coordinates,
        title: acc.name,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: '#4CAF50',
          fillOpacity: 1,
          strokeWeight: 2,
          strokeColor: '#ffffff',
          scale: 8,
        }
      }));
  }, [accommodations]);

  const { data: activities = [] } = useQuery<Activity[]>({
    queryKey: ["/api/trips", tripId, "activities"],
    queryFn: async () => {
      if (!tripId) return [];
      const res = await fetch(`/api/trips/${tripId}/activities`);
      if (!res.ok) throw new Error("Failed to fetch activities");
      return res.json();
    },
    enabled: !!tripId,
  });

  const createActivityMarkers = useMemo(() => {
    return activities
      .filter((activity): activity is Activity & { coordinates: NonNullable<Activity['coordinates']> } =>
        activity.coordinates !== null
      )
      .map(activity => ({
        position: activity.coordinates,
        title: activity.title,
        icon: {
          path: 'M12,0C7.6,0,3.2,4.4,3.2,8.8c0,7.2,7.2,14.4,8.8,14.4s8.8-7.2,8.8-14.4C20.8,4.4,16.4,0,12,0z M12,11.6 c-1.6,0-2.8-1.2-2.8-2.8s1.2-2.8,2.8-2.8s2.8,1.2,2.8,2.8S13.6,11.6,12,11.6z',
          fillColor: '#1E88E5',
          fillOpacity: 1,
          strokeWeight: 1,
          strokeColor: '#FFFFFF',
          scale: 1.5,
          anchor: new google.maps.Point(12, 24),
          labelOrigin: new google.maps.Point(12, -10)
        }
      }));
  }, [activities]);


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

  const handleFilterClick = (filterId: string, value: any) => {
    setActiveFilters(prev => {
      const newFilters = { ...prev };
      if (prev[filterId] === value) {
        delete newFilters[filterId];
      } else {
        newFilters[filterId] = value;
      }
      return newFilters;
    });
  };

  const handleInputFocus = () => {
    setIsSearchFocused(true);
  };

  const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // Check if the click is outside the search results
    const searchResultsElement = document.querySelector('.absolute.top-full.left-0.right-0.mt-1.bg-background.rounded-lg.shadow-lg.overflow-hidden.z-50');
    if (searchResultsElement && !searchResultsElement.contains(e.relatedTarget as Node)) {
      setIsSearchFocused(false);
    }
  };

  return (
    <Card className={cn("overflow-hidden relative", className)}>
      {/* Search Bar */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 w-[400px]">
        <div
          className="relative"
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
        >
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="Search on map"
            value={value}
            onChange={handleInputChange}
            className="w-full h-12 pl-4 pr-10 rounded-lg shadow-lg bg-background"
            disabled={!ready}
          />
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />

          {searchResults.length > 0 && isSearchFocused && (
            <ul className="absolute top-full left-0 right-0 mt-1 bg-background rounded-lg shadow-lg overflow-hidden z-50">
              {searchResults.map((result) => (
                <li
                  key={result.id}
                  onClick={() => {
                    handleSearchSelect(result);
                    setIsSearchFocused(false);
                  }}
                  className="px-4 py-2 hover:bg-accent cursor-pointer flex items-center gap-2"
                  tabIndex={0}
                >
                  {result.type === 'category' ? (
                    <Search className="h-4 w-4 text-primary flex-shrink-0" />
                  ) : (
                    <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
                  )}
                  <div>
                    <span className="text-sm">{result.description}</span>
                    {result.secondaryText && (
                      <span className="text-xs text-muted-foreground ml-2">
                        {result.secondaryText}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Collapsible Category Filter Bar - right side */}
      <div className="absolute top-4 right-4 z-50">
        <Button
          variant="outline"
          size="sm"
          className="bg-background shadow-lg rounded-full px-4"
          onClick={() => setSelectedCategory(selectedCategory ? null : 'show')}
        >
          {selectedCategory ? (
            <>
              <ChevronUp className="h-4 w-4 mr-2" />
              Hide Filters
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4 mr-2" />
              Show Filters
            </>
          )}
        </Button>

        {selectedCategory && (
          <div className="mt-2 bg-background rounded-lg shadow-lg p-2 flex flex-col space-y-2 animate-in fade-in slide-in-from-right-2 duration-200">
            {categoryButtons.map((category) => (
              <Button
                key={category.id}
                variant={selectedCategory === category.id ? "default" : "outline"}
                className="flex items-center justify-start space-x-2 w-full"
                onClick={() => handleCategoryClick(category)}
              >
                {category.icon}
                <span>{category.label}</span>
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Sub-filters bar */}
      {selectedCategory && subFilters[selectedCategory] && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-40">
          <div className="bg-background rounded-lg shadow-lg p-2 flex space-x-2 animate-in fade-in-50 slide-in-from-top-2 duration-200">
            {subFilters[selectedCategory].map((filter) => (
              <div key={filter.id} className="flex items-center space-x-2">
                {filter.options.map((option) => (
                  <Button
                    key={option.id}
                    variant={activeFilters[filter.id] === option.value ? "default" : "outline"}
                    size="sm"
                    className="rounded-full"
                    onClick={() => handleFilterClick(filter.id, option.value)}
                  >
                    {filter.icon && <span className="mr-1">{filter.icon}</span>}
                    {option.label}
                  </Button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedCategory && (
        <div className="absolute top-32 left-0 w-[400px] bg-background shadow-lg z-40 rounded-r-lg max-h-[calc(100%-8rem)]">
          <div className="p-4 border-b flex justify-between items-center">
            <h3 className="text-lg font-semibold">
              {categoryButtons.find(c => c.id === selectedCategory)?.label}
            </h3>
            <Button variant="ghost" size="icon" onClick={() => setSelectedCategory(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <ScrollArea className="h-[calc(100vh-250px)]">
            {isLoadingPlaces ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <div className="space-y-2 p-4">
                {placeResults.map((place, index) => (
                  <div
                    key={place.place_id}
                    className="p-4 hover:bg-accent rounded-lg cursor-pointer"
                    onClick={() => {
                      if (place.place_id) {
                        fetchDetails(place.place_id);
                      }
                    }}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium">{place.name}</h4>
                        <p className="text-sm text-muted-foreground">{place.vicinity}</p>
                      </div>
                      {place.rating && (
                        <div className="flex items-center">
                          <StarRating rating={place.rating} />
                          <span className="ml-1 text-sm">({place.user_ratings_total})</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      )}

      {selectedPlaceDetails && (
        <div className="absolute top-0 left-0 bottom-0 w-[400px] bg-background shadow-lg z-40 flex flex-col rounded-r-lg">
          <div className="p-6 border-b">
            <div className="space-y-2">
              <h2 className="text-[22px] font-medium leading-7 text-foreground">{selectedPlaceDetails.name}</h2>
              <div className="flex flex-col gap-1">
                {selectedPlaceDetails.rating && (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-0.5">
                      <StarRating rating={selectedPlaceDetails.rating} />
                      <span className="ml-1 text-sm font-medium">{selectedPlaceDetails.rating}</span>
                    </div>
                    <span className="text-[#70757a] text-sm">
                      ({selectedPlaceDetails.user_ratings_total?.toLocaleString()})
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 p-2 border-b">
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(selectedPlaceDetails.formatted_address)}`}
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

            {selectedPlaceDetails.formatted_phone_number && (
              <a
                href={`tel:${selectedPlaceDetails.formatted_phone_number}`}
                className="flex flex-col items-center justify-center p-3 hover:bg-accent rounded-lg gap-1.5 transition-colors"
              >
                <Phone className="h-5 w-5 text-primary" />
                <span className="text-xs font-medium">Call</span>
              </a>
            )}

            {selectedPlaceDetails.website && (
              <a
                href={selectedPlaceDetails.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center p-3 hover:bg-accent rounded-lg gap-1.5 transition-colors"
              >
                <Globe className="h-5 w-5 text-primary" />
                <span className="text-xs font-medium">Website</span>
              </a>
            )}
          </div>

          {(selectedPlaceDetails.reservable || selectedPlaceDetails.booking_url) && (
            <div className="p-4 border-b">
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium"
                size="lg"
                onClick={() => window.open(selectedPlaceDetails.booking_url || selectedPlaceDetails.url, '_blank')}
              >
                {selectedPlaceDetails.types?.includes('restaurant') ? 'Reserve a table' : 'Book Now'}
              </Button>
            </div>
          )}

          <ScrollArea className="flex-1">
            <div className="p-6 space-y-8">
              {selectedPlaceDetails.photos && selectedPlaceDetails.photos.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-foreground">Photos</h3>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedPhotoIndex(0)}>
                      <Image className="h-4 w-4 mr-2" />
                      View all
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {selectedPlaceDetails.photos.slice(0, 4).map((photo, index) => (
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
                  <p className="text-sm leading-relaxed">{selectedPlaceDetails.formatted_address}</p>
                </div>
              </div>

              {(selectedPlaceDetails.formatted_phone_number || selectedPlaceDetails.website) && (
                <div className="spacey-3">
                  <h3 className="text-sm font-medium text-foreground">Contact</h3>
                  {selectedPlaceDetails.formatted_phone_number && (
                    <div className="flex items-center gap-4">
                      <Phone className="h-5 w-5 text-primary flex-shrink-0" />
                      <a href={`tel:${selectedPlaceDetails.formatted_phone_number}`} className="text-sm hover:underline">
                        {selectedPlaceDetails.formatted_phone_number}
                      </a>
                    </div>
                  )}
                  {selectedPlaceDetails.website && (
                    <div className="flex items-center gap-4">
                      <Globe className="h-5 w-5 text-primary flex-shrink-0" />
                      <a
                        href={selectedPlaceDetails.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm hover:underline truncate"
                      >
                        {selectedPlaceDetails.website}
                      </a>
                    </div>
                  )}
                </div>
              )}

              {selectedPlaceDetails.opening_hours && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-foreground">Hours</h3>
                    <span className={`text-sm font-medium ${
                      selectedPlaceDetails.opening_hours.isOpen() ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {selectedPlaceDetails.opening_hours.isOpen() ? 'Open' : 'Closed'}
                    </span>
                  </div>
                  <div className="flex items-start gap-4">
                    <Clock className="h-5 w-5 mt-1 text-primary flex-shrink-0" />
                    <ul className="space-y-1.5">
                      {selectedPlaceDetails.opening_hours.weekday_text.map((hours, index) => (
                        <li key={index} className="text-sm leading-relaxed">{hours}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {selectedPlaceDetails.reviews && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <h3 className="text-[16px] font-medium text-foreground">Reviews</h3>
                      {selectedPlaceDetails.rating && (
                        <div className="flex items-center gap-1">
                          <StarRating rating={selectedPlaceDetails.rating} />
                          <span className="text-sm">
                            {selectedPlaceDetails.rating}
                            <span className="text-[#70757a] ml-1">
                              ({selectedPlaceDetails.user_ratings_total?.toLocaleString()})
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
                    {(expandedReviews ? selectedPlaceDetails.reviews : selectedPlaceDetails.reviews.slice(0, 2)).map((review, index) => (
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
            onClick={() => setSelectedPlaceDetails(null)}
            className="absolute top-4 right-4"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {selectedPhotoIndex !== null && selectedPlaceDetails?.photos && (
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
            src={selectedPlaceDetails.photos[selectedPhotoIndex].getUrl({ maxWidth: 1200, maxHeight: 800 })}
            alt={`Photo ${selectedPhotoIndex + 1}`}
            className="max-w-[90vw] max-h-[90vh] object-contain"
          />
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white text-sm">
            {selectedPhotoIndex + 1} / {selectedPlaceDetails.photos.length}
          </div>
        </div>
      )}

      <GoogleMap
        mapContainerStyle={MAP_CONTAINER_STYLE}
        center={coordinates}
        options={{
          ...DEFAULT_MAP_OPTIONS,
          clickableIcons: true,
          streetViewControl: false,
        }}
        onLoad={onMapLoad}
        onClick={handleMapClick}
      >
        {searchedLocation && (
          <MarkerF
            position={searchedLocation}
            icon={{
              path: 'M12,0C7.6,0,3.2,4.4,3.2,8.8c0,7.2,7.2,14.4,8.8,14.4s8.8-7.2,8.8-14.4C20.8,4.4,16.4,0,12,0z M12,11.6 c-1.6,0-2.8-1.2-2.8-2.8s1.2-2.8,2.8-2.8s2.8,1.2,2.8,2.8S13.6,11.6,12,11.6z',
              fillColor: '#1E88E5',
              fillOpacity: 1,
              strokeWeight: 1,
              strokeColor: '#FFFFFF',
              scale: 1.5,
              anchor: new google.maps.Point(12, 24),
              labelOrigin: new google.maps.Point(12, -10)
            }}
          />
        )}

        {allPinnedPlaces.map((place: PinnedPlace) => (
          <MarkerF
            key={place.id}
            position={place.coordinates}
            title={place.name}
            onClick={() => handleMarkerClick(place)}
          />
        ))}

        {createAccommodationMarkers.map((marker, index) => (
          <MarkerF
            key={`accommodation-${index}`}
            position={marker.position}
            title={marker.title}
            icon={marker.icon}
            onClick={() => handleMarkerClick(accommodations[index])}
          />
        ))}

        {createActivityMarkers.map((marker, index) => (
          <MarkerF
            key={`activity-${index}`}
            position={marker.position}
            title={marker.title}
            icon={marker.icon}
            onClick={() => handleMarkerClick(activities[index])}
          />
        ))}

        {selectedCategory && placeResults.map((place) => (
          place.geometry?.location && (
            <MarkerF
              key={`place-${place.place_id}`}
              position={place.geometry.location}
              title={place.name}
              icon={{
                path: google.maps.SymbolPath.MARKER,
                fillColor: '#DB4437',
                fillOpacity: 1,
                strokeWeight: 1,
                strokeColor: '#FFFFFF',
                scale: 1,
                labelOrigin: new google.maps.Point(0, -32)
              }}
              onClick={() => {
                if (place.place_id) {
                  fetchDetails(place.place_id);
                }
              }}
            />
          )
        ))}
      </GoogleMap>
    </Card>
  );
}