import { CATEGORY_TYPES, CategoryId } from '@/components/map/CategoryPills';

export interface PlaceSearchResult {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  opening_hours?: {
    open_now: boolean;
  };
  types: string[];
  photos?: google.maps.places.PlacePhoto[];
  vicinity?: string;
  business_status?: string;
}

export interface SearchFilters {
  category: CategoryId | null;
  openNow: boolean;
  withinMap: boolean;
  keyword: string;
  bounds?: google.maps.LatLngBounds | null;
}

export interface SearchOptions extends SearchFilters {
  map: google.maps.Map;
}

export interface SearchResult {
  results: PlaceSearchResult[];
  hasNextPage: boolean;
  nextPageToken?: string;
}

// Debounce utility
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export class PlacesSearchService {
  private placesService: google.maps.places.PlacesService | null = null;
  private currentController: AbortController | null = null;
  private nextPageToken: string | null = null;
  
  constructor(map: google.maps.Map) {
    if (map) {
      this.placesService = new google.maps.places.PlacesService(map);
    }
  }

  // Cancel any ongoing search
  private cancelCurrentSearch() {
    if (this.currentController) {
      this.currentController.abort();
      this.currentController = null;
    }
  }

  // Convert Google Places result to our format
  private convertPlaceResult(place: google.maps.places.PlaceResult): PlaceSearchResult {
    return {
      place_id: place.place_id || '',
      name: place.name || '',
      formatted_address: place.formatted_address || place.vicinity || '',
      geometry: {
        location: {
          lat: place.geometry?.location?.lat() || 0,
          lng: place.geometry?.location?.lng() || 0,
        },
      },
      rating: place.rating,
      user_ratings_total: place.user_ratings_total,
      price_level: place.price_level,
      opening_hours: place.opening_hours ? {
        open_now: place.opening_hours.open_now || false
      } : undefined,
      types: place.types || [],
      photos: place.photos,
      vicinity: place.vicinity,
      business_status: place.business_status,
    };
  }

  // Perform nearbySearch with proper error handling and cancellation
  private performNearbySearch(options: SearchOptions): Promise<SearchResult> {
    return new Promise((resolve, reject) => {
      if (!this.placesService) {
        reject(new Error('Places service not initialized'));
        return;
      }

      // Cancel any ongoing search
      this.cancelCurrentSearch();
      
      // Create new abort controller for this search
      this.currentController = new AbortController();
      const { signal } = this.currentController;

      const request: google.maps.places.PlaceSearchRequest = {
        bounds: options.bounds || undefined,
        type: options.category ? CATEGORY_TYPES[options.category].type : undefined,
        keyword: options.keyword || undefined,
        openNow: options.openNow || undefined,
      };

      // If not withinMap, use location + radius instead of bounds
      if (!options.withinMap && options.map) {
        const center = options.map.getCenter();
        if (center) {
          request.location = center;
          request.radius = 5000; // 5km radius as fallback
          delete request.bounds;
        }
      }

      this.placesService.nearbySearch(request, (results, status, pagination) => {
        // Check if this request was cancelled
        if (signal.aborted) {
          reject(new Error('Search cancelled'));
          return;
        }

        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          const convertedResults = results.map(this.convertPlaceResult);
          
          resolve({
            results: convertedResults,
            hasNextPage: !!pagination?.hasNextPage,
            nextPageToken: pagination?.hasNextPage ? 'next' : undefined, // Simplified token
          });
          
          // Store pagination for next page requests
          if (pagination?.hasNextPage) {
            this.nextPageToken = 'next';
            // Store the actual pagination object for next page calls
            (this as any)._pagination = pagination;
          }
        } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
          resolve({ results: [], hasNextPage: false });
        } else {
          reject(new Error(`Places search failed: ${status}`));
        }
      });
    });
  }

  // Get next page of results
  async getNextPage(): Promise<SearchResult> {
    return new Promise((resolve, reject) => {
      const pagination = (this as any)._pagination;
      
      if (!pagination || !pagination.hasNextPage) {
        resolve({ results: [], hasNextPage: false });
        return;
      }

      pagination.nextPage((results: google.maps.places.PlaceResult[], status: google.maps.places.PlacesServiceStatus, newPagination: any) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          const convertedResults = results.map(this.convertPlaceResult);
          
          resolve({
            results: convertedResults,
            hasNextPage: !!newPagination?.hasNextPage,
            nextPageToken: newPagination?.hasNextPage ? 'next' : undefined,
          });
          
          // Update stored pagination
          (this as any)._pagination = newPagination;
        } else {
          reject(new Error(`Next page search failed: ${status}`));
        }
      });
    });
  }

  // Debounced search method
  searchDebounced = debounce(async (options: SearchOptions): Promise<SearchResult> => {
    try {
      return await this.performNearbySearch(options);
    } catch (error) {
      console.error('Search error:', error);
      throw error;
    }
  }, 250);

  // Immediate search method (for testing or immediate needs)
  async searchImmediate(options: SearchOptions): Promise<SearchResult> {
    return this.performNearbySearch(options);
  }

  // Cleanup method
  destroy() {
    this.cancelCurrentSearch();
    this.placesService = null;
    this.nextPageToken = null;
    (this as any)._pagination = null;
  }
}

// Export a factory function to create the service
export function createPlacesSearchService(map: google.maps.Map): PlacesSearchService {
  return new PlacesSearchService(map);
}