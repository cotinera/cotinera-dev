import { useCallback, useEffect, useState, useRef } from "react";
import { GoogleMap, DirectionsRenderer, useJsApiLoader } from "@react-google-maps/api";
import type { Destination } from "@db/schema";
import { Loader2 } from "lucide-react";

const mapContainerStyle = {
  width: "100%",
  height: "400px",
  borderRadius: "0.5rem",
};

const defaultCenter = {
  lat: 20.0,
  lng: -97.0,
};

interface MapRouteViewProps {
  destinations: Destination[];
}

// Animation easing function for smooth transitions
const easeInOutCubic = (t: number): number => {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

export function MapRouteView({ destinations }: MapRouteViewProps) {
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [bounds, setBounds] = useState<google.maps.LatLngBounds | null>(null);
  const [initialZoom, setInitialZoom] = useState(5);
  const mapRef = useRef<google.maps.Map | null>(null);
  const animationRef = useRef<number | null>(null);
  
  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: ["places"],
  });

  // Calculate adaptive zoom level based on distance between destinations
  const calculateInitialZoom = useCallback((bounds: google.maps.LatLngBounds) => {
    const WORLD_DIM = { height: 256, width: 256 };
    const ZOOM_MAX = 21;
    
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    
    const latFraction = (ne.lat() - sw.lat()) / 180;
    const lngFraction = (ne.lng() - sw.lng()) / 360;
    
    const latZoom = Math.floor(Math.log(400 / WORLD_DIM.height / latFraction) / Math.LN2);
    const lngZoom = Math.floor(Math.log(400 / WORLD_DIM.width / lngFraction) / Math.LN2);
    
    return Math.min(latZoom, lngZoom, ZOOM_MAX);
  }, []);

  const calculateRoute = useCallback(async () => {
    if (!window.google || destinations.length < 2) return;

    const directionsService = new google.maps.DirectionsService();
    const routeBounds = new google.maps.LatLngBounds();

    try {
      // Add all destinations to the bounds for better viewport calculation
      destinations.forEach(dest => {
        if (dest.coordinates) {
          routeBounds.extend(new google.maps.LatLng(
            dest.coordinates.lat,
            dest.coordinates.lng
          ));
        }
      });
      
      const adaptiveZoom = calculateInitialZoom(routeBounds);
      setInitialZoom(adaptiveZoom);
      setBounds(routeBounds);

      const origin = destinations[0];
      const destination = destinations[destinations.length - 1];
      const waypoints = destinations.slice(1, -1).map(dest => ({
        location: { lat: dest.coordinates.lat, lng: dest.coordinates.lng },
        stopover: true,
      }));

      const result = await directionsService.route({
        origin: { lat: origin.coordinates.lat, lng: origin.coordinates.lng },
        destination: { lat: destination.coordinates.lat, lng: destination.coordinates.lng },
        waypoints,
        travelMode: google.maps.TravelMode.DRIVING,
      });

      setDirections(result);
    } catch (error) {
      console.error("Error calculating route:", error);
    }
  }, [destinations, calculateInitialZoom]);

  // Handle smooth camera animations when map or destinations change
  const animateCamera = useCallback(() => {
    if (!mapRef.current || !bounds) return;
    
    const map = mapRef.current;
    const currentCenter = map.getCenter();
    const currentZoom = map.getZoom();
    
    if (!currentCenter || !currentZoom) return;
    
    // Calculate center point of the bounds
    const targetCenter = {
      lat: (bounds.getNorthEast().lat() + bounds.getSouthWest().lat()) / 2,
      lng: (bounds.getNorthEast().lng() + bounds.getSouthWest().lng()) / 2,
    };
    
    const targetZoom = initialZoom;
    let startTime: number | null = null;
    const duration = 1000; // 1 second animation
    
    // Clean up previous animation if any
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
    // Animation function
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeInOutCubic(progress);
      
      // Interpolate between current and target values
      const newLat = currentCenter.lat() + (targetCenter.lat - currentCenter.lat()) * easedProgress;
      const newLng = currentCenter.lng() + (targetCenter.lng - currentCenter.lng()) * easedProgress;
      const newZoom = currentZoom + (targetZoom - currentZoom) * easedProgress;
      
      map.setCenter({ lat: newLat, lng: newLng });
      map.setZoom(newZoom);
      
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };
    
    animationRef.current = requestAnimationFrame(animate);
  }, [bounds, initialZoom]);

  // Set up map reference
  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    if (bounds) {
      animateCamera();
    }
  }, [bounds, animateCamera]);

  useEffect(() => {
    if (isLoaded && destinations.length >= 2) {
      calculateRoute();
    }
  }, [isLoaded, destinations, calculateRoute]);

  useEffect(() => {
    if (mapRef.current && bounds) {
      animateCamera();
    }
    
    // Clean up animation on unmount
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [bounds, animateCamera]);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-[400px] bg-muted rounded-lg">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={mapContainerStyle}
      center={destinations[0]?.coordinates || defaultCenter}
      zoom={initialZoom}
      onLoad={onMapLoad}
      options={{
        disableDefaultUI: true,
        zoomControl: true,
        streetViewControl: true,
        mapTypeControl: true,
        gestureHandling: "cooperative",
        mapTypeId: google.maps.MapTypeId.TERRAIN
      }}
    >
      {directions && (
        <DirectionsRenderer
          directions={directions}
          options={{
            suppressMarkers: false,
            polylineOptions: {
              strokeColor: "hsl(var(--primary))",
              strokeWeight: 4,
              strokeOpacity: 0.8
            },
          }}
        />
      )}
    </GoogleMap>
  );
}
