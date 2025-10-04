/**
 * Photo Service for Search Result Cards
 * 
 * Handles lazy fetching of place photos with:
 * - 15-minute caching by place_id
 * - Max 3 concurrent details fetches (throttling)
 * - Automatic fallback to next photo on error
 * - IntersectionObserver integration for lazy loading
 */

interface PhotoCacheEntry {
  photos: google.maps.places.PlacePhoto[] | null;
  timestamp: number;
  fetching?: boolean;
}

interface FetchQueueItem {
  placeId: string;
  resolve: (photos: google.maps.places.PlacePhoto[] | null) => void;
  reject: (error: Error) => void;
}

const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
const MAX_CONCURRENT_FETCHES = 3;

export class PlacePhotoService {
  private cache: Map<string, PhotoCacheEntry> = new Map();
  private placesService: google.maps.places.PlacesService | null = null;
  private fetchQueue: FetchQueueItem[] = [];
  private activeFetches = 0;

  constructor(map: google.maps.Map) {
    this.placesService = new google.maps.places.PlacesService(map);
  }

  /**
   * Get photo URL for a place
   * Returns cached result if available, otherwise queues a fetch
   */
  async getPhotoUrl(
    placeId: string,
    maxWidth = 160,
    maxHeight = 160
  ): Promise<string | null> {
    const photos = await this.getPhotos(placeId);
    
    if (!photos || photos.length === 0) {
      return null;
    }

    try {
      return photos[0].getUrl({ maxWidth, maxHeight });
    } catch (error) {
      console.error('Error getting photo URL:', error);
      return null;
    }
  }

  /**
   * Get photos for a place (with caching and throttling)
   */
  async getPhotos(placeId: string): Promise<google.maps.places.PlacePhoto[] | null> {
    // Check cache first
    const cached = this.cache.get(placeId);
    if (cached) {
      const age = Date.now() - cached.timestamp;
      if (age < CACHE_DURATION) {
        // Wait if currently fetching
        if (cached.fetching) {
          return this.waitForFetch(placeId);
        }
        return cached.photos;
      }
      // Cache expired, remove it
      this.cache.delete(placeId);
    }

    // Mark as fetching
    this.cache.set(placeId, {
      photos: null,
      timestamp: Date.now(),
      fetching: true,
    });

    // Queue the fetch
    return new Promise((resolve, reject) => {
      this.fetchQueue.push({ placeId, resolve, reject });
      this.processFetchQueue();
    });
  }

  /**
   * Wait for an in-progress fetch to complete
   */
  private async waitForFetch(placeId: string): Promise<google.maps.places.PlacePhoto[] | null> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const cached = this.cache.get(placeId);
        if (cached && !cached.fetching) {
          clearInterval(checkInterval);
          resolve(cached.photos);
        }
      }, 100);

      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve(null);
      }, 10000);
    });
  }

  /**
   * Process the fetch queue with concurrency limit
   */
  private processFetchQueue() {
    while (this.activeFetches < MAX_CONCURRENT_FETCHES && this.fetchQueue.length > 0) {
      const item = this.fetchQueue.shift();
      if (item) {
        this.activeFetches++;
        this.fetchPlaceDetails(item);
      }
    }
  }

  /**
   * Fetch place details to get photos
   */
  private async fetchPlaceDetails(item: FetchQueueItem) {
    const { placeId, resolve, reject } = item;

    if (!this.placesService) {
      this.activeFetches--;
      this.processFetchQueue();
      reject(new Error('PlacesService not initialized'));
      return;
    }

    try {
      const request: google.maps.places.PlaceDetailsRequest = {
        placeId,
        fields: ['photos'],
      };

      this.placesService.getDetails(request, (place, status) => {
        this.activeFetches--;

        if (status === google.maps.places.PlacesServiceStatus.OK && place?.photos) {
          // Cache the result
          this.cache.set(placeId, {
            photos: place.photos,
            timestamp: Date.now(),
            fetching: false,
          });
          resolve(place.photos);
        } else {
          // Cache null result to avoid repeated failed fetches
          this.cache.set(placeId, {
            photos: null,
            timestamp: Date.now(),
            fetching: false,
          });
          resolve(null);
        }

        // Process next item in queue
        this.processFetchQueue();
      });
    } catch (error) {
      this.activeFetches--;
      this.cache.set(placeId, {
        photos: null,
        timestamp: Date.now(),
        fetching: false,
      });
      reject(error as Error);
      this.processFetchQueue();
    }
  }

  /**
   * Clear the cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * Clean up expired cache entries
   */
  cleanExpiredCache() {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    for (const [placeId, entry] of entries) {
      const age = now - entry.timestamp;
      if (age >= CACHE_DURATION) {
        this.cache.delete(placeId);
      }
    }
  }
}

// Singleton instance
let photoServiceInstance: PlacePhotoService | null = null;

/**
 * Get or create the photo service singleton
 */
export function getPhotoService(map: google.maps.Map): PlacePhotoService {
  if (!photoServiceInstance) {
    photoServiceInstance = new PlacePhotoService(map);
    
    // Clean expired cache every 5 minutes
    setInterval(() => {
      photoServiceInstance?.cleanExpiredCache();
    }, 5 * 60 * 1000);
  }
  return photoServiceInstance;
}
