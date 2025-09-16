// Re-export types and interfaces from the centralized API wrapper
export type {
  PlaceSearchResult,
  SearchResult,
} from './api-wrapper';

export {
  PlacesApiError,
  PlacesApiErrorType,
  getPlacesApiWrapper,
  createPlacesApiWrapper,
} from './api-wrapper';

import { CATEGORY_TYPES, CategoryId } from '@/components/map/CategoryPills';
import type { 
  PlaceSearchResult, 
  SearchResult, 
  SearchOptions as ApiSearchOptions
} from './api-wrapper';

import {
  getPlacesApiWrapper 
} from './api-wrapper';

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

/**
 * Legacy PlacesSearchService wrapper for backward compatibility
 * Uses the new centralized API wrapper under the hood
 */
export class PlacesSearchService {
  private apiWrapper: ReturnType<typeof getPlacesApiWrapper>;
  private map: google.maps.Map;

  constructor(map: google.maps.Map) {
    this.map = map;
    this.apiWrapper = getPlacesApiWrapper(map);
  }

  /**
   * Perform a debounced search using the centralized API wrapper
   */
  async searchDebounced(options: SearchOptions): Promise<SearchResult> {
    try {
      const apiOptions: ApiSearchOptions = {
        bounds: options.bounds || undefined,
        category: options.category,
        openNow: options.openNow,
        keyword: options.keyword,
        withinMap: options.withinMap,
        maxResults: 20,
      };

      return await this.apiWrapper.searchNearby(apiOptions);
    } catch (error) {
      console.error('Search error:', error);
      throw error;
    }
  }

  /**
   * Perform an immediate search using the centralized API wrapper
   */
  async searchImmediate(options: SearchOptions): Promise<SearchResult> {
    return this.searchDebounced(options);
  }

  /**
   * Get next page of results (not supported by new API)
   */
  async getNextPage(): Promise<SearchResult> {
    return { 
      results: [], 
      hasNextPage: false,
      requestId: 'legacy_next_page',
      executionTime: 0,
    };
  }

  /**
   * Cancel current search
   */
  cancelCurrentSearch() {
    this.apiWrapper.cancelSearch();
  }

  /**
   * Cleanup method
   */
  destroy() {
    this.apiWrapper.cancelAll();
  }
}

/**
 * Factory function to create the legacy search service
 * @deprecated Use getPlacesApiWrapper() directly for new code
 */
export function createPlacesSearchService(map: google.maps.Map): PlacesSearchService {
  return new PlacesSearchService(map);
}

/**
 * Direct access to the modern API wrapper (recommended)
 */
export function getPlacesSearchWrapper(map?: google.maps.Map) {
  return getPlacesApiWrapper(map);
}