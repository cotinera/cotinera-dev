import { useLoadScript } from "@react-google-maps/api";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Add styles to document head
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      .pac-container {
        z-index: 9999 !important;
        margin-top: 8px;
        border-radius: 0.5rem;
        border: 1px solid hsl(var(--border));
        background: hsl(var(--background));
        color: hsl(var(--foreground));
        font-family: inherit;
        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
      }
      .pac-item {
        padding: 8px 16px;
        cursor: pointer;
        border: none;
        font-family: inherit;
      }
      .pac-item:hover {
        background-color: hsl(var(--accent));
      }
      .pac-item-query {
        font-size: inherit;
        padding-right: 3px;
      }
    `;
    document.head.appendChild(styleElement);
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  useEffect(() => {
    if (!isLoaded || !inputRef.current) return;

    try {
      // Initialize autocomplete
      autocompleteRef.current = new google.maps.places.Autocomplete(
        inputRef.current,
        {
          types: ["(cities)"],
          fields: ["formatted_address", "geometry", "name"],
        }
      );

      // Add place_changed event listener
      const listener = autocompleteRef.current.addListener("place_changed", () => {
        const place = autocompleteRef.current?.getPlace();

        if (!place?.geometry?.location) {
          console.warn("Place selected but no geometry found");
          return;
        }

        const coordinates = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        };

        const address = place.formatted_address || place.name || "";
        onChange(address, coordinates);
      });

      return () => {
        if (google && listener) {
          google.maps.event.removeListener(listener);
        }
      };
    } catch (err) {
      console.error("Failed to initialize Places Autocomplete:", err);
      setError(`Failed to initialize location search: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [isLoaded, onChange]);

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
    <div className="relative">
      <Input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
    </div>
  );
}