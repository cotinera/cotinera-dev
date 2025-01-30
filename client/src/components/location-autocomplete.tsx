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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !inputRef.current || isInitialized) return;

    try {
      console.log("Initializing Places Autocomplete...");
      console.log("API Key available:", !!apiKey);
      console.log("Libraries loaded:", libraries);

      autocompleteRef.current = new google.maps.places.Autocomplete(
        inputRef.current,
        {
          types: ["(cities)"],
          fields: ["formatted_address", "geometry", "name"],
        }
      );

      console.log("Autocomplete instance created successfully");

      // Add the place_changed listener
      autocompleteRef.current.addListener("place_changed", () => {
        const place = autocompleteRef.current?.getPlace();
        console.log("Place selected:", place);

        // Update the input value with the selected place
        if (place?.formatted_address) {
          onChange(place.formatted_address);
          onPlaceSelected?.(place);

          // Ensure the input field is updated with the selected value
          if (inputRef.current) {
            inputRef.current.value = place.formatted_address;
          }
        }
      });

      setIsInitialized(true);
      setError(null);
      console.log("Places Autocomplete initialized successfully");
    } catch (err) {
      console.error("Failed to initialize Places Autocomplete:", err);
      setError(`Failed to initialize location search: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [isLoaded, onChange, onPlaceSelected, isInitialized, apiKey]);

  if (loadError) {
    console.error("Google Maps load error:", loadError);
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Error loading Google Maps API: {loadError.message}. Please make sure the Google Maps JavaScript API and Places API are enabled in your Google Cloud Console and that the API key is correct.
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
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={className}
    />
  );
}