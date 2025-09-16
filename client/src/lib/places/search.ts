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
  private map: google.maps.Map | null = null;
  private currentController: AbortController | null = null;
  private nextPageToken: string | null = null;
  
  constructor(map: google.maps.Map) {
    this.map = map;
  }

  // Cancel any ongoing search
  private cancelCurrentSearch() {
    if (this.currentController) {
      this.currentController.abort();
      this.currentController = null;
    }
  }

  // Convert new Places API result to our format
  private convertPlaceResult(place: google.maps.places.Place): PlaceSearchResult {
    return {
      place_id: place.id || '',
      name: place.displayName || '',
      formatted_address: place.formattedAddress || '',
      geometry: {
        location: {
          lat: place.location?.lat() || 0,
          lng: place.location?.lng() || 0,
        },
      },
      rating: place.rating,
      user_ratings_total: place.userRatingCount,
      price_level: place.priceLevel,
      opening_hours: place.regularOpeningHours ? {
        open_now: place.regularOpeningHours.openNow || false
      } : undefined,
      types: place.types || [],
      photos: place.photos || [],
      vicinity: place.shortFormattedAddress || '',
      business_status: place.businessStatus || '',
    };
  }

  // Perform searchNearby with new API and proper error handling
  private async performNearbySearch(options: SearchOptions): Promise<SearchResult> {
    if (!this.map) {
      throw new Error('Map not initialized');
    }

    // Cancel any ongoing search
    this.cancelCurrentSearch();
    
    // Create new abort controller for this search
    this.currentController = new AbortController();
    const { signal } = this.currentController;

    try {
      // Prepare the search request using new API format
      const request: google.maps.places.SearchNearbyRequest = {
        // Required parameters
        fields: [
          'id', 'displayName', 'formattedAddress', 'location', 
          'rating', 'userRatingCount', 'priceLevel', 'regularOpeningHours',
          'types', 'photos', 'shortFormattedAddress', 'businessStatus'
        ],
        // Location restriction
        locationRestriction: this.buildLocationRestriction(options),
        // Optional parameters
        maxResultCount: 20,
        rankPreference: google.maps.places.SearchNearbyRankPreference.POPULARITY,
        language: 'en-US',
        region: 'us',
      };

      // Add category filter if specified
      if (options.category) {
        request.includedPrimaryTypes = [CATEGORY_TYPES[options.category].type];
      }

      // Check if request was cancelled before making API call
      if (signal.aborted) {
        throw new Error('Search cancelled');
      }

      // Call the new searchNearby API
      const { places } = await google.maps.places.Place.searchNearby(request);
      
      // Check again if cancelled after API call
      if (signal.aborted) {
        throw new Error('Search cancelled');
      }

      // Filter results based on options
      let filteredPlaces = places || [];
      
      if (options.openNow) {
        filteredPlaces = filteredPlaces.filter(place => 
          place.regularOpeningHours?.openNow === true
        );
      }

      if (options.keyword) {
        const keyword = options.keyword.toLowerCase();
        filteredPlaces = filteredPlaces.filter(place => 
          place.displayName?.toLowerCase().includes(keyword) ||
          place.formattedAddress?.toLowerCase().includes(keyword)
        );
      }

      const convertedResults = filteredPlaces.map(this.convertPlaceResult);
      
      return {
        results: convertedResults,
        hasNextPage: false, // New API doesn't support pagination in the same way
        nextPageToken: undefined,
      };
    } catch (error) {
      // Check if error was due to cancellation
      if (signal.aborted) {
        throw new Error('Search cancelled');
      }
      
      // Handle specific API errors
      if (error instanceof Error) {
        if (error.message.includes('ZERO_RESULTS')) {
          return { results: [], hasNextPage: false };
        }
        if (error.message.includes('OVER_QUERY_LIMIT')) {
          throw new Error('Search quota exceeded. Please try again later.');
        }
        if (error.message.includes('INVALID_REQUEST')) {
          throw new Error('Invalid search parameters. Please try different criteria.');
        }
      }
      
      throw new Error(`Places search failed: ${error}`);
    }
  }

  // Build location restriction based on options
  private buildLocationRestriction(options: SearchOptions): google.maps.places.SearchNearbyRequest['locationRestriction'] {
    if (options.withinMap && options.bounds) {
      // Use bounds if searching within map
      const ne = options.bounds.getNorthEast();
      const sw = options.bounds.getSouthWest();
      
      return {
        rectangle: {
          low: { latitude: sw.lat(), longitude: sw.lng() },
          high: { latitude: ne.lat(), longitude: ne.lng() }
        }
      };
    } else {
      // Use circle with center and radius if not restricted to map bounds
      const center = options.map.getCenter();
      if (center) {
        return {
          circle: {
            center: { 
              latitude: center.lat(), 
              longitude: center.lng() 
            },
            radius: 5000 // 5km radius
          }
        };
      }
    }
    
    throw new Error('Unable to determine search location');
  }

  // Get next page of results (simplified for new API)
  async getNextPage(): Promise<SearchResult> {
    // New API doesn't support traditional pagination
    // Could implement offset-based pagination if needed
    return { results: [], hasNextPage: false };
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
    this.map = null;
    this.nextPageToken = null;
  }
}

// Export a factory function to create the service
export function createPlacesSearchService(map: google.maps.Map): PlacesSearchService {
  return new PlacesSearchService(map);
}