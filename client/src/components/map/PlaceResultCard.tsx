import { useState, useEffect } from 'react';
import { Star, MapPin, Phone, Globe, Clock, ExternalLink, Plus, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { PlaceSearchResult } from '@/lib/places/search';
import { cn } from '@/lib/utils';

interface PlaceResultCardProps {
  place: PlaceSearchResult;
  distance: number; // in km
  isSelected: boolean;
  onCardClick: () => void;
  onSaveClick: (e: React.MouseEvent) => void;
  onAddToItinerary?: (e: React.MouseEvent) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export function PlaceResultCard({
  place,
  distance,
  isSelected,
  onCardClick,
  onSaveClick,
  onAddToItinerary,
  onMouseEnter,
  onMouseLeave,
}: PlaceResultCardProps) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState(false);

  // Get photo URL
  useEffect(() => {
    if (place.photos && place.photos.length > 0 && !photoError) {
      try {
        const url = place.photos[0].getUrl({ maxWidth: 200, maxHeight: 150 });
        setPhotoUrl(url);
      } catch (error) {
        console.error('Error loading photo:', error);
        setPhotoError(true);
      }
    }
  }, [place.photos, photoError]);

  // Get primary category
  const getPrimaryCategory = () => {
    if (!place.types || place.types.length === 0) return 'Place';
    
    const typeMap: Record<string, string> = {
      restaurant: 'Restaurant',
      cafe: 'Café',
      bar: 'Bar',
      night_club: 'Nightclub',
      lodging: 'Hotel',
      park: 'Park',
      museum: 'Museum',
      shopping_mall: 'Shopping',
      tourist_attraction: 'Attraction',
      store: 'Store',
    };
    
    for (const type of place.types) {
      if (typeMap[type]) {
        return typeMap[type];
      }
    }
    
    return place.types[0].replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Get price level display
  const getPriceLevel = () => {
    if (!place.price_level) return null;
    return '$'.repeat(place.price_level);
  };

  // Get opening status
  const getOpeningStatus = () => {
    if (!place.opening_hours) return null;
    return place.opening_hours.open_now ? (
      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
        <Clock className="h-3 w-3 mr-1" />
        Open Now
      </Badge>
    ) : (
      <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-300">
        <Clock className="h-3 w-3 mr-1" />
        Closed
      </Badge>
    );
  };

  // Get Google Maps directions link
  const getDirectionsLink = () => {
    const { lat, lng } = place.geometry.location;
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  };

  return (
    <Card
      className={cn(
        "group cursor-pointer transition-all hover:shadow-md border",
        isSelected ? "border-primary ring-2 ring-primary/20 bg-primary/5" : "border-border hover:border-primary/50"
      )}
      onClick={onCardClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onCardClick();
        }
      }}
      aria-label={`View details for ${place.name}`}
    >
      <div className="flex gap-3 p-3">
        {/* Thumbnail */}
        <div className="flex-shrink-0">
          {photoUrl && !photoError ? (
            <img
              src={photoUrl}
              alt={place.name}
              className="w-20 h-20 object-cover rounded-md"
              loading="lazy"
              onError={() => setPhotoError(true)}
            />
          ) : (
            <div className="w-20 h-20 bg-muted rounded-md flex items-center justify-center">
              <MapPin className="h-8 w-8 text-muted-foreground/40" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1">
          {/* Name */}
          <h4 className="font-semibold text-sm line-clamp-1 group-hover:text-primary transition-colors">
            {place.name}
          </h4>

          {/* Rating and Category */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {place.rating && (
              <div className="flex items-center gap-1">
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                <span className="font-medium">{place.rating.toFixed(1)}</span>
                {place.user_ratings_total && (
                  <span className="text-muted-foreground">({place.user_ratings_total})</span>
                )}
              </div>
            )}
            
            {getPriceLevel() && (
              <span className="text-muted-foreground">{getPriceLevel()}</span>
            )}
            
            <Badge variant="secondary" className="text-xs">
              {getPrimaryCategory()}
            </Badge>
          </div>

          {/* Address */}
          {place.vicinity && (
            <p className="text-xs text-muted-foreground line-clamp-1">
              {place.vicinity}
            </p>
          )}

          {/* Distance and Status */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Navigation className="h-3 w-3" />
              {distance < 1 
                ? `${(distance * 1000).toFixed(0)}m` 
                : `${distance.toFixed(1)}km`}
            </span>
            
            {getOpeningStatus()}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="border-t px-3 py-2 flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs"
          onClick={onSaveClick}
          aria-label={`Save ${place.name}`}
        >
          <Plus className="h-3 w-3 mr-1" />
          Save
        </Button>
        
        {onAddToItinerary && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={onAddToItinerary}
            aria-label={`Add ${place.name} to itinerary`}
          >
            <Plus className="h-3 w-3 mr-1" />
            Itinerary
          </Button>
        )}
        
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs ml-auto"
          onClick={(e) => {
            e.stopPropagation();
            window.open(getDirectionsLink(), '_blank');
          }}
          aria-label={`Get directions to ${place.name}`}
        >
          <ExternalLink className="h-3 w-3 mr-1" />
          Directions
        </Button>
      </div>
    </Card>
  );
}
