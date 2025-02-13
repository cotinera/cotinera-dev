import { useLoadScript, GoogleMap, MarkerF } from "@react-google-maps/api";
import { Loader2 } from "lucide-react";
import { useState } from "react";
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

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries,
  });

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
        onChange(data.results[0].formatted_address, { lat, lng });
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
          onChange={(address, coords) => {
            if (coords) {
              setCoordinates(coords);
            }
            onChange(address, coords || coordinates);
          }}
          placeholder={placeholder}
          className="flex-1"
        />
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
    </div>
  );
}