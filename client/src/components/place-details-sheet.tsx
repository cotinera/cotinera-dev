import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
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
  User,
  Copy,
  Plus,
  AlertCircle,
  CheckCircle,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  X
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

interface PlaceCurrentOpeningHours {
  open_now: boolean;
  periods: Array<{
    close?: { day: number; time: string };
    open: { day: number; time: string };
  }>;
  weekday_text: string[];
  special_days?: Array<{
    date: string;
    exceptional_hours: boolean;
  }>;
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
  current_opening_hours?: PlaceCurrentOpeningHours;
  utc_offset_minutes?: number;
  editorial_summary?: {
    language?: string;
    overview?: string;
  };
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

// Session-based cache for place details
const placeCache = new Map<string, { data: PlaceDetailsData; timestamp: number; heavyFieldsLoaded: boolean }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Snap points for drawer
type SnapPoint = 'peek' | 'half' | 'full';

interface SnapConfig {
  peek: string;
  half: string;
  full: string;
}

interface PlaceDetailsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placeId: string | null;
  onSelectPlace?: (address: string, coordinates: { lat: number; lng: number }, name: string) => void;
  tripId?: string | number;
  initialSnap?: SnapPoint;
  onSaveToTrip?: (place: PlaceDetailsData) => Promise<void>;
  className?: string;
}

// Constants and utility functions
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const CACHE_KEY_PREFIX = 'place_details_';

// Snap point configurations
const SNAP_POINTS: SnapConfig = {
  peek: '25%',
  half: '50%',
  full: '90%'
};

// Helper function to format price level
const formatPriceLevel = (priceLevel: number) => {
  return '$'.repeat(priceLevel);
};

// Enhanced place category detection
const getPlaceCategory = (types: string[]) => {
  const priorityTypes = {
    restaurant: 'Restaurant',
    food: 'Food',
    cafe: 'Cafe',
    bar: 'Bar',
    lodging: 'Hotel',
    tourist_attraction: 'Attraction',
    museum: 'Museum',
    shopping_mall: 'Shopping',
    store: 'Store',
    hospital: 'Hospital',
    bank: 'Bank',
    gas_station: 'Gas Station',
    park: 'Park',
    gym: 'Gym',
    spa: 'Spa'
  };
  
  for (const [type, label] of Object.entries(priorityTypes)) {
    if (types.includes(type)) {
      return label;
    }
  }
  
  return types[0]?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Place';
};

// Calculate time until close with live countdown and timezone support
const calculateTimeUntilClose = (openingHours?: PlaceCurrentOpeningHours, utcOffsetMinutes?: number) => {
  if (!openingHours || !openingHours.open_now) return null;
  const periods = openingHours.periods || [];
  if (periods.length === 0) return { text: 'Open', isClosingSoon: false };

  const now = new Date();
  const userTz = -now.getTimezoneOffset();
  const placeTz = utcOffsetMinutes ?? userTz;
  const placeLocal = new Date(now.getTime() + (placeTz - userTz) * 60000);

  const day = placeLocal.getDay();
  const minutesToday = placeLocal.getHours() * 60 + placeLocal.getMinutes();
  const WEEK = 7 * 1440;
  const nowWeekMin = day * 1440 + minutesToday; // 0..10079
  const parseHM = (t: string) => Number(t.slice(0,2)) * 60 + Number(t.slice(2,4));

  let minutesUntilClose: number | null = null;

  for (const p of periods) {
    if (!p.open) continue;
    if (!p.close) return { text: 'Open 24 hours', isClosingSoon: false };

    const start = p.open.day * 1440 + parseHM(p.open.time);
    let end = p.close.day * 1440 + parseHM(p.close.time);
    if (end <= start) end += WEEK; // overnight or spans week boundary

    const candidates = [nowWeekMin, nowWeekMin + WEEK, nowWeekMin - WEEK];
    for (const n of candidates) {
      if (n >= start && n < end) {
        const remaining = end - n;
        if (minutesUntilClose == null || remaining < minutesUntilClose) {
          minutesUntilClose = remaining;
        }
        break;
      }
    }
  }

  if (minutesUntilClose == null) return null; // not currently open
  if (minutesUntilClose <= 0) return { text: 'Closing soon', isClosingSoon: true };
  if (minutesUntilClose < 60) return { text: `Closes in ${minutesUntilClose}m`, isClosingSoon: minutesUntilClose <= 30 };
  if (minutesUntilClose < 1440) {
    const h = Math.floor(minutesUntilClose / 60);
    const m = minutesUntilClose % 60;
    return { text: m ? `Closes in ${h}h ${m}m` : `Closes in ${h}h`, isClosingSoon: minutesUntilClose <= 120 };
  }
  return { text: 'Open', isClosingSoon: false };
};

// Enhanced photo URL generation with higher quality
const getPhotoUrl = (photo: PlacePhoto, maxWidth: number = 1200) => {
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${photo.photo_reference}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`;
};

// Cache management functions
const getCachedPlace = (placeId: string) => {
  const cached = placeCache.get(placeId);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached;
  }
  if (cached) {
    placeCache.delete(placeId); // Remove expired cache
  }
  return null;
};

const setCachedPlace = (placeId: string, data: PlaceDetailsData, heavyFieldsLoaded: boolean = false) => {
  placeCache.set(placeId, {
    data,
    timestamp: Date.now(),
    heavyFieldsLoaded
  });
};

// Copy to clipboard utility
const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    // Fallback for older browsers
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const result = document.execCommand('copy');
      document.body.removeChild(textArea);
      return result;
    } catch (fallbackErr) {
      console.error('Failed to copy text:', fallbackErr);
      return false;
    }
  }
};

export function PlaceDetailsSheet({ 
  open, 
  onOpenChange, 
  placeId, 
  onSelectPlace,
  tripId,
  initialSnap = 'half',
  onSaveToTrip,
  className 
}: PlaceDetailsSheetProps) {
  const [placeDetails, setPlaceDetails] = useState<PlaceDetailsData | null>(null);
  const [heavyFieldsLoaded, setHeavyFieldsLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [currentSnap, setCurrentSnap] = useState<SnapPoint>(initialSnap);
  const [timeUntilClose, setTimeUntilClose] = useState<{ text: string; isClosingSoon: boolean } | null>(null);
  const [savingToTrip, setSavingToTrip] = useState(false);
  const [imageLoadErrors, setImageLoadErrors] = useState<Set<number>>(new Set());
  
  const { toast } = useToast();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Enhanced effect for fetching place details with caching
  useEffect(() => {
    if (!placeId || !open) {
      setPlaceDetails(null);
      setHeavyFieldsLoaded(false);
      setTimeUntilClose(null);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const fetchPlaceDetails = async () => {
      setError(null);
      
      // Check cache first
      const cached = getCachedPlace(placeId);
      if (cached) {
        setPlaceDetails(cached.data);
        setHeavyFieldsLoaded(cached.heavyFieldsLoaded);
        setLoading(false);
        
        // If heavy fields aren't loaded, fetch them
        if (!cached.heavyFieldsLoaded) {
          fetchHeavyFields(placeId, cached.data);
        }
        return;
      }

      setLoading(true);
      setHeavyFieldsLoaded(false);

      try {
        // Initialize Google Places service
        const mapDiv = document.createElement('div');
        const placesService = new google.maps.places.PlacesService(mapDiv);

        // STAGE 1: Load minimal fields for immediate display
        const minimalData = await new Promise<PlaceDetailsData>((resolve, reject) => {
          placesService.getDetails(
            {
              placeId: placeId,
              fields: [
                'place_id',
                'name',
                'formatted_address',
                'types',
                'geometry',
                'rating',
                'user_ratings_total',
                'business_status'
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

        // Cache and set minimal data immediately
        setCachedPlace(placeId, minimalData, false);
        setPlaceDetails(minimalData);
        setLoading(false);
        
        // STAGE 2: Load heavy fields in the background
        setTimeout(() => {
          fetchHeavyFields(placeId, minimalData);
        }, 50);
        
      } catch (err) {
        console.error('Error fetching place details:', err);
        setError(err instanceof Error ? err.message : 'Failed to load place details');
        setLoading(false);
      }
    };

    const fetchHeavyFields = async (placeId: string, baseData: PlaceDetailsData) => {
      try {
        const mapDiv = document.createElement('div');
        const placesService = new google.maps.places.PlacesService(mapDiv);
        
        const fullData = await new Promise<PlaceDetailsData>((resolve, reject) => {
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
                'current_opening_hours',
                'utc_offset_minutes',
                'editorial_summary',
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
                reject(new Error(`Failed to fetch full place details: ${status}`));
              }
            }
          );
        });
        
        // Update cache and state with full data
        setCachedPlace(placeId, fullData, true);
        setPlaceDetails(fullData);
        setHeavyFieldsLoaded(true);
        
      } catch (err) {
        console.error('Error fetching full place details:', err);
        // Keep minimal data if heavy fields fail
      }
    };

    fetchPlaceDetails();
  }, [placeId, open]);

  // Effect for live time countdown
  useEffect(() => {
    if (!placeDetails?.current_opening_hours) {
      return;
    }

    const updateTimeUntilClose = () => {
      const timeInfo = calculateTimeUntilClose(
        placeDetails.current_opening_hours,
        placeDetails.utc_offset_minutes
      );
      setTimeUntilClose(timeInfo);
    };

    // Update immediately
    updateTimeUntilClose();

    // Update every minute for live countdown
    intervalRef.current = setInterval(updateTimeUntilClose, 60000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [placeDetails?.current_opening_hours, placeDetails?.utc_offset_minutes]);

  // Keyboard navigation effect
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!open) return;
      
      switch (event.key) {
        case 'Escape':
          event.preventDefault();
          onOpenChange(false);
          break;
        case 'ArrowLeft':
          if (placeDetails?.photos && placeDetails.photos.length > 1) {
            event.preventDefault();
            setSelectedPhotoIndex(prev => 
              prev === 0 ? placeDetails.photos!.length - 1 : prev - 1
            );
          }
          break;
        case 'ArrowRight':
          if (placeDetails?.photos && placeDetails.photos.length > 1) {
            event.preventDefault();
            setSelectedPhotoIndex(prev => 
              prev === placeDetails.photos!.length - 1 ? 0 : prev + 1
            );
          }
          break;
      }
    };

    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, placeDetails?.photos, onOpenChange]);

  // Action handlers
  const handleSelectPlace = useCallback(() => {
    if (placeDetails && onSelectPlace) {
      const coordinates = {
        lat: placeDetails.geometry.location.lat(),
        lng: placeDetails.geometry.location.lng()
      };
      onSelectPlace(placeDetails.formatted_address, coordinates, placeDetails.name);
      onOpenChange(false);
    }
  }, [placeDetails, onSelectPlace, onOpenChange]);

  const handleSaveToTrip = useCallback(async () => {
    if (placeDetails && onSaveToTrip) {
      setSavingToTrip(true);
      try {
        await onSaveToTrip(placeDetails);
        toast({
          title: "Saved to trip",
          description: `${placeDetails.name} has been saved to your trip.`,
        });
        onOpenChange(false);
      } catch (error) {
        toast({
          title: "Failed to save",
          description: "There was an error saving this place to your trip.",
          variant: "destructive",
        });
      } finally {
        setSavingToTrip(false);
      }
    }
  }, [placeDetails, onSaveToTrip, toast, onOpenChange]);

  const handleGetDirections = useCallback(() => {
    if (placeDetails) {
      const coordinates = {
        lat: placeDetails.geometry.location.lat(),
        lng: placeDetails.geometry.location.lng()
      };
      const url = `https://www.google.com/maps/dir/?api=1&destination=${coordinates.lat},${coordinates.lng}&destination_place_id=${placeDetails.place_id}`;
      window.open(url, '_blank');
    }
  }, [placeDetails]);

  const handleCopyAddress = useCallback(async () => {
    if (placeDetails) {
      const success = await copyToClipboard(placeDetails.formatted_address);
      if (success) {
        toast({
          title: "Address copied",
          description: "Address has been copied to your clipboard.",
        });
      } else {
        toast({
          title: "Failed to copy",
          description: "Could not copy address to clipboard.",
          variant: "destructive",
        });
      }
    }
  }, [placeDetails, toast]);

  const handleOpenInGoogleMaps = useCallback(() => {
    if (placeDetails?.url) {
      window.open(placeDetails.url, '_blank');
    } else if (placeDetails) {
      const coordinates = {
        lat: placeDetails.geometry.location.lat(),
        lng: placeDetails.geometry.location.lng()
      };
      const url = `https://www.google.com/maps/place/?q=place_id:${placeDetails.place_id}`;
      window.open(url, '_blank');
    }
  }, [placeDetails]);

  const handlePhotoError = useCallback((index: number) => {
    setImageLoadErrors(prev => new Set(Array.from(prev).concat(index)));
  }, []);

  // Memoized computed values
  const placeCategory = useMemo(() => {
    return placeDetails ? getPlaceCategory(placeDetails.types) : '';
  }, [placeDetails?.types]);

  const topReviews = useMemo(() => {
    return placeDetails?.reviews?.slice(0, 2) || [];
  }, [placeDetails?.reviews]);

  const availablePhotos = useMemo(() => {
    return placeDetails?.photos?.slice(0, 3) || [];
  }, [placeDetails?.photos]);

  if (!open) return null;

  return (
    <Drawer 
      open={open} 
      onOpenChange={onOpenChange}
      snapPoints={[SNAP_POINTS.peek, SNAP_POINTS.half, SNAP_POINTS.full]}
      activeSnapPoint={SNAP_POINTS[currentSnap]}
      setActiveSnapPoint={(snapPoint) => {
        const snapKey = Object.keys(SNAP_POINTS).find(
          key => SNAP_POINTS[key as SnapPoint] === snapPoint
        ) as SnapPoint;
        if (snapKey) setCurrentSnap(snapKey);
      }}
      dismissible
      modal
    >
      <DrawerContent 
        className={cn("h-[95vh] p-0 focus:outline-none", className)}
        aria-label={placeDetails ? `Details for ${placeDetails.name}` : "Place details"}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Drag handle indicator */}
          <div className="flex justify-center py-2 bg-background border-b">
            <div className="w-8 h-1 bg-muted-foreground/30 rounded-full" />
          </div>

          {/* Enhanced Photo Carousel */}
          {heavyFieldsLoaded && availablePhotos.length > 0 ? (
            <div className="relative h-56 sm:h-64 overflow-hidden bg-muted">
              <img
                src={getPhotoUrl(availablePhotos[selectedPhotoIndex], 1200)}
                alt={placeDetails?.name || 'Place photo'}
                className="w-full h-full object-cover transition-opacity duration-300"
                loading="lazy"
                onError={() => handlePhotoError(selectedPhotoIndex)}
              />
              
              {/* Photo navigation */}
              {availablePhotos.length > 1 && (
                <>
                  <button
                    onClick={() => setSelectedPhotoIndex(prev => 
                      prev === 0 ? availablePhotos.length - 1 : prev - 1
                    )}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-white"
                    aria-label="Previous photo"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setSelectedPhotoIndex(prev => 
                      prev === availablePhotos.length - 1 ? 0 : prev + 1
                    )}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-white"
                    aria-label="Next photo"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  
                  {/* Photo indicators */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                    {availablePhotos.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setSelectedPhotoIndex(index)}
                        className={cn(
                          "w-2 h-2 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white",
                          index === selectedPhotoIndex 
                            ? "bg-white scale-110" 
                            : "bg-white/60 hover:bg-white/80"
                        )}
                        aria-label={`View photo ${index + 1}`}
                      />
                    ))}
                  </div>
                  
                  {/* Photo counter */}
                  <div className="absolute top-4 right-4 bg-black/60 text-white px-2 py-1 rounded-md text-xs flex items-center gap-1">
                    <Camera className="h-3 w-3" />
                    {selectedPhotoIndex + 1} / {availablePhotos.length}
                  </div>
                </>
              )}
              
              {/* Close button */}
              <button
                onClick={() => onOpenChange(false)}
                className="absolute top-4 left-4 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-white"
                aria-label="Close place details"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="h-56 sm:h-64 bg-muted animate-pulse flex items-center justify-center relative">
              {loading ? (
                <div className="text-muted-foreground text-sm">Loading photos...</div>
              ) : (
                <div className="text-muted-foreground text-center">
                  <Camera className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <div className="text-sm">No photos available</div>
                </div>
              )}
              {/* Close button for no-photo state */}
              <button
                onClick={() => onOpenChange(false)}
                className="absolute top-4 left-4 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-white"
                aria-label="Close place details"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Enhanced Content Section */}
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-6">
              {loading ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-6 w-20" />
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              ) : error ? (
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  <span>{error}</span>
                </div>
              ) : placeDetails ? (
                <>
                  {/* Header Information */}
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h1 className="text-2xl font-bold text-foreground leading-tight">
                          {placeDetails.name}
                        </h1>
                        <Badge variant="secondary" className="mt-1">
                          {placeCategory}
                        </Badge>
                      </div>
                    </div>

                    {/* Enhanced Rating and Status */}
                    <div className="flex items-center gap-4 flex-wrap">
                      {placeDetails.rating && (
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          <span className="font-medium">{placeDetails.rating}</span>
                          {placeDetails.user_ratings_total && (
                            <span className="text-sm text-muted-foreground">
                              ({placeDetails.user_ratings_total.toLocaleString()})
                            </span>
                          )}
                        </div>
                      )}
                      {placeDetails.price_level && (
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {formatPriceLevel(placeDetails.price_level)}
                          </span>
                        </div>
                      )}
                      {timeUntilClose && (
                        <Badge 
                          variant={timeUntilClose.isClosingSoon ? "destructive" : "default"}
                          className="flex items-center gap-1"
                        >
                          <Clock className="h-3 w-3" />
                          {timeUntilClose.text}
                        </Badge>
                      )}
                    </div>

                    {/* Editorial Summary */}
                    {heavyFieldsLoaded && placeDetails.editorial_summary?.overview && (
                      <div className="bg-muted/50 rounded-lg p-4">
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {placeDetails.editorial_summary.overview}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Enhanced Action Buttons */}
                  <div className="grid grid-cols-2 gap-3">
                    {onSaveToTrip && tripId && (
                      <Button 
                        onClick={handleSaveToTrip} 
                        disabled={savingToTrip}
                        className="flex items-center gap-2"
                      >
                        {savingToTrip ? (
                          <>
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4" />
                            Save to Trip
                          </>
                        )}
                      </Button>
                    )}
                    {onSelectPlace && (
                      <Button 
                        onClick={handleSelectPlace}
                        variant="outline"
                        className="flex items-center gap-2"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Select
                      </Button>
                    )}
                    <Button 
                      onClick={handleGetDirections}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <Navigation className="h-4 w-4" />
                      Directions
                    </Button>
                    <Button 
                      onClick={handleCopyAddress}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <Copy className="h-4 w-4" />
                      Copy Address
                    </Button>
                  </div>

                  {/* Contact Information */}
                  {heavyFieldsLoaded && (
                    <div className="space-y-3">
                      <h3 className="font-semibold text-lg">Contact & Location</h3>
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <MapPin className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm leading-relaxed">{placeDetails.formatted_address}</p>
                          </div>
                        </div>
                        
                        {placeDetails.formatted_phone_number && (
                          <div className="flex items-center gap-3">
                            <Phone className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                            <a 
                              href={`tel:${placeDetails.formatted_phone_number}`}
                              className="text-sm text-primary hover:underline"
                            >
                              {placeDetails.formatted_phone_number}
                            </a>
                          </div>
                        )}
                        
                        {placeDetails.website && (
                          <div className="flex items-center gap-3">
                            <Globe className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                            <a 
                              href={placeDetails.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-primary hover:underline truncate"
                            >
                              Visit website
                            </a>
                          </div>
                        )}
                        
                        <Button 
                          onClick={handleOpenInGoogleMaps}
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-2"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Open in Google Maps
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Enhanced Opening Hours */}
                  {heavyFieldsLoaded && (placeDetails.opening_hours || placeDetails.current_opening_hours) && (
                    <div className="space-y-3">
                      <h3 className="font-semibold text-lg flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        Hours
                      </h3>
                      <div className="space-y-2">
                        {(placeDetails.current_opening_hours?.weekday_text || placeDetails.opening_hours?.weekday_text)?.map((day, index) => (
                          <div key={index} className="flex justify-between text-sm">
                            <span>{day.split(': ')[0]}</span>
                            <span className={cn(
                              index === new Date().getDay() ? "font-medium" : "text-muted-foreground"
                            )}>
                              {day.split(': ')[1] || 'Closed'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Enhanced Reviews Section - Limited to top 2 */}
                  {heavyFieldsLoaded && (
                    <div className="space-y-4">
                      <h3 className="font-semibold text-lg">Reviews</h3>
                      {topReviews.length > 0 ? (
                        <>
                          <div className="space-y-4">
                            {topReviews.map((review, index) => (
                              <Card key={index} className="transition-colors hover:bg-muted/50">
                                <CardContent className="p-4">
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
                                    <div className="flex-1 min-w-0 space-y-2">
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
                                      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                                        {review.text}
                                      </p>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                          {placeDetails.reviews && placeDetails.reviews.length > 2 && (
                            <Button variant="outline" className="w-full" onClick={handleOpenInGoogleMaps}>
                              View all {placeDetails.reviews.length} reviews on Google Maps
                              <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                          )}
                        </>
                      ) : (
                        <div className="text-sm text-muted-foreground">No reviews available</div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center text-muted-foreground">
                  No place details available
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </DrawerContent>
    </Drawer>
  );
}