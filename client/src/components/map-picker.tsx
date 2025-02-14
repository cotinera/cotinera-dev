import { useLoadScript, GoogleMap, MarkerF } from "@react-google-maps/api";
import { Loader2 } from "lucide-react";
import { useState, useCallback, useEffect } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LocationSearchBar } from "./location-search-bar";

const libraries: ("places")[] = ["places"];

// Default coordinates (San Francisco) when no initial center is provided
const DEFAULT_COORDINATES = {
  lat: 37.7749,
  lng: -122.4194
};

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
  // Initialize coordinates with initialCenter or default coordinates
  const [coordinates, setCoordinates] = useState<google.maps.LatLngLiteral>(
    initialCenter && initialCenter.lat && initialCenter.lng
      ? initialCenter
      : DEFAULT_COORDINATES
  );

  const [mapCenter, setMapCenter] = useState<google.maps.LatLngLiteral>(coordinates);
  const [map, setMap] = useState<google.maps.Map | null>(null);

  // Update coordinates and map center when initialCenter changes
  useEffect(() => {
    if (initialCenter && initialCenter.lat && initialCenter.lng) {
      const newCoords = {
        lat: initialCenter.lat,
        lng: initialCenter.lng
      };
      setCoordinates(newCoords);
      setMapCenter(newCoords);
      // If map exists, pan to the new location
      if (map) {
        map.panTo(newCoords);
      }
    }
  }, [initialCenter, map]);

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries,
  });

  // Handle map load
  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
    // Set initial position when map loads
    if (initialCenter && initialCenter.lat && initialCenter.lng) {
      const position = {
        lat: initialCenter.lat,
        lng: initialCenter.lng
      };
      map.panTo(position);
      setMapCenter(position);
    }
  }, [initialCenter]);

  // Handle map click events
  const handleMapClick = async (e: google.maps.MapMouseEvent) => {
    if (!e.latLng || readOnly) return;

    const lat = e.latLng.lat();
    const lng = e.latLng.lng();

    setCoordinates({ lat, lng });

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
        onChange(formattedAddress, { lat, lng }, name);
      }
    } catch (err) {
      console.error("Reverse geocoding error:", err);
    }
  };

  // Handle map idle event to update center
  const onIdle = useCallback(() => {
    if (!map) return;
    const center = map.getCenter();
    if (center) {
      setMapCenter({ lat: center.lat(), lng: center.lng() });
    }
  }, [map]);

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
            onChange(address, coords || coordinates, name);
          }}
          placeholder={placeholder}
          className="flex-1"
          searchBias={mapCenter ? { ...mapCenter, radius: 5000 } : undefined}
          onInputRef={onSearchInputRef}
        />
      )}
      <div className={`${readOnly ? 'h-[400px]' : 'h-[300px]'} rounded-lg overflow-hidden border relative`}>
        <GoogleMap
          mapContainerStyle={{ width: "100%", height: "100%" }}
          zoom={13}
          center={mapCenter}
          onClick={handleMapClick}
          onLoad={onLoad}
          onIdle={onIdle}
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