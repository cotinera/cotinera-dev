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

export interface PlaceDetailsData {
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

interface CachedPlaceDetails {
  data: PlaceDetailsData;
  timestamp: number;
  requestId: string;
}

export class PlacesDetailsService {
  private cache: Map<string, CachedPlaceDetails> = new Map();
  private readonly CACHE_DURATION_MS = 12 * 60 * 1000; // 12 minutes (between 10-15 min)
  private currentRequestId: string | null = null;
  private placesService: google.maps.places.PlacesService | null = null;

  constructor() {
    if (typeof google !== 'undefined' && google.maps?.places?.PlacesService) {
      const mapDiv = document.createElement('div');
      this.placesService = new google.maps.places.PlacesService(mapDiv);
    }
  }

  private ensurePlacesService(): google.maps.places.PlacesService {
    if (!this.placesService) {
      const mapDiv = document.createElement('div');
      this.placesService = new google.maps.places.PlacesService(mapDiv);
    }
    return this.placesService;
  }

  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private isCacheValid(cachedItem: CachedPlaceDetails): boolean {
    return Date.now() - cachedItem.timestamp < this.CACHE_DURATION_MS;
  }

  async fetchPlaceDetails(
    placeId: string,
    forceRefresh: boolean = false
  ): Promise<{ data: PlaceDetailsData; requestId: string } | null> {
    const requestId = this.generateRequestId();
    this.currentRequestId = requestId;

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = this.cache.get(placeId);
      if (cached && this.isCacheValid(cached)) {
        return { data: cached.data, requestId: cached.requestId };
      }
    }

    try {
      const placesService = this.ensurePlacesService();

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
            // Check if this request is still current
            if (this.currentRequestId !== requestId) {
              reject(new Error('Request superseded by newer request'));
              return;
            }

            if (status === google.maps.places.PlacesServiceStatus.OK && result) {
              resolve(result as PlaceDetailsData);
            } else {
              reject(new Error(`Failed to fetch place details: ${status}`));
            }
          }
        );
      });

      // Only cache and return if this is still the current request
      if (this.currentRequestId === requestId) {
        this.cache.set(placeId, {
          data: placeData,
          timestamp: Date.now(),
          requestId
        });

        return { data: placeData, requestId };
      }

      return null;
    } catch (err) {
      if (this.currentRequestId !== requestId) {
        return null;
      }
      throw err;
    }
  }

  isRequestCurrent(requestId: string): boolean {
    return this.currentRequestId === requestId;
  }

  clearCache(placeId?: string): void {
    if (placeId) {
      this.cache.delete(placeId);
    } else {
      this.cache.clear();
    }
  }

  getCacheInfo(placeId: string): { isCached: boolean; age?: number } {
    const cached = this.cache.get(placeId);
    if (!cached) {
      return { isCached: false };
    }
    return {
      isCached: true,
      age: Date.now() - cached.timestamp
    };
  }
}

export const placesDetailsService = new PlacesDetailsService();
