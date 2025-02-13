import { useLoadScript, GoogleMap, MarkerF } from "@react-google-maps/api";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
  onChange: (address: string, coordinates: { lat: number; lng: number }) => void;
  placeholder?: string;
  existingPins?: PinnedPlace[];
  readOnly?: boolean;
}

export function MapPicker({
  value,
  onChange,
  placeholder = "Enter a location",
  existingPins = [],
  readOnly = false,
}: MapPickerProps) {
  const [coordinates, setCoordinates] = useState<google.maps.LatLngLiteral>({
    lat: 40.7128,
    lng: -74.0060, // Default to New York City
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries,
  });

  // Function to handle search input changes and geocoding
  const handleSearch = async () => {
    if (!value) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
          value
        )}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`
      );

      if (!response.ok) {
        throw new Error(`Geocoding failed: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.status === "OK" && data.results?.[0]?.geometry?.location) {
        const { lat, lng } = data.results[0].geometry.location;
        setCoordinates({ lat, lng });
        onChange(data.results[0].formatted_address, { lat, lng });
      } else {
        setError(`Could not find location: ${data.status}`);
      }
    } catch (err) {
      console.error("Search error:", err);
      setError(err instanceof Error ? err.message : "Failed to find location");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle map click events
  const handleMapClick = useCallback(async (e: google.maps.MapMouseEvent) => {
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
        onChange(data.results[0].formatted_address, { lat, lng });
      }
    } catch (err) {
      console.error("Reverse geocoding error:", err);
    }
  }, [onChange, readOnly]);

  // Search when value changes (with debounce)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (value) {
        handleSearch();
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [value]);

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
        <Input disabled placeholder="Loading..." />
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!readOnly && (
        <div className="flex gap-2">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value, coordinates)}
            placeholder={placeholder}
            className="flex-1"
          />
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        </div>
      )}
      <div className={`${readOnly ? 'h-[400px]' : 'h-[300px]'} rounded-lg overflow-hidden border relative`}>
        <GoogleMap
          mapContainerStyle={{ width: "100%", height: "100%" }}
          zoom={13}
          center={coordinates}
          onClick={handleMapClick}
          options={{
            disableDefaultUI: true,
            zoomControl: true,
            scrollwheel: true,
          }}
        >
          {/* Show temporary marker for new pin */}
          {!readOnly && <MarkerF position={coordinates} />}

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
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}