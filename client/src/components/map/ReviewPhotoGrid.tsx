import { useState } from 'react';
import { cn } from '@/lib/utils';

interface ReviewPhotoGridProps {
  photos: string[];
  reviewerName: string;
  placeName: string;
  maxThumbnails?: number;
}

export function ReviewPhotoGrid({ 
  photos, 
  reviewerName, 
  placeName,
  maxThumbnails = 4 
}: ReviewPhotoGridProps) {
  const [loadedPhotos, setLoadedPhotos] = useState<Set<number>>(new Set());
  const [failedPhotos, setFailedPhotos] = useState<Set<number>>(new Set());
  
  if (!photos || photos.length === 0) {
    return null;
  }
  
  const displayPhotos = photos.slice(0, maxThumbnails);
  const remainingCount = photos.length - maxThumbnails;
  
  const handleImageLoad = (index: number) => {
    setLoadedPhotos(prev => new Set(prev).add(index));
  };
  
  const handleImageError = (index: number) => {
    setFailedPhotos(prev => new Set(prev).add(index));
  };
  
  // Filter out failed photos
  const validPhotos = displayPhotos.filter((_, index) => !failedPhotos.has(index));
  
  if (validPhotos.length === 0) {
    return null;
  }
  
  return (
    <div 
      className="mt-3 -mx-3 px-3 py-2 bg-muted/30 rounded-md"
      data-testid="review-photo-grid"
      data-reviewer={reviewerName}
    >
      <div className="grid grid-cols-4 gap-2">
        {displayPhotos.map((photoUrl, index) => {
          if (failedPhotos.has(index)) return null;
          
          return (
            <div
              key={index}
              className={cn(
                "relative aspect-square rounded-md overflow-hidden bg-muted",
                "cursor-pointer hover:opacity-80 transition-opacity",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              )}
              tabIndex={0}
              role="button"
              aria-label={`Photo by ${reviewerName} at ${placeName}`}
              onClick={() => {
                // TODO: Open photo in lightbox/modal
                window.open(photoUrl, '_blank');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  window.open(photoUrl, '_blank');
                }
              }}
            >
              <img
                src={photoUrl}
                alt={`Photo by ${reviewerName} at ${placeName}`}
                className="w-full h-full object-cover"
                loading="lazy"
                onLoad={() => handleImageLoad(index)}
                onError={() => handleImageError(index)}
              />
              
              {/* Show loading state */}
              {!loadedPhotos.has(index) && !failedPhotos.has(index) && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                </div>
              )}
              
              {/* Show remaining count badge on last thumbnail */}
              {index === maxThumbnails - 1 && remainingCount > 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white font-semibold">
                  +{remainingCount}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
