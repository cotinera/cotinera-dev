// Import required dependencies for Google Maps integration
import { useLoadScript, GoogleMap, MarkerF } from "@react-google-maps/api";
import { MdRestaurant, MdHotel } from "react-icons/md";
import { FaLandmark, FaShoppingBag, FaUmbrellaBeach, FaGlassCheers, FaStore, FaTree } from "react-icons/fa";
import { useEffect, useState, useCallback, useRef } from "react";
import type { Libraries } from "@react-google-maps/api";
import { MarkerClusterer } from "@googlemaps/markerclusterer";

// Define the required Google Maps libraries
const libraries: Libraries = ["places", "marker"];
export const GOOGLE_MAPS_LIBRARIES = libraries;

// Map container styling configuration
export const MAP_CONTAINER_STYLE = {
  width: "100%",
  height: "600px",
  position: "relative" as const,
};

// Default map options
export const DEFAULT_MAP_OPTIONS = {
  disableDefaultUI: true,
  zoomControl: true,
  scrollwheel: true,
  clickableIcons: true,
  streetViewControl: false,
  gestureHandling: 'greedy',
  restriction: {
    // Restrict to world bounds for better performance
    latLngBounds: {
      north: 85,
      south: -85,
      west: -180,
      east: 180,
    },
  },
};

// Category icons mapping with Google Places types
export const CATEGORY_ICONS = {
  restaurant: MdRestaurant,
  hotel: MdHotel,
  attraction: FaLandmark,
  shopping: FaShoppingBag,
  beach: FaUmbrellaBeach,
  nightlife: FaGlassCheers,
  store: FaStore,
  park: FaTree,
} as const;

// Google Places types to our categories mapping
export const PLACE_TYPE_TO_CATEGORY: Record<string, keyof typeof CATEGORY_ICONS> = {
  restaurant: 'restaurant',
  cafe: 'restaurant',
  food: 'restaurant',
  meal_delivery: 'restaurant',
  meal_takeaway: 'restaurant',
  bar: 'nightlife',
  night_club: 'nightlife',
  casino: 'nightlife',
  lodging: 'hotel',
  hotel: 'hotel',
  resort: 'hotel',
  museum: 'attraction',
  art_gallery: 'attraction',
  tourist_attraction: 'attraction',
  amusement_park: 'attraction',
  aquarium: 'attraction',
  zoo: 'attraction',
  shopping_mall: 'shopping',
  store: 'store',
  clothing_store: 'shopping',
  department_store: 'shopping',
  electronics_store: 'shopping',
  jewelry_store: 'shopping',
  park: 'park',
  beach: 'beach',
  natural_feature: 'park',
};

// Type definition for place categories
export type PlaceCategory = keyof typeof CATEGORY_ICONS;

// Interface for geographical coordinates
export interface Coordinates {
  lat: number;
  lng: number;
}

// Interface for pinned places on the map
export interface PinnedPlace {
  id: number;
  name: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  category?: PlaceCategory;
  placeId?: string;
}

// Interface for detailed place information
export interface PlaceDetails {
  place_id: string;
  name: string;
  formatted_address: string;
  formatted_phone_number?: string;
  rating?: number;
  user_ratings_total?: number;
  opening_hours?: {
    weekday_text: string[];
    isOpen: () => boolean;
    periods?: {
      open: { day: number; time: string; };
      close: { day: number; time: string; };
    }[];
  };
  website?: string;
  photos?: google.maps.places.PlacePhoto[];
  reviews?: google.maps.places.PlaceReview[];
  geometry?: google.maps.places.PlaceGeometry;
  types?: string[];
  price_level?: number;
  business_status?: string;
  url?: string; // Google Maps URL
  // Additional properties for enhanced place details
  reservable?: boolean;
  serves_food?: boolean;
  takeout?: boolean;
  delivery?: boolean;
  dine_in?: boolean;
  located_in?: string;
  menu_url?: string | undefined;
  booking_url?: string | undefined;
  check_in_time?: string;
  check_out_time?: string;
  // Properties to make this compatible with the intersection type when spreading from Google Places object
  [key: string]: any;
}

/**
 * Generates an SVG icon configuration for a specific place category
 * @param category - The category of the place
 * @returns Google Maps Icon configuration object
 */
export const getCategoryIcon = (category: PlaceCategory = 'attraction') => {
  // First, ensure Google Maps is loaded
  if (!window.google || !window.google.maps) {
    console.warn('Google Maps not loaded yet, cannot create icon');
    return {};
  }

  const IconComponent = CATEGORY_ICONS[category];
  const svgString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
    ${IconComponent ? IconComponent({}).props.children : ''}
  </svg>`;

  return {
    url: `data:image/svg+xml;base64,${btoa(svgString)}`,
    scaledSize: new google.maps.Size(32, 32),
    anchor: new google.maps.Point(16, 16),
    fillColor: "#1E88E5",
    fillOpacity: 1,
    strokeWeight: 2,
    strokeColor: "#FFFFFF",
  };
};

/**
 * Gets the primary category from Google Places types
 * @param types - Array of place types from Google Places API
 * @returns The primary category for the place
 */
export const getPrimaryCategory = (types: string[] = []): { category: PlaceCategory, label: string } => {
  // First check for exact matches
  for (const type of types) {
    if (type in PLACE_TYPE_TO_CATEGORY) {
      return {
        category: PLACE_TYPE_TO_CATEGORY[type],
        label: type
          .split('_')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
          .replace(/And/g, '&') // Replace "And" with "&" for better presentation
      };
    }
  }

  // If no exact match, check for partial matches
  for (const type of types) {
    for (const [key, value] of Object.entries(PLACE_TYPE_TO_CATEGORY)) {
      if (type.includes(key)) {
        return {
          category: value,
          label: type
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ')
            .replace(/And/g, '&')
        };
      }
    }
  }

  // Default to attraction if no match found
  return {
    category: 'attraction',
    label: types[0]
      ?.split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
      .replace(/And/g, '&') || 'Point of Interest'
  };
};

/**
 * Custom hook for managing Google Maps Places service
 * @returns Object containing Places service reference and methods
 */
export const usePlacesService = () => {
  const placesService = useRef<google.maps.places.PlacesService | null>(null);

  // Initialize Places service with a map instance
  const initPlacesService = useCallback((map: google.maps.Map) => {
    placesService.current = new google.maps.places.PlacesService(map);
  }, []);

  // Fetch detailed information about a specific place
  const getPlaceDetails = useCallback((
    requestedPlaceId: string,
    callback: (place: PlaceDetails | null, status: google.maps.places.PlacesServiceStatus) => void
  ) => {
    if (!placesService.current) {
      console.error('Places service not initialized');
      callback(null, google.maps.places.PlacesServiceStatus.UNKNOWN_ERROR);
      return;
    }

    const request = {
      placeId: requestedPlaceId,
      fields: [
        'name',
        'formatted_address',
        'formatted_phone_number',
        'rating',
        'user_ratings_total',
        'opening_hours',
        'website',
        'photos',
        'reviews',
        'place_id',
        'geometry',
        'types',
        'price_level',
        'business_status',
        'url'
      ],
    };

    placesService.current.getDetails(request, (place, status) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && place) {
        // Process additional fields based on available data
        const processedPlace: PlaceDetails = {
          ...place,
          // Ensure required fields are always set
          place_id: place.place_id || requestedPlaceId,
          name: place.name || 'Unnamed Place',
          formatted_address: place.formatted_address || 'No address available',
          // Fix opening hours compatibility
          opening_hours: place.opening_hours ? {
            weekday_text: place.opening_hours.weekday_text || [],
            isOpen: () => place.opening_hours?.isOpen() || false,
            periods: place.opening_hours.periods?.map(period => ({
              open: {
                day: period.open?.day || 0,
                time: period.open?.time || '0000'
              },
              close: {
                day: period.close?.day || 0,
                time: period.close?.time || '2359'
              }
            }))
          } : undefined,
          // Derive reservable status from types and business_status
          reservable: place.types?.includes('restaurant') || place.types?.includes('lodging'),
          // Derive dining options from types
          dine_in: place.types?.includes('restaurant'),
          takeout: place.types?.includes('meal_takeaway'),
          delivery: place.types?.includes('meal_delivery'),
          // Use Google Maps URL for booking
          booking_url: place.url,
          // Other fields
          menu_url: undefined,
          located_in: undefined
        };
        callback(processedPlace, status);
      } else {
        console.error('Failed to get place details:', status);
        callback(null, status);
      }
    });
  }, []);

  return {
    placesService,
    initPlacesService,
    getPlaceDetails,
  };
};

/**
 * Custom hook for managing map coordinates and geocoding
 * @param initialLocation - Initial location string to geocode or coordinates
 * @returns Object containing coordinates and geocoding methods
 */
export const useMapCoordinates = (initialLocation: string | { lat: number; lng: number }) => {
  // Default to San Francisco coordinates only as a fallback
  const defaultCoords = {
    lat: 37.7749,
    lng: -122.4194,
  };
  
  const [coordinates, setCoordinates] = useState<Coordinates>(
    // If initialLocation is coordinates, use them immediately
    typeof initialLocation === 'object' && 'lat' in initialLocation && 'lng' in initialLocation 
      ? initialLocation 
      : defaultCoords
  );
  const [isInitialized, setIsInitialized] = useState(
    // Consider initialized if we already have coordinates
    typeof initialLocation === 'object' && 'lat' in initialLocation && 'lng' in initialLocation
  );

  // Geocode a location string to coordinates
  const geocodeLocation = useCallback(async (location: string) => {
    if (!location || location.trim() === '') {
      console.log("Empty location string, using default coordinates");
      return defaultCoords;
    }
    
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
          location
        )}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`
      );

      if (!response.ok) {
        console.warn("Failed to geocode location, using default coordinates");
        return defaultCoords;
      }

      const data = await response.json();

      if (data.status === "OK" && data.results?.[0]?.geometry?.location) {
        const { lat, lng } = data.results[0].geometry.location;
        setCoordinates({ lat, lng });
        return { lat, lng };
      }

      console.warn("Location not found:", data.status);
      return defaultCoords;
    } catch (err) {
      console.error("Geocoding error:", err);
      return defaultCoords;
    }
  }, []);

  // Initialize coordinates once when component mounts
  useEffect(() => {
    if (isInitialized) return;
    
    if (typeof initialLocation === 'object' && 'lat' in initialLocation && 'lng' in initialLocation) {
      // If initial location is already coordinates, use them directly
      setCoordinates(initialLocation);
      setIsInitialized(true);
    } else if (typeof initialLocation === 'string' && initialLocation.trim() !== '') {
      // Only geocode if it's a non-empty string
      geocodeLocation(initialLocation)
        .then(() => setIsInitialized(true))
        .catch(() => setIsInitialized(true));
    } else {
      // Use default coordinates for empty input
      setIsInitialized(true);
    }
  }, [initialLocation, geocodeLocation, isInitialized]);

  return {
    coordinates,
    setCoordinates,
    geocodeLocation,
  };
};

/**
 * Custom hook for loading Google Maps script
 * @returns Object containing loading state and error information
 */
export const useGoogleMapsScript = () => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Listen for specific error messages from the console
  useEffect(() => {
    const originalConsoleError = console.error;
    
    console.error = (...args: any[]) => {
      const errorString = args.join(' ');
      if (errorString.includes('BillingNotEnabledMapError')) {
        setErrorMessage("Google Maps billing is not enabled. Please contact the administrator.");
      } else if (errorString.includes('RefererNotAllowedMapError')) {
        setErrorMessage("This website is not authorized to use Google Maps API.");
      } else if (errorString.includes('InvalidKeyMapError')) {
        setErrorMessage("Invalid Google Maps API key.");
      }
      originalConsoleError(...args);
    };
    
    return () => {
      console.error = originalConsoleError;
    };
  }, []);
  
  const scriptStatus = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries: libraries,
    version: "weekly", // Use the latest version
    language: "en",
    region: "US",
    preventGoogleFontsLoading: false, // Allow Google Fonts for better map rendering
  });
  
  // Set error message if script loading fails
  useEffect(() => {
    if (scriptStatus.loadError) {
      if (scriptStatus.loadError.message?.includes("BillingNotEnabledMapError")) {
        setErrorMessage("Google Maps billing is not enabled. Please contact the administrator.");
      } else {
        setErrorMessage(`Error loading Google Maps: ${scriptStatus.loadError.message || "Unknown error"}`);
      }
    }
  }, [scriptStatus.loadError]);
  
  return {
    ...scriptStatus,
    errorMessage
  };
};

// Export components from @react-google-maps/api
export { GoogleMap, MarkerF };

// Interface for search result markers
export interface SearchResultMarker {
  id: string;
  position: Coordinates;
  place: PlaceSearchResult;
  isSelected?: boolean;
  onClick?: () => void;
}

// Interface for PlaceSearchResult (matching the places/search.ts file)
export interface PlaceSearchResult {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  opening_hours?: {
    open_now: boolean;
  };
  types: string[];
  photos?: google.maps.places.PlacePhoto[];
  vicinity?: string;
  business_status?: string;
}


/**
 * Helper function to get the category icon for a place
 */
const getCategoryForPlace = (types: string[]): keyof typeof CATEGORY_ICONS | null => {
  if (!types || types.length === 0) return null;
  
  for (const type of types) {
    if (PLACE_TYPE_TO_CATEGORY[type]) {
      return PLACE_TYPE_TO_CATEGORY[type];
    }
  }
  return null;
};

/**
 * Helper function to create category icon SVG
 */
const createCategoryIconSVG = (category: keyof typeof CATEGORY_ICONS | null, isSelected: boolean): string => {
  const color = isSelected ? '#22c55e' : '#ea4335';
  
  // Icon path data for different categories
  const iconPaths: Record<keyof typeof CATEGORY_ICONS, string> = {
    restaurant: 'M8.1 13.34l2.83-2.83L3.91 3.5c-1.56 1.56-1.56 4.09 0 5.66l4.19 4.18zm6.78-1.81c1.53.71 3.68.21 5.27-1.38 1.91-1.91 2.28-4.65.81-6.12-1.46-1.46-4.2-1.1-6.12.81-1.59 1.59-2.09 3.74-1.38 5.27L3.7 19.87l1.41 1.41L12 14.41l6.88 6.88 1.41-1.41L13.41 13l1.47-1.47z',
    hotel: 'M7 13c1.66 0 3-1.34 3-3S8.66 7 7 7s-3 1.34-3 3 1.34 3 3 3zm12-6h-8v7H3V5H1v15h2v-3h18v3h2v-9c0-2.21-1.79-4-4-4z',
    attraction: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
    shopping: 'M18 6h-2c0-2.21-1.79-4-4-4S8 3.79 8 6H6c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6-2c1.1 0 2 .9 2 2h-4c0-1.1.9-2 2-2zm6 16H6V8h2v2c0 .55.45 1 1 1s1-.45 1-1V8h4v2c0 .55.45 1 1 1s1-.45 1-1V8h2v12z',
    beach: 'M13.127 14.56l1.43-1.43 6.44 6.443L19.57 21zm4.293-5.73l2.86-2.86c-3.95-3.95-10.35-3.96-14.3-.02 3.93-1.3 8.31-.25 11.44 2.88zM5.95 5.98c-3.94 3.95-3.93 10.35.02 14.3l2.86-2.86C5.7 14.29 4.65 9.91 5.95 5.98zm.02-.02l-.01.01c-.38 3.01 1.17 6.88 4.3 10.02l5.73-5.73c-3.13-3.13-7.01-4.68-10.02-4.3z',
    nightlife: 'M21 5V3H3v2l8 9v5H6v2h12v-2h-5v-5l8-9zM7.43 7L5.66 5h12.69l-1.78 2H7.43z',
    store: 'M20 4H4v2h16V4zm1 10v-2l-1-5H4l-1 5v2h1v6h10v-6h4v6h2v-6h1zm-9 4H6v-4h6v4z',
    park: 'M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66.95-2.66c.48.17.98.26 1.34.26C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75C7 8 17 8 17 8z',
  };

  const path = category ? iconPaths[category] : '';
  
  return `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="${color}" xmlns="http://www.w3.org/2000/svg">
      ${path ? `<path d="${path}"/>` : ''}
    </svg>
  `;
};

/**
 * Helper function to create pin icon SVG (for hover state)
 */
const createPinIconSVG = (isSelected: boolean): string => {
  const color = isSelected ? '#22c55e' : '#ea4335';
  return `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="${color}" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
    </svg>
  `;
};

/**
 * Helper function to create custom marker element with category icon
 */
const createCustomMarkerElement = (
  category: keyof typeof CATEGORY_ICONS | null,
  isSelected: boolean,
  isHovered: boolean
): HTMLElement => {
  const container = document.createElement('div');
  container.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background: white;
    border-radius: 50%;
    border: 3px solid ${isSelected ? '#22c55e' : '#ea4335'};
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    cursor: pointer;
    position: relative;
  `;
  
  // Use pin icon when hovered or selected, otherwise use category icon
  const iconSVG = (isHovered || isSelected) ? createPinIconSVG(isSelected) : createCategoryIconSVG(category, isSelected);
  container.innerHTML = iconSVG;
  
  return container;
};

/**
 * Component for rendering search result markers using AdvancedMarkerElement with category icons
 * Supports hover and selection states with CSS animations and icon swapping
 */
export const SearchResultMarkers = ({
  markers,
  map,
  onMarkerClick,
  selectedMarkerId,
  hoveredMarkerId,
  onMarkerHover
}: {
  markers: SearchResultMarker[];
  map: google.maps.Map | null;
  onMarkerClick?: (marker: SearchResultMarker) => void;
  selectedMarkerId?: string | null;
  hoveredMarkerId?: string | null;
  onMarkerHover?: (markerId: string | null) => void;
}) => {
  const markersRef = useRef<Map<string, google.maps.marker.AdvancedMarkerElement>>(new Map());
  const markerElementsRef = useRef<Map<string, HTMLElement>>(new Map());
  const markerCategoriesRef = useRef<Map<string, keyof typeof CATEGORY_ICONS | null>>(new Map());

  useEffect(() => {
    if (!map || !window.google?.maps?.marker) {
      return;
    }

    // Clear existing markers
    markersRef.current.forEach(marker => {
      marker.map = null;
    });
    markersRef.current.clear();
    markerElementsRef.current.clear();
    markerCategoriesRef.current.clear();

    // Create new markers with custom elements
    markers.forEach((markerData) => {
      const isSelected = selectedMarkerId === markerData.id;
      const category = getCategoryForPlace(markerData.place.types);
      
      // Create custom marker element
      const markerElement = createCustomMarkerElement(category, isSelected, false);
      markerElement.classList.add('search-result-marker');
      markerElement.setAttribute('data-marker-id', markerData.id);
      
      // Apply initial state classes
      if (isSelected) {
        markerElement.classList.add('is-selected');
      }

      // Create AdvancedMarkerElement
      const marker = new google.maps.marker.AdvancedMarkerElement({
        map: map,
        position: markerData.position,
        title: markerData.place.name,
        content: markerElement,
        zIndex: isSelected ? google.maps.Marker.MAX_ZINDEX + 2 : undefined,
      });

      // Add click handler
      marker.addListener('click', () => {
        if (onMarkerClick) {
          onMarkerClick(markerData);
        }
      });

      // Add hover handlers for bidirectional sync
      if (onMarkerHover) {
        markerElement.addEventListener('mouseenter', () => {
          onMarkerHover(markerData.id);
        });
        markerElement.addEventListener('mouseleave', () => {
          onMarkerHover(null);
        });
      }

      markersRef.current.set(markerData.id, marker);
      markerElementsRef.current.set(markerData.id, markerElement);
      markerCategoriesRef.current.set(markerData.id, category);
    });

    // Cleanup function
    return () => {
      markersRef.current.forEach(marker => {
        marker.map = null;
      });
      markersRef.current.clear();
      markerElementsRef.current.clear();
      markerCategoriesRef.current.clear();
    };
  }, [markers, map, onMarkerClick, onMarkerHover, selectedMarkerId]);

  // Update marker states when selectedMarkerId or hoveredMarkerId changes
  useEffect(() => {
    markerElementsRef.current.forEach((element, markerId) => {
      const marker = markersRef.current.get(markerId);
      const category = markerCategoriesRef.current.get(markerId) ?? null;
      if (!marker) return;

      const isSelected = selectedMarkerId === markerId;
      const isHovered = hoveredMarkerId === markerId;

      // Update classes
      element.classList.toggle('is-selected', isSelected);
      element.classList.toggle('is-hovered', isHovered && !isSelected);

      // Update z-index
      marker.zIndex = isSelected 
        ? google.maps.Marker.MAX_ZINDEX + 2 
        : (isHovered ? google.maps.Marker.MAX_ZINDEX + 1 : undefined);

      // Update the icon: show pin when hovered or selected, otherwise show category icon
      const iconSVG = (isHovered || isSelected) ? createPinIconSVG(isSelected) : createCategoryIconSVG(category, isSelected);
      element.innerHTML = iconSVG;
      
      // Update border color
      element.style.borderColor = isSelected ? '#22c55e' : '#ea4335';
    });
  }, [selectedMarkerId, hoveredMarkerId]);

  return null; // This component doesn't render React elements
};

/**
 * Hook to manage search result markers with clustering
 */
export const useSearchResultMarkers = (
  map: google.maps.Map | null,
  places: PlaceSearchResult[],
  onPlaceClick?: (place: PlaceSearchResult) => void
) => {
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);

  const markers: SearchResultMarker[] = places.map(place => ({
    id: place.place_id,
    position: {
      lat: place.geometry.location.lat,
      lng: place.geometry.location.lng,
    },
    place,
    isSelected: selectedPlaceId === place.place_id,
  }));

  const handleMarkerClick = useCallback((marker: SearchResultMarker) => {
    setSelectedPlaceId(marker.id);
    if (onPlaceClick) {
      onPlaceClick(marker.place);
    }
  }, [onPlaceClick]);

  return {
    markers,
    selectedPlaceId,
    setSelectedPlaceId,
    handleMarkerClick,
  };
};