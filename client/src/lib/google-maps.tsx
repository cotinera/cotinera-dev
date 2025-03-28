// Import required dependencies for Google Maps integration
import { useLoadScript, GoogleMap, MarkerF } from "@react-google-maps/api";
import { MdRestaurant, MdHotel } from "react-icons/md";
import { FaLandmark, FaShoppingBag, FaUmbrellaBeach, FaGlassCheers, FaStore, FaTree } from "react-icons/fa";
import { useEffect, useState, useCallback, useRef } from "react";
import type { Libraries } from "@react-google-maps/api";

// Define the required Google Maps libraries
const libraries: Libraries = ["places"];
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
  return useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries: libraries,
  });
};

// Export components from @react-google-maps/api
export { GoogleMap, MarkerF };