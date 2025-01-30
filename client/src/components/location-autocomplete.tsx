import { useLoadScript } from "@react-google-maps/api";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Define libraries array outside component to prevent recreation
const libraries: ("places")[] = ["places"];

interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelected?: (place: google.maps.places.PlaceResult) => void;
  placeholder?: string;
  className?: string;
}

export function LocationAutocomplete({
  value,
  onChange,
  onPlaceSelected,
  placeholder = "Enter a location",
  className,
}: LocationAutocompleteProps) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: apiKey || "",
    libraries,
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (!isLoaded || !inputRef.current || isInitialized) return;

    autocompleteRef.current = new google.maps.places.Autocomplete(
      inputRef.current,
      {
        types: ["(cities)"],
        fields: ["formatted_address", "geometry", "name"],
      }
    );

    autocompleteRef.current.addListener("place_changed", () => {
      const place = autocompleteRef.current?.getPlace();
      if (place?.formatted_address) {
        onChange(place.formatted_address);
        onPlaceSelected?.(place);
      }
    });

    setIsInitialized(true);
  }, [isLoaded, onChange, onPlaceSelected, isInitialized]);

  if (loadError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Error loading Google Maps API. Please check your API key configuration.
        </AlertDescription>
      </Alert>
    );
  }

  if (!apiKey) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Google Maps API key is not configured. Please set VITE_GOOGLE_MAPS_API_KEY in your environment.
        </AlertDescription>
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
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={className}
    />
  );
}