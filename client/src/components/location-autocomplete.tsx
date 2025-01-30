import { useLoadScript } from "@react-google-maps/api";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const libraries: ("places")[] = ["places"];

interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string, coordinates?: { lat: number; lng: number }) => void;
  placeholder?: string;
  className?: string;
}

export function LocationAutocomplete({
  value,
  onChange,
  placeholder = "Enter a location",
  className,
}: LocationAutocompleteProps) {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries,
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialize Google Places Autocomplete when the input is mounted
  const attachAutocomplete = (input: HTMLInputElement) => {
    if (!input || !isLoaded) return;

    try {
      const autocomplete = new google.maps.places.Autocomplete(input, {
        types: ["(cities)"],
        fields: ["formatted_address", "geometry", "name"],
      });

      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();

        if (!place?.geometry?.location) {
          return;
        }

        const coordinates = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        };

        const address = place.formatted_address || place.name || "";
        onChange(address, coordinates);
      });
    } catch (err) {
      console.error("Failed to initialize Places Autocomplete:", err);
      setError(`Failed to initialize location search: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  if (loadError || !import.meta.env.VITE_GOOGLE_MAPS_API_KEY) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Error loading Google Maps API. Please check your API key configuration.
        </AlertDescription>
      </Alert>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center gap-2">
        <Input disabled placeholder="Loading..." className={className} />
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  return (
    <Input
      ref={(el) => {
        inputRef.current = el;
        if (el) attachAutocomplete(el);
      }}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={className}
      autoComplete="off"
    />
  );
}