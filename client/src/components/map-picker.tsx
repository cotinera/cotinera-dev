import { useLoadScript, GoogleMap, MarkerF } from "@react-google-maps/api";
import { Loader2 } from "lucide-react";
import { useState, useCallback, useEffect, useMemo } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LocationSearchBar } from "./location-search-bar";

const libraries: ("places")[] = ["places"];

interface PinnedPlace {
  id: number;
  name: string;
  coordinates: {
    lat: number;
    lng: number;
  };
}

interface MapPickerProps {
  value: string;
  onChange: (address: string, coordinates: { lat: number; lng: number }, name?: string) => void;
  placeholder?: string;
  existingPins?: PinnedPlace[];
  readOnly?: boolean;
  initialCenter?: { lat: number; lng: number } | null;
  searchBias?: { lat: number; lng: number; radius?: number };
  onSearchInputRef?: (ref: HTMLInputElement | null) => void;
}

// Default to London if no valid coordinates are provided
const DEFAULT_CENTER = {
  lat: 51.5074,
  lng: -0.1278
};

export function MapPicker({
  value,
  onChange,
  placeholder = "Enter a location",
  existingPins = [],
  readOnly = false,
  initialCenter,
  searchBias,
  onSearchInputRef,
}: MapPickerProps) {
  const [coordinates, setCoordinates] = useState<google.maps.LatLngLiteral | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);

  // Helper function to validate coordinates
  const isValidCoordinates = useCallback((coords: { lat: number; lng: number } | null | undefined): coords is { lat: number; lng: number } => {
    return !!coords &&
           typeof coords.lat === 'number' &&
           typeof coords.lng === 'number' &&
           !isNaN(coords.lat) &&
           !isNaN(coords.lng) &&
           coords.lat !== 0 &&
           coords.lng !== 0;
  }, []);

  // Determine effective center based on props and state
  const effectiveCenter = useMemo(() => {
    if (coordinates && isValidCoordinates(coordinates)) {
      return coordinates;
    }
    if (initialCenter && isValidCoordinates(initialCenter)) {
      return initialCenter;
    }
    if (searchBias && isValidCoordinates(searchBias)) {
      return searchBias;
    }
    return DEFAULT_CENTER;
  }, [coordinates, initialCenter, searchBias, isValidCoordinates]);

  // Update coordinates when initialCenter changes
  useEffect(() => {
    if (initialCenter && isValidCoordinates(initialCenter)) {
      setCoordinates(initialCenter);
    }
  }, [initialCenter, isValidCoordinates]);

  // Handle map load
  const onLoad = useCallback((newMap: google.maps.Map) => {
    setMap(newMap);

    // Center map on load using effectiveCenter
    if (effectiveCenter) {
      newMap.setCenter(effectiveCenter);
      newMap.setZoom(13); // Set appropriate zoom level
    }
  }, [effectiveCenter]);

  // Update map center when coordinates change
  useEffect(() => {
    if (map && effectiveCenter) {
      map.panTo(effectiveCenter);
    }
  }, [map, effectiveCenter]);

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries,
  });

  // Handle map click events
  const handleMapClick = async (e: google.maps.MapMouseEvent) => {
    if (!e.latLng || readOnly) return;

    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    const newCoords = { lat, lng };

    setCoordinates(newCoords);

    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${
          import.meta.env.VITE_GOOGLE_MAPS_API_KEY
        }`
      );

      const data = await response.json();

      if (data.status === "OK" && data.results?.[0]) {
        const formattedAddress = data.results[0].formatted_address;
        const name = data.results[0].address_components?.[0]?.long_name || formattedAddress;
        onChange(formattedAddress, newCoords, name);
      }
    } catch (err) {
      console.error("Reverse geocoding error:", err);
    }
  };

  if (loadError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Error loading Google Maps. Please check your API key configuration.
        </AlertDescription>
      </Alert>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-8 bg-muted animate-pulse rounded-md" />
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!readOnly && (
        <LocationSearchBar
          value={value}
          onChange={(address, coords, name) => {
            if (coords) {
              setCoordinates(coords);
            }
            onChange(address, coords || effectiveCenter, name);
          }}
          placeholder={placeholder}
          className="flex-1"
          searchBias={searchBias}
          onInputRef={onSearchInputRef}
        />
      )}
      <div className={`${readOnly ? 'h-[400px]' : 'h-[300px]'} rounded-lg overflow-hidden border relative`}>
        <GoogleMap
          mapContainerStyle={{ width: "100%", height: "100%" }}
          zoom={13}
          center={effectiveCenter}
          onClick={handleMapClick}
          onLoad={onLoad}
          options={{
            disableDefaultUI: true,
            zoomControl: true,
            scrollwheel: true,
          }}
        >
          {/* Show temporary marker for new pin */}
          {!readOnly && coordinates && <MarkerF position={coordinates} />}

          {/* Show existing pins */}
          {existingPins.map((pin) => (
            <MarkerF
              key={pin.id}
              position={pin.coordinates}
              title={pin.name}
            />
          ))}
        </GoogleMap>
      </div>
    </div>
  );
}