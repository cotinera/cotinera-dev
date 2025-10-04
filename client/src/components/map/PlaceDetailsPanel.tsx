import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  MapPin,
  Star,
  Clock,
  Phone,
  Globe,
  Navigation,
  Bookmark,
  BookmarkCheck,
  Share2,
  DollarSign,
  X,
  ChevronDown,
  ChevronUp,
  Calendar,
  Palette
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { placesDetailsService, PlaceDetailsData } from '@/lib/places/details-service';
import { PhotoCarousel } from '@/components/map/PhotoCarousel';
import { IconPicker } from '@/components/icon-picker';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface PlaceDetailsPanelProps {
  placeId: string | null;
  tripId?: string | number;
  pinnedPlaceId?: number | null;
  isPinned?: boolean;
  markerIcon?: string;
  onSelectPlace?: (address: string, coordinates: { lat: number; lng: number }, name: string, placeId?: string) => void;
  onClose?: () => void;
  onSave?: (placeData: PlaceDetailsData) => Promise<void>;
  onUnsave?: (pinnedPlaceId: number) => Promise<void>;
  onAddToItinerary?: (placeData: PlaceDetailsData) => void;
  onIconChange?: (pinnedPlaceId: number, icon: string) => Promise<void>;
}

const formatPriceLevel = (priceLevel: number) => {
  return '$'.repeat(priceLevel);
};

const getPlaceCategory = (types: string[]) => {
  const priorityTypes = {
    restaurant: 'Restaurant',
    food: 'Food',
    cafe: 'Cafe',
    bar: 'Bar',
    lodging: 'Hotel',
    tourist_attraction: 'Attraction',
    shopping_mall: 'Shopping',
    store: 'Store',
    museum: 'Museum',
    park: 'Park',
    hospital: 'Hospital',
    bank: 'Bank',
    gas_station: 'Gas Station'
  };
  
  for (const [type, label] of Object.entries(priorityTypes)) {
    if (types.includes(type)) {
      return label;
    }
  }
  
  return types[0]?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Place';
};

export function PlaceDetailsPanel({ 
  placeId, 
  tripId,
  pinnedPlaceId,
  isPinned = false,
  markerIcon = '📍',
  onSelectPlace, 
  onClose,
  onSave,
  onUnsave,
  onAddToItinerary,
  onIconChange
}: PlaceDetailsPanelProps) {
  const [placeDetails, setPlaceDetails] = useState<PlaceDetailsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null);
  const [showHours, setShowHours] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState(markerIcon);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    setSelectedIcon(markerIcon);
  }, [markerIcon]);

  // Fetch place details
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
        
        if (result && placesDetailsService.isRequestCurrent(result.requestId)) {
          setPlaceDetails(result.data);
          setCurrentRequestId(result.requestId);
        }
      } catch (err) {
        console.error('Error fetching place details:', err);
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

  const handleSaveUnsave = async () => {
    if (!placeDetails) return;

    if (isPinned && pinnedPlaceId && onUnsave) {
      try {
        await onUnsave(pinnedPlaceId);
        toast({
          title: 'Place removed',
          description: `${placeDetails.name} removed from trip`
        });
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to remove place',
          variant: 'destructive'
        });
      }
    } else if (!isPinned && onSave) {
      try {
        await onSave(placeDetails);
        toast({
          title: 'Place saved',
          description: `${placeDetails.name} added to trip`
        });
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to save place',
          variant: 'destructive'
        });
      }
    }
  };

  const handleIconChange = async (newIcon: string) => {
    if (pinnedPlaceId && onIconChange) {
      try {
        await onIconChange(pinnedPlaceId, newIcon);
        setSelectedIcon(newIcon);
        toast({
          title: 'Icon updated',
          description: 'Marker icon changed successfully'
        });
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to update icon',
          variant: 'destructive'
        });
      }
    }
  };

  const handleShare = () => {
    if (placeDetails && navigator.share) {
      navigator.share({
        title: placeDetails.name,
        text: placeDetails.formatted_address,
        url: placeDetails.url || window.location.href
      }).catch(() => {
        // Fallback: copy to clipboard
        navigator.clipboard.writeText(placeDetails.url || window.location.href);
        toast({ title: 'Link copied to clipboard' });
      });
    } else if (placeDetails) {
      navigator.clipboard.writeText(placeDetails.url || window.location.href);
      toast({ title: 'Link copied to clipboard' });
    }
  };

  if (!placeId) return null;

  return (
    <div className="w-full h-full flex flex-col bg-background">
      {/* Header with close button */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b">
        <h2 className="text-lg font-semibold">Place Details</h2>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col">
          {loading && !placeDetails && (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          )}

          {error && (
            <div className="p-4 text-center">
              <p className="text-destructive text-sm">{error}</p>
            </div>
          )}

          {placeDetails && (
            <>
              {/* Photo Carousel - Full width at top */}
              {placeDetails.photos && placeDetails.photos.length > 0 && (
                <div className="w-full">
                  <PhotoCarousel 
                    photos={placeDetails.photos} 
                    placeName={placeDetails.name}
                    maxPhotos={10}
                    showControls={placeDetails.photos.length >= 2}
                  />
                </div>
              )}

              {/* Content with padding */}
              <div className="p-4 space-y-4">
                {/* Header Row: Name, Category, Bookmark */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h1 className="text-2xl font-bold leading-tight">{placeDetails.name}</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                      {getPlaceCategory(placeDetails.types)}
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={handleSaveUnsave}
                    className="flex-shrink-0"
                  >
                    {isPinned ? (
                      <BookmarkCheck className="h-5 w-5 fill-current" />
                    ) : (
                      <Bookmark className="h-5 w-5" />
                    )}
                  </Button>
                </div>

                {/* Meta Row: Rating, Reviews, Price */}
                {(placeDetails.rating || placeDetails.price_level) && (
                  <div className="flex items-center gap-3 flex-wrap">
                    {placeDetails.rating && (
                      <>
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          <span className="font-semibold">{placeDetails.rating.toFixed(1)}</span>
                        </div>
                        {placeDetails.user_ratings_total && (
                          <span className="text-sm text-muted-foreground">
                            ({placeDetails.user_ratings_total.toLocaleString()})
                          </span>
                        )}
                      </>
                    )}
                    {placeDetails.price_level && (
                      <div className="flex items-center gap-1">
                        <span className="text-green-600 font-semibold text-sm">
                          {formatPriceLevel(placeDetails.price_level)}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Address with Icon */}
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm">{placeDetails.formatted_address}</span>
                </div>

                {/* Open/Closed + Hours */}
                {placeDetails.opening_hours && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <Badge 
                          variant={placeDetails.opening_hours.isOpen?.() ? "default" : "secondary"}
                          className={placeDetails.opening_hours.isOpen?.() ? "bg-green-500" : ""}
                        >
                          {placeDetails.opening_hours.isOpen?.() ? 'Open' : 'Closed'}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowHours(!showHours)}
                      >
                        {showHours ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    {showHours && placeDetails.opening_hours.weekday_text && (
                      <div className="pl-6 space-y-1">
                        {placeDetails.opening_hours.weekday_text.map((text, index) => (
                          <p key={index} className="text-sm text-muted-foreground">
                            {text}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Action Grid - 2x2 */}
                <div className="grid grid-cols-2 gap-3">
                  <Button 
                    className="h-20 flex flex-col gap-2"
                    onClick={handleSelectPlace}
                  >
                    <Navigation className="h-5 w-5" />
                    <span className="text-sm font-medium">Select</span>
                  </Button>
                  
                  {placeDetails.formatted_phone_number ? (
                    <Button 
                      variant="outline" 
                      className="h-20 flex flex-col gap-2" 
                      asChild
                    >
                      <a href={`tel:${placeDetails.formatted_phone_number}`}>
                        <Phone className="h-5 w-5" />
                        <span className="text-sm font-medium">Call</span>
                      </a>
                    </Button>
                  ) : (
                    <Button 
                      variant="outline" 
                      className="h-20 flex flex-col gap-2"
                      disabled
                    >
                      <Phone className="h-5 w-5" />
                      <span className="text-sm font-medium">Call</span>
                    </Button>
                  )}

                  {placeDetails.website ? (
                    <Button 
                      variant="outline" 
                      className="h-20 flex flex-col gap-2" 
                      asChild
                    >
                      <a href={placeDetails.website} target="_blank" rel="noopener noreferrer">
                        <Globe className="h-5 w-5" />
                        <span className="text-sm font-medium">Website</span>
                      </a>
                    </Button>
                  ) : (
                    <Button 
                      variant="outline" 
                      className="h-20 flex flex-col gap-2"
                      disabled
                    >
                      <Globe className="h-5 w-5" />
                      <span className="text-sm font-medium">Website</span>
                    </Button>
                  )}

                  <Button 
                    variant="outline" 
                    className="h-20 flex flex-col gap-2"
                    onClick={handleShare}
                  >
                    <Share2 className="h-5 w-5" />
                    <span className="text-sm font-medium">Share</span>
                  </Button>
                </div>

                {/* Additional actions for pinned places */}
                {isPinned && (
                  <>
                    <Separator />
                    
                    {/* Add to Itinerary */}
                    {onAddToItinerary && (
                      <Button 
                        className="w-full h-12"
                        variant="secondary"
                        onClick={() => onAddToItinerary(placeDetails)}
                      >
                        <Calendar className="h-4 w-4 mr-2" />
                        Add to Itinerary
                      </Button>
                    )}

                    {/* Marker Icon Picker */}
                    {pinnedPlaceId && onIconChange && (
                      <div className="flex items-center gap-3">
                        <Palette className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Marker Icon:</span>
                        <IconPicker
                          selectedIcon={selectedIcon}
                          onIconSelect={handleIconChange}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
