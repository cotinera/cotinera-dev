import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { 
  MapPin, 
  Star, 
  Clock, 
  Phone, 
  Globe, 
  Navigation, 
  Bookmark, 
  Share2, 
  ChevronRight,
  Camera,
  DollarSign,
  Calendar,
  ExternalLink,
  User
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PlacePhoto {
  photo_reference: string;
  height: number;
  width: number;
  html_attributions: string[];
}

interface PlaceReview {
  author_name: string;
  author_url?: string;
  language: string;
  profile_photo_url?: string;
  rating: number;
  relative_time_description: string;
  text: string;
  time: number;
}

interface PlaceOpeningHours {
  open_now: boolean;
  periods: Array<{
    close?: { day: number; time: string };
    open: { day: number; time: string };
  }>;
  weekday_text: string[];
}

interface PlaceDetailsData {
  place_id: string;
  name: string;
  formatted_address: string;
  formatted_phone_number?: string;
  international_phone_number?: string;
  website?: string;
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  opening_hours?: PlaceOpeningHours;
  photos?: PlacePhoto[];
  reviews?: PlaceReview[];
  types: string[];
  geometry: {
    location: {
      lat: () => number;
      lng: () => number;
    };
  };
  business_status?: string;
  url?: string;
}

interface PlaceDetailsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placeId: string | null;
  onSelectPlace?: (address: string, coordinates: { lat: number; lng: number }, name: string) => void;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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

export function PlaceDetailsSheet({ open, onOpenChange, placeId, onSelectPlace }: PlaceDetailsSheetProps) {
  const [placeDetails, setPlaceDetails] = useState<PlaceDetailsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

  useEffect(() => {
    if (!placeId || !open) {
      setPlaceDetails(null);
      return;
    }

    const fetchPlaceDetails = async () => {
      setLoading(true);
      setError(null);

      try {
        // Initialize Google Places service
        const mapDiv = document.createElement('div');
        const placesService = new google.maps.places.PlacesService(mapDiv);

        const placeData = await new Promise<PlaceDetailsData>((resolve, reject) => {
          placesService.getDetails(
            {
              placeId: placeId,
              fields: [
                'place_id',
                'name',
                'formatted_address',
                'formatted_phone_number',
                'international_phone_number',
                'website',
                'rating',
                'user_ratings_total',
                'price_level',
                'opening_hours',
                'photos',
                'reviews',
                'types',
                'geometry',
                'business_status',
                'url'
              ],
            },
            (result, status) => {
              if (status === google.maps.places.PlacesServiceStatus.OK && result) {
                resolve(result as PlaceDetailsData);
              } else {
                reject(new Error(`Failed to fetch place details: ${status}`));
              }
            }
          );
        });

        setPlaceDetails(placeData);
      } catch (err) {
        console.error('Error fetching place details:', err);
        setError(err instanceof Error ? err.message : 'Failed to load place details');
      } finally {
        setLoading(false);
      }
    };

    fetchPlaceDetails();
  }, [placeId, open]);

  const handleSelectPlace = () => {
    if (placeDetails && onSelectPlace) {
      const coordinates = {
        lat: placeDetails.geometry.location.lat(),
        lng: placeDetails.geometry.location.lng()
      };
      onSelectPlace(placeDetails.formatted_address, coordinates, placeDetails.name);
      onOpenChange(false);
    }
  };

  const getPhotoUrl = (photo: PlacePhoto, maxWidth: number = 400) => {
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${photo.photo_reference}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`;
  };

  if (!open) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[80vh] p-0">
        <div className="flex flex-col h-full">
          {/* Header with photos */}
          {placeDetails?.photos && placeDetails.photos.length > 0 && (
            <div className="relative h-48 overflow-hidden">
              <img
                src={getPhotoUrl(placeDetails.photos[selectedPhotoIndex], 800)}
                alt={placeDetails.name}
                className="w-full h-full object-cover"
              />
              {placeDetails.photos.length > 1 && (
                <div className="absolute bottom-2 right-2 bg-black/60 text-white px-2 py-1 rounded-md text-xs flex items-center gap-1">
                  <Camera className="h-3 w-3" />
                  {selectedPhotoIndex + 1} / {placeDetails.photos.length}
                </div>
              )}
              {placeDetails.photos.length > 1 && (
                <div className="absolute bottom-2 left-2 flex gap-1">
                  {placeDetails.photos.slice(0, 5).map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedPhotoIndex(index)}
                      className={cn(
                        "w-2 h-2 rounded-full transition-colors",
                        index === selectedPhotoIndex ? "bg-white" : "bg-white/50"
                      )}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {loading && (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              )}

              {error && (
                <div className="text-center py-8">
                  <p className="text-destructive">{error}</p>
                </div>
              )}

              {placeDetails && (
                <>
                  {/* Place Header */}
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h1 className="text-2xl font-bold">{placeDetails.name}</h1>
                        <p className="text-muted-foreground">{getPlaceCategory(placeDetails.types)}</p>
                      </div>
                      <Button variant="outline" size="icon">
                        <Bookmark className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Rating and Reviews */}
                    {placeDetails.rating && (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          <span className="font-medium">{placeDetails.rating.toFixed(1)}</span>
                        </div>
                        {placeDetails.user_ratings_total && (
                          <span className="text-muted-foreground">({placeDetails.user_ratings_total} reviews)</span>
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
                  <div className="grid grid-cols-4 gap-2">
                    <Button variant="outline" className="flex flex-col h-16 gap-1" onClick={handleSelectPlace}>
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
                          {placeDetails.opening_hours.weekday_text.map((day, index) => (
                            <div key={index} className="text-sm text-muted-foreground">
                              {day}
                            </div>
                          ))}
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

                  {/* Reviews */}
                  {placeDetails.reviews && placeDetails.reviews.length > 0 && (
                    <>
                      <Separator />
                      <div className="space-y-3">
                        <h3 className="font-medium">Reviews</h3>
                        {placeDetails.reviews.slice(0, 3).map((review, index) => (
                          <Card key={index}>
                            <CardContent className="p-4">
                              <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
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
                                <div className="flex-1 space-y-1">
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
                                          i < review.rating 
                                            ? "fill-yellow-400 text-yellow-400" 
                                            : "text-muted-foreground"
                                        )} 
                                      />
                                    ))}
                                  </div>
                                  <p className="text-sm text-muted-foreground line-clamp-3">
                                    {review.text}
                                  </p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                        {placeDetails.reviews.length > 3 && (
                          <Button variant="outline" className="w-full">
                            View all {placeDetails.reviews.length} reviews
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}