import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Camera } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPhotoUrl } from '@/lib/places/photo-utils';

interface PhotoCarouselProps {
  photos: google.maps.places.PlacePhoto[];
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
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  // Limit photos to maxPhotos
  const displayPhotos = photos.slice(0, maxPhotos);

  // Hide carousel if less than 2 photos
  if (displayPhotos.length < 2) {
    return null;
  }

  // Generate photo URLs using getUrl() method
  useEffect(() => {
    const urls = displayPhotos.map(photo => getPhotoUrl(photo));
    setPhotoUrls(urls);
  }, [photos]);

  // Preload adjacent images
  useEffect(() => {
    if (photoUrls.length === 0) return;
    
    const imagesToPreload = [
      selectedIndex,
      (selectedIndex + 1) % photoUrls.length,
      (selectedIndex - 1 + photoUrls.length) % photoUrls.length
    ];

    imagesToPreload.forEach(index => {
      if (!loadedImages.has(index) && !failedImages.has(index) && photoUrls[index]) {
        const img = new Image();
        img.src = photoUrls[index];
        img.onload = () => {
          setLoadedImages(prev => new Set(prev).add(index));
        };
        img.onerror = () => {
          setFailedImages(prev => new Set(prev).add(index));
        };
      }
    });
  }, [selectedIndex, photoUrls, loadedImages, failedImages]);

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
  const currentPhotoUrl = photoUrls[selectedIndex];
  const currentAttribution = currentPhoto?.html_attributions?.[0];
  const [showAttribution, setShowAttribution] = useState(false);

  if (!currentPhotoUrl) {
    return null;
  }

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
          src={currentPhotoUrl}
          alt={`${placeName} - Photo ${selectedIndex + 1}`}
          className="w-full h-full object-cover"
          loading="eager"
          data-testid="carousel-image"
          onLoad={() => {
            setLoadedImages(prev => new Set(prev).add(selectedIndex));
            setShowAttribution(true);
          }}
          onError={() => {
            setFailedImages(prev => new Set(prev).add(selectedIndex));
            setShowAttribution(false);
          }}
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

      {/* Photo Attribution - only show after image loads */}
      {showAttribution && currentAttribution && loadedImages.has(selectedIndex) && (
        <div 
          className="absolute top-2 left-2 bg-black/60 text-white px-2 py-1 rounded-md text-xs max-w-[80%]"
          dangerouslySetInnerHTML={{ __html: currentAttribution }}
        />
      )}
    </div>
  );
}
