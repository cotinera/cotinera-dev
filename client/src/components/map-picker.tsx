import { useLoadScript, GoogleMap, MarkerF } from "@react-google-maps/api";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const libraries: ("places")[] = ["places"];

interface MapPickerProps {
  value: string;
  onChange: (address: string, coordinates: { lat: number; lng: number }) => void;
  placeholder?: string;
}

export function MapPicker({
  value,
  onChange,
  placeholder = "Enter a location",
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

  // Function to geocode the entered address
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
      console.log("Geocoding response:", data); // Debug log

      if (data.status === "OK" && data.results?.[0]?.geometry?.location) {
        const { lat, lng } = data.results[0].geometry.location;
        setCoordinates({ lat, lng });
        onChange(data.results[0].formatted_address, { lat, lng });
      } else {
        console.error("Geocoding error:", data);
        setError(`Could not find location: ${data.status}`);
      }
    } catch (err) {
      console.error("Search error:", err);
      setError(err instanceof Error ? err.message : "Failed to find location");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle map clicks
  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;

    const lat = e.latLng.lat();
    const lng = e.latLng.lng();

    setCoordinates({ lat, lng });

    // Reverse geocode the clicked location
    fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${
        import.meta.env.VITE_GOOGLE_MAPS_API_KEY
      }`
    )
      .then((response) => response.json())
      .then((data) => {
        if (data.status === "OK" && data.results?.[0]) {
          onChange(data.results[0].formatted_address, { lat, lng });
        }
      })
      .catch((err) => {
        console.error("Reverse geocoding error:", err);
      });
  }, [onChange]);

  // Trigger search when value changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (value) {
        handleSearch();
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [value]);

  if (loadError) {
    console.error("Maps load error:", loadError);
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Error loading Google Maps. Please check your API key and ensure it has the correct permissions enabled.
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
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value, coordinates)}
          placeholder={placeholder}
          className="flex-1"
        />
        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
      </div>
      <div className="h-[300px] rounded-lg overflow-hidden border">
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
          <MarkerF position={coordinates} />
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