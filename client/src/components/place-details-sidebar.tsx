import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  MapPin, 
  Star, 
  Clock, 
  Phone, 
  Globe, 
  Navigation, 
  Bookmark, 
  Share2,
  DollarSign,
  ExternalLink,
  User,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { placesDetailsService, PlaceDetailsData } from '@/lib/places/details-service';
import { PhotoCarousel } from '@/components/map/PhotoCarousel';
import { ReviewPhotoGrid } from '@/components/map/ReviewPhotoGrid';
import { mapPhotosToContributors, getPhotosForReviewer, getPhotoUrl } from '@/lib/places/photo-utils';

interface PlaceDetailsSidebarProps {
  placeId: string | null;
  onSelectPlace?: (address: string, coordinates: { lat: number; lng: number }, name: string, placeId?: string) => void;
  onClose?: () => void;
}

const formatPriceLevel = (priceLevel: number) => {
  return '$'.repeat(priceLevel);
};

const getPlaceCategory = (types: string[]) => {
  const priorityTypes = {
    restaurant: 'Restaurant',
    food: 'Food',
    lodging: 'Hotel',
    tourist_attraction: 'Attraction',
    shopping_mall: 'Shopping',
    store: 'Store',
    hospital: 'Hospital',
    bank: 'Bank',
    gas_station: 'Gas Station',
    park: 'Park'
  };
  
  for (const [type, label] of Object.entries(priorityTypes)) {
    if (types.includes(type)) {
      return label;
    }
  }
  
  return types[0]?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Place';
};

export function PlaceDetailsSidebar({ placeId, onSelectPlace, onClose }: PlaceDetailsSidebarProps) {
  const [placeDetails, setPlaceDetails] = useState<PlaceDetailsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);

  // Map photos to contributors for review photo matching
  const contributorPhotosMap = useMemo(() => {
    if (!placeDetails?.photos) return new Map<string, string[]>();
    return mapPhotosToContributors(placeDetails.photos);
  }, [placeDetails?.photos]);

  useEffect(() => {
    if (!placeId) {
      setPlaceDetails(null);
      setCurrentRequestId(null);
      return;
    }

    const fetchPlaceDetails = async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await placesDetailsService.fetchPlaceDetails(placeId);
        
        // Only update state if this request is still current
        if (result && placesDetailsService.isRequestCurrent(result.requestId)) {
          setPlaceDetails(result.data);
          setCurrentRequestId(result.requestId);
        }
      } catch (err) {
        console.error('Error fetching place details:', err);
        // Only show error if this request is still current
        if (err instanceof Error && !err.message.includes('superseded')) {
          setError(err.message || 'Failed to load place details');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchPlaceDetails();
  }, [placeId]);

  const handleSelectPlace = () => {
    if (placeDetails && onSelectPlace) {
      const coordinates = {
        lat: placeDetails.geometry.location.lat(),
        lng: placeDetails.geometry.location.lng()
      };
      onSelectPlace(placeDetails.formatted_address, coordinates, placeDetails.name, placeId || undefined);
      if (onClose) onClose();
    }
  };

  const getStreetViewUrl = (lat: number, lng: number) => {
    return `https://maps.googleapis.com/maps/api/streetview?size=800x450&location=${lat},${lng}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`;
  };

  if (!placeId) return null;

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Place Details</CardTitle>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-4">
            {loading && (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            )}

            {error && (
              <div className="text-center py-4">
                <p className="text-destructive text-sm">{error}</p>
              </div>
            )}

            {placeDetails && (
              <>
                {/* Photo Carousel - shows only if 2+ photos exist */}
                {placeDetails.photos && placeDetails.photos.length >= 2 && (
                  <PhotoCarousel 
                    photos={placeDetails.photos} 
                    placeName={placeDetails.name}
                    maxPhotos={10}
                  />
                )}

                {/* Single Photo or Street View Fallback */}
                {(!placeDetails.photos || placeDetails.photos.length < 2) && (
                  <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
                    {placeDetails.photos && placeDetails.photos.length === 1 ? (
                      <>
                        <img
                          src={getPhotoUrl(placeDetails.photos[0])}
                          alt={placeDetails.name}
                          className="w-full h-full object-cover"
                          onLoad={(e) => {
                            const attribution = placeDetails.photos?.[0]?.html_attributions?.[0];
                            if (attribution) {
                              const parent = (e.target as HTMLImageElement).parentElement;
                              if (parent && !parent.querySelector('.photo-attribution')) {
                                const attrDiv = document.createElement('div');
                                attrDiv.className = 'photo-attribution absolute top-2 left-2 bg-black/60 text-white px-2 py-1 rounded-md text-xs max-w-[80%]';
                                attrDiv.innerHTML = attribution;
                                parent.appendChild(attrDiv);
                              }
                            }
                          }}
                        />
                      </>
                    ) : (
                      // Street View only when NO photos available
                      <div className="relative w-full h-full">
                        <img
                          src={getStreetViewUrl(
                            placeDetails.geometry.location.lat(),
                            placeDetails.geometry.location.lng()
                          )}
                          alt={`Street view of ${placeDetails.name}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent) {
                              parent.innerHTML = `
                                <div class="w-full h-full flex items-center justify-center bg-muted">
                                  <div class="text-center text-muted-foreground">
                                    <svg class="h-12 w-12 mx-auto mb-2 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path>
                                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                    </svg>
                                    <p class="text-sm">No photos available</p>
                                  </div>
                                </div>
                              `;
                            }
                          }}
                        />
                        <div className="absolute bottom-2 right-2 bg-black/60 text-white px-2 py-1 rounded-md text-xs">
                          Street View
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Place Header */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h2 className="text-xl font-bold">{placeDetails.name}</h2>
                      <p className="text-muted-foreground text-sm">{getPlaceCategory(placeDetails.types)}</p>
                    </div>
                    <Button variant="outline" size="icon">
                      <Bookmark className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Rating and Reviews */}
                  {placeDetails.rating && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span className="font-medium">{placeDetails.rating.toFixed(1)}</span>
                      </div>
                      {placeDetails.user_ratings_total && (
                        <span className="text-muted-foreground text-sm">({placeDetails.user_ratings_total} reviews)</span>
                      )}
                      {placeDetails.price_level && (
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-4 w-4 text-green-600" />
                          <span className="text-green-600 font-medium">{formatPriceLevel(placeDetails.price_level)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Address */}
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <span className="text-sm">{placeDetails.formatted_address}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <Button className="flex flex-col h-16 gap-1" onClick={handleSelectPlace}>
                    <Navigation className="h-4 w-4" />
                    <span className="text-xs">Select</span>
                  </Button>
                  {placeDetails.formatted_phone_number && (
                    <Button variant="outline" className="flex flex-col h-16 gap-1" asChild>
                      <a href={`tel:${placeDetails.formatted_phone_number}`}>
                        <Phone className="h-4 w-4" />
                        <span className="text-xs">Call</span>
                      </a>
                    </Button>
                  )}
                  {placeDetails.website && (
                    <Button variant="outline" className="flex flex-col h-16 gap-1" asChild>
                      <a href={placeDetails.website} target="_blank" rel="noopener noreferrer">
                        <Globe className="h-4 w-4" />
                        <span className="text-xs">Website</span>
                      </a>
                    </Button>
                  )}
                  <Button variant="outline" className="flex flex-col h-16 gap-1">
                    <Share2 className="h-4 w-4" />
                    <span className="text-xs">Share</span>
                  </Button>
                </div>

                {/* Opening Hours */}
                {placeDetails.opening_hours && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <h3 className="font-medium">Hours</h3>
                        <Badge variant={placeDetails.opening_hours.open_now ? "default" : "secondary"}>
                          {placeDetails.opening_hours.open_now ? "Open" : "Closed"}
                        </Badge>
                      </div>
                      <div className="space-y-1">
                        {placeDetails.opening_hours.weekday_text?.slice(0, 3).map((day, index) => (
                          <div key={index} className="text-sm text-muted-foreground">
                            {day}
                          </div>
                        ))}
                        {placeDetails.opening_hours.weekday_text && placeDetails.opening_hours.weekday_text.length > 3 && (
                          <div className="text-xs text-muted-foreground">
                            +{placeDetails.opening_hours.weekday_text.length - 3} more days
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* Contact Info */}
                {(placeDetails.formatted_phone_number || placeDetails.website) && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <h3 className="font-medium">Contact</h3>
                      {placeDetails.formatted_phone_number && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          <span className="text-sm">{placeDetails.formatted_phone_number}</span>
                        </div>
                      )}
                      {placeDetails.website && (
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4" />
                          <a 
                            href={placeDetails.website} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline flex items-center gap-1"
                          >
                            Website
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Reviews with Photo Grids */}
                {placeDetails.reviews && placeDetails.reviews.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <h3 className="font-medium">Reviews</h3>
                      {placeDetails.reviews.slice(0, 2).map((review, index) => {
                        const reviewerPhotos = getPhotosForReviewer(review.author_name, contributorPhotosMap);
                        
                        return (
                          <Card key={index}>
                            <CardContent className="p-3">
                              <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                                  {review.profile_photo_url ? (
                                    <img 
                                      src={review.profile_photo_url} 
                                      alt={review.author_name}
                                      className="w-full h-full rounded-full object-cover"
                                    />
                                  ) : (
                                    <User className="h-4 w-4" />
                                  )}
                                </div>
                                <div className="flex-1 space-y-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm">{review.author_name}</span>
                                    <span className="text-xs text-muted-foreground">{review.relative_time_description}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    {Array.from({ length: 5 }, (_, i) => (
                                      <Star 
                                        key={i} 
                                        className={cn(
                                          "h-3 w-3",
                                          i < (review.rating || 0)
                                            ? "fill-yellow-400 text-yellow-400" 
                                            : "text-muted-foreground"
                                        )} 
                                      />
                                    ))}
                                  </div>
                                  <p className="text-sm text-muted-foreground line-clamp-3">
                                    {review.text}
                                  </p>
                                  
                                  {/* Reviewer's photos */}
                                  {reviewerPhotos.length > 0 && (
                                    <ReviewPhotoGrid
                                      photos={reviewerPhotos}
                                      reviewerName={review.author_name}
                                      placeName={placeDetails.name}
                                      maxThumbnails={4}
                                    />
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                      {placeDetails.reviews.length > 2 && (
                        <p className="text-xs text-muted-foreground text-center">
                          +{placeDetails.reviews.length - 2} more reviews
                        </p>
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
