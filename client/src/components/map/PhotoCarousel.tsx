import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Camera } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlacePhoto {
  photo_reference: string;
  height: number;
  width: number;
  html_attributions: string[];
}

interface PhotoCarouselProps {
  photos: PlacePhoto[];
  placeName: string;
  maxPhotos?: number;
  className?: string;
}

export function PhotoCarousel({ 
  photos, 
  placeName, 
  maxPhotos = 10,
  className 
}: PhotoCarouselProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set());
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  // Limit photos to maxPhotos
  const displayPhotos = photos.slice(0, maxPhotos);

  // Hide carousel if less than 2 photos
  if (displayPhotos.length < 2) {
    return null;
  }

  const getPhotoUrl = (photo: PlacePhoto, maxWidth: number = 800) => {
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${photo.photo_reference}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`;
  };

  // Preload adjacent images
  useEffect(() => {
    const imagesToPreload = [
      selectedIndex,
      (selectedIndex + 1) % displayPhotos.length,
      (selectedIndex - 1 + displayPhotos.length) % displayPhotos.length
    ];

    imagesToPreload.forEach(index => {
      if (!loadedImages.has(index) && !failedImages.has(index)) {
        const img = new Image();
        img.src = getPhotoUrl(displayPhotos[index]);
        img.onload = () => {
          setLoadedImages(prev => new Set(prev).add(index));
        };
        img.onerror = () => {
          setFailedImages(prev => new Set(prev).add(index));
        };
      }
    });
  }, [selectedIndex, displayPhotos, loadedImages, failedImages]);

  // Reset selected index when photos change
  useEffect(() => {
    setSelectedIndex(0);
    setLoadedImages(new Set());
    setFailedImages(new Set());
  }, [photos]);

  const goToNext = () => {
    setSelectedIndex((prev) => (prev + 1) % displayPhotos.length);
  };

  const goToPrevious = () => {
    setSelectedIndex((prev) => (prev - 1 + displayPhotos.length) % displayPhotos.length);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    
    const diff = touchStartX.current - touchEndX.current;
    const threshold = 50;

    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        goToNext();
      } else {
        goToPrevious();
      }
    }

    touchStartX.current = null;
    touchEndX.current = null;
  };

  const currentPhoto = displayPhotos[selectedIndex];
  const currentAttribution = currentPhoto?.html_attributions?.[0];

  return (
    <div className={cn("relative aspect-video overflow-hidden rounded-lg bg-muted", className)} data-testid="photo-carousel">
      {/* Main Image */}
      <div
        className="w-full h-full"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <img
          src={getPhotoUrl(currentPhoto, 800)}
          alt={`${placeName} - Photo ${selectedIndex + 1}`}
          className="w-full h-full object-cover"
          loading="eager"
          data-testid="carousel-image"
        />
      </div>

      {/* Photo Counter */}
      <div 
        className="absolute bottom-2 right-2 bg-black/60 text-white px-2 py-1 rounded-md text-xs flex items-center gap-1"
        data-testid="photo-counter"
      >
        <Camera className="h-3 w-3" />
        <span data-testid="photo-counter-text">{selectedIndex + 1} / {displayPhotos.length}</span>
      </div>

      {/* Navigation Arrows */}
      <button
        onClick={goToPrevious}
        className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full transition-colors"
        aria-label="Previous photo"
        data-testid="photo-prev-button"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        onClick={goToNext}
        className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full transition-colors"
        aria-label="Next photo"
        data-testid="photo-next-button"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      {/* Dot Indicators */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
        {displayPhotos.slice(0, Math.min(8, displayPhotos.length)).map((_, index) => (
          <button
            key={index}
            onClick={() => setSelectedIndex(index)}
            className={cn(
              "w-2 h-2 rounded-full transition-colors",
              index === selectedIndex ? "bg-white" : "bg-white/50"
            )}
            aria-label={`Go to photo ${index + 1}`}
          />
        ))}
        {displayPhotos.length > 8 && (
          <span className="text-white/70 text-xs ml-1">+{displayPhotos.length - 8}</span>
        )}
      </div>

      {/* Photo Attribution */}
      {currentAttribution && (
        <div 
          className="absolute top-2 left-2 bg-black/60 text-white px-2 py-1 rounded-md text-xs max-w-[80%]"
          dangerouslySetInnerHTML={{ __html: currentAttribution }}
        />
      )}
    </div>
  );
}
