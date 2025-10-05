import { Star, MapPin, Navigation, Clock, Plus, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { PlaceSearchResult } from '@/lib/places/search';
import { ResultCardThumbnail } from './ResultCardThumbnail';
import { cn } from '@/lib/utils';

interface PlaceResultCardProps {
  place: PlaceSearchResult;
  distance: number; // in km
  isSelected: boolean;
  isHovered?: boolean;
  onCardClick: () => void;
  onSaveClick: (e: React.MouseEvent) => void;
  onAddToItinerary?: (e: React.MouseEvent) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  map?: google.maps.Map | null;
}

export function PlaceResultCard({
  place,
  distance,
  isSelected,
  isHovered = false,
  onCardClick,
  onSaveClick,
  onAddToItinerary,
  onMouseEnter,
  onMouseLeave,
  map,
}: PlaceResultCardProps) {
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

  // Get price level display (prevent NaN)
  const getPriceLevel = () => {
    if (!place.price_level || place.price_level < 1) return null;
    return '$'.repeat(Math.min(place.price_level, 4));
  };

  // Get opening status
  const getOpeningStatus = () => {
    if (!place.opening_hours) return null;
    return place.opening_hours.open_now ? (
      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300 text-xs">
        Open
      </Badge>
    ) : (
      <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-300 text-xs">
        Closed
      </Badge>
    );
  };

  // Get Google Maps directions link
  const getDirectionsLink = () => {
    const { lat, lng } = place.geometry.location;
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  };

  // Format rating (prevent NaN)
  const formatRating = (rating: number | undefined) => {
    if (!rating || isNaN(rating)) return null;
    return rating.toFixed(1);
  };

  const formattedRating = formatRating(place.rating);

  return (
    <Card
      className={cn(
        "group cursor-pointer transition-all hover:shadow-md border",
        isSelected 
          ? "border-primary ring-2 ring-primary/20 bg-primary/5" 
          : isHovered
            ? "border-primary/70 shadow-md bg-primary/5 ring-1 ring-primary/10"
            : "border-border hover:border-primary/50"
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
      <div className="p-3">
        {/* Desktop: horizontal layout with thumbnail on right */}
        <div className="hidden sm:flex gap-3">
          {/* Content - left side */}
          <div className="flex-1 min-w-0 space-y-1">
            {/* Name */}
            <h4 className="font-semibold text-sm line-clamp-1 group-hover:text-primary transition-colors">
              {place.name}
            </h4>

            {/* Rating and Category */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              {formattedRating && (
                <div className="flex items-center gap-1">
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  <span className="font-medium">{formattedRating}</span>
                  {place.user_ratings_total && place.user_ratings_total > 0 && (
                    <span className="text-muted-foreground">({place.user_ratings_total})</span>
                  )}
                </div>
              )}
              
              {getPriceLevel() && (
                <span className="text-green-600 font-medium">{getPriceLevel()}</span>
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

          {/* Thumbnail - right side */}
          <ResultCardThumbnail
            placeId={place.place_id}
            placeName={place.name}
            placeTypes={place.types}
            photos={place.photos}
            map={map ?? null}
            className="w-20 h-20"
          />
        </div>

        {/* Mobile: vertical layout with thumbnail below */}
        <div className="sm:hidden space-y-2">
          {/* Name and thumbnail */}
          <div className="space-y-2">
            <h4 className="font-semibold text-sm line-clamp-1 group-hover:text-primary transition-colors">
              {place.name}
            </h4>
            
            <ResultCardThumbnail
              placeId={place.place_id}
              placeName={place.name}
              placeTypes={place.types}
              photos={place.photos}
              map={map ?? null}
              className="w-full h-32"
            />
          </div>

          {/* Rating and Category */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {formattedRating && (
              <div className="flex items-center gap-1">
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                <span className="font-medium">{formattedRating}</span>
                {place.user_ratings_total && place.user_ratings_total > 0 && (
                  <span className="text-muted-foreground">({place.user_ratings_total})</span>
                )}
              </div>
            )}
            
            {getPriceLevel() && (
              <span className="text-green-600 font-medium">{getPriceLevel()}</span>
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
