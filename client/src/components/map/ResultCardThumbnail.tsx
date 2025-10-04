import { useState, useEffect, useRef } from 'react';
import { MapPin, Utensils, Hotel, ShoppingBag, Landmark, Star, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPhotoService } from '@/lib/places/photo-service';

interface ResultCardThumbnailProps {
  placeId: string;
  placeName: string;
  placeTypes?: string[];
  photos?: google.maps.places.PlacePhoto[];
  map: google.maps.Map | null;
  className?: string;
}

// Category icon mapping
const getCategoryIcon = (types: string[] = []) => {
  const iconMap: Record<string, typeof MapPin> = {
    restaurant: Utensils,
    cafe: Utensils,
    bar: Utensils,
    food: Utensils,
    lodging: Hotel,
    hotel: Hotel,
    shopping_mall: ShoppingBag,
    store: ShoppingBag,
    tourist_attraction: Landmark,
    park: Landmark,
    museum: Landmark,
  };

  for (const type of types) {
    if (iconMap[type]) {
      return iconMap[type];
    }
  }

  return MapPin;
};

export function ResultCardThumbnail({
  placeId,
  placeName,
  placeTypes = [],
  photos,
  map,
  className,
}: ResultCardThumbnailProps) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasAttemptedFetch = useRef(false);

  const Icon = getCategoryIcon(placeTypes);

  // Try to get photo URL from existing photos first
  useEffect(() => {
    if (photos && photos.length > photoIndex && !hasError) {
      try {
        const photo = photos[photoIndex];
        // Check if the photo has getUrl method (from Details API)
        if (photo && typeof photo.getUrl === 'function') {
          const url = photo.getUrl({ maxWidth: 160, maxHeight: 160 });
          setPhotoUrl(url);
          setIsLoading(false);
          return;
        } else {
          // Photo doesn't have getUrl method (from Search API)
          // Will fall through to lazy fetching
          console.log('Photo does not have getUrl method, will use lazy fetch');
        }
      } catch (error) {
        console.error('Error getting photo URL:', error);
        // Try next photo
        if (photoIndex < photos.length - 1) {
          setPhotoIndex(photoIndex + 1);
          return;
        }
      }
    }
    // If no valid photos or getUrl not available, mark as ready for lazy fetch
    if (photos && photos.length > 0 && !hasError) {
      setIsLoading(true); // Will trigger lazy fetch
    }
  }, [photos, photoIndex, hasError]);

  // Lazy fetch photos using IntersectionObserver
  useEffect(() => {
    // Skip if no map, already attempted fetch, or already have a photo URL
    if (!map || hasAttemptedFetch.current || photoUrl) {
      return;
    }
    
    // Skip if we have photos with valid getUrl method
    if (photos && photos.length > 0 && photos[0] && typeof photos[0].getUrl === 'function') {
      return;
    }

    const observer = new IntersectionObserver(
      async (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !hasAttemptedFetch.current) {
          hasAttemptedFetch.current = true;
          
          try {
            const photoService = getPhotoService(map);
            const url = await photoService.getPhotoUrl(placeId);
            
            if (url) {
              setPhotoUrl(url);
            } else {
              setHasError(true);
            }
          } catch (error) {
            console.error('Error fetching photo:', error);
            setHasError(true);
          } finally {
            setIsLoading(false);
          }
        }
      },
      {
        rootMargin: '50px', // Start loading 50px before visible
        threshold: 0.01,
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [map, placeId, photoUrl, photos]);

  // Handle image error - try next photo
  const handleImageError = () => {
    if (photos && photoIndex < photos.length - 1) {
      setPhotoIndex(photoIndex + 1);
    } else {
      setHasError(true);
      setPhotoUrl(null);
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "w-20 h-20 rounded-xl flex-shrink-0 overflow-hidden bg-muted",
        className
      )}
      aria-label={`${placeName} photo`}
    >
      {isLoading && !photoUrl && !hasError ? (
        // Skeleton loader
        <div className="w-full h-full bg-muted animate-pulse" />
      ) : photoUrl && !hasError ? (
        // Photo
        <img
          src={photoUrl}
          alt={`${placeName} photo`}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={handleImageError}
        />
      ) : (
        // Fallback icon
        <div className="w-full h-full flex items-center justify-center">
          <Icon className="h-8 w-8 text-muted-foreground/40" />
        </div>
      )}
    </div>
  );
}
