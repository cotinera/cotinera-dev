/**
 * Centralized Google Places API Wrapper
 * Provides typed interface, debouncing, request cancellation, and performance monitoring
 */

import { CategoryId, CATEGORY_TYPES } from '@/components/map/CategoryPills';

// Types and interfaces
export interface SearchOptions {
  bounds?: google.maps.LatLngBounds;
  category?: CategoryId | null;
  openNow?: boolean;
  keyword?: string;
  withinMap?: boolean;
  maxResults?: number;
  query?: string;
  useTextSearch?: boolean;
}

export interface TextSearchOptions {
  query: string;
  bounds?: google.maps.LatLngBounds;
  location?: google.maps.LatLng;
  radius?: number;
  openNow?: boolean;
  maxResults?: number;
  language?: string;
  region?: string;
  nextPageToken?: string;
}

export interface AutocompleteOptions {
  bounds?: google.maps.LatLngBounds;
  types?: string[];
  componentRestrictions?: { country: string };
  sessionToken?: google.maps.places.AutocompleteSessionToken;
}

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

export interface AutocompletePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
  types: string[];
  matched_substrings: Array<{ length: number; offset: number }>;
}

export interface SearchResult {
  results: PlaceSearchResult[];
  hasNextPage: boolean;
  nextPageToken?: string;
  requestId: string;
  executionTime: number;
  query?: string;
  cacheKey?: string;
}

export interface AutocompleteResult {
  predictions: AutocompletePrediction[];
  requestId: string;
  executionTime: number;
}

export interface PlaceDetailsResult {
  place: google.maps.places.PlaceResult;
  requestId: string;
  executionTime: number;
}

export interface PerformanceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  quotaUsage: {
    search: number;
    autocomplete: number;
    details: number;
    textSearch: number;
  };
}

// Cache interfaces
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface SearchCache {
  results: Map<string, CacheEntry<SearchResult>>;
  details: Map<string, CacheEntry<PlaceDetailsResult>>;
}

// Error types for specific handling
export enum PlacesApiErrorType {
  API_KEY_INVALID = 'API_KEY_INVALID',
  API_KEY_MISSING = 'API_KEY_MISSING',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  BILLING_NOT_ENABLED = 'BILLING_NOT_ENABLED',
  ZERO_RESULTS = 'ZERO_RESULTS',
  INVALID_REQUEST = 'INVALID_REQUEST',
  REQUEST_DENIED = 'REQUEST_DENIED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  CANCELLED = 'CANCELLED',
}

export class PlacesApiError extends Error {
  constructor(
    public type: PlacesApiErrorType,
    message: string,
    public originalError?: any,
    public requestId?: string
  ) {
    super(message);
    this.name = 'PlacesApiError';
  }
}

// Debounce utility with AbortController support
class DebouncedRequest<T extends any[], R> {
  private timeoutId: NodeJS.Timeout | null = null;
  private controller: AbortController | null = null;

  constructor(
    private fn: (...args: T) => Promise<R>,
    private delay: number
  ) {}

  async execute(...args: T): Promise<R> {
    return new Promise<R>((resolve, reject) => {
      // Cancel previous request
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
      }
      if (this.controller) {
        this.controller.abort();
      }

      // Create new abort controller for this request
      this.controller = new AbortController();
      
      this.timeoutId = setTimeout(async () => {
        try {
          const result = await this.fn(...args);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, this.delay);
    });
  }

  cancel() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    if (this.controller) {
      this.controller.abort();
      this.controller = null;
    }
  }
}

export class PlacesApiWrapper {
  private map: google.maps.Map | null = null;
  private placesService: google.maps.places.PlacesService | null = null;
  private autocompleteService: google.maps.places.AutocompleteService | null = null;
  
  // Request management
  private searchController: AbortController | null = null;
  private autocompleteController: AbortController | null = null;
  private detailsController: AbortController | null = null;

  // Debounced methods
  private debouncedSearch: DebouncedRequest<[SearchOptions], SearchResult>;
  private debouncedAutocomplete: DebouncedRequest<[string, AutocompleteOptions], AutocompleteResult>;

  // Performance tracking
  private metrics: PerformanceMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    quotaUsage: {
      search: 0,
      autocomplete: 0,
      details: 0,
      textSearch: 0,
    },
  };

  // Cache storage
  private cache: SearchCache = {
    results: new Map(),
    details: new Map(),
  };

  // Cache TTL settings (in milliseconds)
  private readonly SEARCH_CACHE_TTL = 90000; // 90 seconds (60-120s range)
  private readonly DETAILS_CACHE_TTL = 12 * 60 * 1000; // 12 minutes (10-15 min range)

  private responseTimes: number[] = [];

  constructor(map?: google.maps.Map) {
    if (map) {
      this.initialize(map);
    }

    // Initialize debounced methods
    this.debouncedSearch = new DebouncedRequest(
      this.performSearch.bind(this), 
      300 // 300ms for search
    );
    
    this.debouncedAutocomplete = new DebouncedRequest(
      this.performAutocomplete.bind(this), 
      150 // 150ms for autocomplete
    );
  }

  /**
   * Check if the API wrapper is initialized
   */
  isInitialized(): boolean {
    return this.map !== null;
  }

  /**
   * Initialize the API wrapper with a Google Maps instance
   */
  initialize(map: google.maps.Map) {
    this.map = map;
    
    try {
      // Create a dummy div for PlacesService since it requires a map or div
      const dummyDiv = document.createElement('div');
      this.placesService = new google.maps.places.PlacesService(dummyDiv);
      this.autocompleteService = new google.maps.places.AutocompleteService();
    } catch (error) {
      throw new PlacesApiError(
        PlacesApiErrorType.API_KEY_INVALID,
        'Failed to initialize Places services. Please check your API key.',
        error
      );
    }
  }

  /**
   * Search for places near the map center or within bounds
   */
  async searchNearby(options: SearchOptions): Promise<SearchResult> {
    // Check if this should use text search based on query
    if (options.query && options.useTextSearch) {
      return this.searchText({
        query: options.query,
        bounds: options.bounds,
        openNow: options.openNow,
        maxResults: options.maxResults,
      });
    }
    
    return this.debouncedSearch.execute(options);
  }

  /**
   * Text search for places using free-form queries
   * Supports caching, pagination, and type hinting
   */
  async searchText(options: TextSearchOptions): Promise<SearchResult> {
    // Generate cache key based on query, viewport, and zoom
    const cacheKey = this.generateSearchCacheKey(options);
    
    // Check cache first
    const cachedResult = this.getFromCache(cacheKey);
    if (cachedResult) {
      console.log(`🎯 Using cached text search result for "${options.query}"`);
      return cachedResult;
    }

    // Perform the text search
    const result = await this.performTextSearch(options);
    
    // Cache the result
    this.setInCache(cacheKey, result, this.SEARCH_CACHE_TTL);
    
    return result;
  }

  /**
   * Get autocomplete predictions for a query
   */
  async autocomplete(input: string, options: AutocompleteOptions = {}): Promise<AutocompleteResult> {
    if (!input.trim()) {
      return {
        predictions: [],
        requestId: this.generateRequestId(),
        executionTime: 0,
      };
    }

    return this.debouncedAutocomplete.execute(input, options);
  }

  /**
   * Get detailed information about a specific place
   */
  async getPlaceDetails(
    placeId: string, 
    fields: string[] = ['place_id', 'name', 'formatted_address', 'geometry', 'rating', 'opening_hours']
  ): Promise<PlaceDetailsResult> {
    if (!this.placesService) {
      throw new PlacesApiError(
        PlacesApiErrorType.API_KEY_INVALID,
        'Places service not initialized'
      );
    }

    const requestId = this.generateRequestId();
    const startTime = performance.now();

    // Cancel previous details request
    if (this.detailsController) {
      this.detailsController.abort();
    }

    this.detailsController = new AbortController();

    return new Promise((resolve, reject) => {
      const request: google.maps.places.PlaceDetailsRequest = {
        placeId,
        fields: fields as any[],
        sessionToken: new google.maps.places.AutocompleteSessionToken(),
      };

      this.placesService!.getDetails(request, (result, status) => {
        const executionTime = performance.now() - startTime;
        
        if (this.detailsController?.signal.aborted) {
          reject(new PlacesApiError(PlacesApiErrorType.CANCELLED, 'Request was cancelled', null, requestId));
          return;
        }

        this.logMetrics('details', executionTime, status === google.maps.places.PlacesServiceStatus.OK);

        if (status === google.maps.places.PlacesServiceStatus.OK && result) {
          resolve({
            place: result,
            requestId,
            executionTime,
          });
        } else {
          reject(this.handlePlacesServiceError(status, 'Place details request failed', requestId));
        }
      });
    });
  }

  /**
   * Cancel all ongoing requests
   */
  cancelAll() {
    this.cancelSearch();
    this.cancelAutocomplete();
    this.cancelDetails();
  }

  /**
   * Cancel ongoing search requests
   */
  cancelSearch() {
    this.debouncedSearch.cancel();
    if (this.searchController) {
      this.searchController.abort();
      this.searchController = null;
    }
  }

  /**
   * Cancel ongoing autocomplete requests
   */
  cancelAutocomplete() {
    this.debouncedAutocomplete.cancel();
    if (this.autocompleteController) {
      this.autocompleteController.abort();
      this.autocompleteController = null;
    }
  }

  /**
   * Cancel ongoing details requests
   */
  cancelDetails() {
    if (this.detailsController) {
      this.detailsController.abort();
      this.detailsController = null;
    }
  }

  /**
   * Get performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset performance metrics
   */
  resetMetrics() {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      quotaUsage: {
        search: 0,
        autocomplete: 0,
        details: 0,
        textSearch: 0,
      },
    };
    this.responseTimes = [];
  }

  // Private methods

  /**
   * Perform text search with retry logic for OVER_QUERY_LIMIT
   */
  private async performTextSearch(options: TextSearchOptions, retryCount = 0): Promise<SearchResult> {
    if (!this.placesService) {
      throw new PlacesApiError(
        PlacesApiErrorType.API_KEY_INVALID,
        'Places service not initialized'
      );
    }

    const requestId = this.generateRequestId();
    const startTime = performance.now();

    return new Promise((resolve, reject) => {
      const request: any = {
        query: options.query,
        location: options.location || (options.bounds ? options.bounds.getCenter() : this.map?.getCenter()),
        radius: options.radius || 5000,
        language: options.language || navigator.language || 'en-US',
        region: options.region || 'us',
      };

      // Add openNow if specified (not in types but works in API)
      if (options.openNow) {
        request.openNow = true;
      }

      // Add pagination token if provided
      if (options.nextPageToken) {
        (request as any).pagetoken = options.nextPageToken;
      }

      console.group(`🔍 Text Search Request ${requestId}`);
      console.log('Query:', options.query);
      console.log('Options:', options);

      this.placesService!.textSearch(request, (results, status, pagination) => {
        const executionTime = performance.now() - startTime;
        
        this.logMetrics('textSearch', executionTime, status === google.maps.places.PlacesServiceStatus.OK);

        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          const convertedResults = results.map(this.convertLegacyResult.bind(this));
          
          console.log(`✅ Found ${convertedResults.length} places in ${executionTime.toFixed(0)}ms`);
          console.groupEnd();

          const result: SearchResult = {
            results: convertedResults,
            hasNextPage: !!pagination?.hasNextPage,
            nextPageToken: (pagination as any)?.pagetoken,
            requestId,
            executionTime,
            query: options.query,
          };

          resolve(result);
        } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
          console.log(`ℹ️ No results found for "${options.query}"`);
          console.groupEnd();
          
          resolve({
            results: [],
            hasNextPage: false,
            requestId,
            executionTime,
            query: options.query,
          });
        } else if (status === google.maps.places.PlacesServiceStatus.OVER_QUERY_LIMIT && retryCount === 0) {
          console.warn(`⚠️ Query limit exceeded, retrying in 1.5s...`);
          console.groupEnd();
          
          // Retry once after 1.5 seconds
          setTimeout(() => {
            this.performTextSearch(options, 1)
              .then(resolve)
              .catch(reject);
          }, 1500);
        } else {
          console.error(`❌ Text search failed:`, status);
          console.groupEnd();
          reject(this.handlePlacesServiceError(status, 'Text search failed', requestId));
        }
      });
    });
  }

  /**
   * Check if query matches a known place type
   * Returns category type or null if it's a free-text query
   */
  private detectPlaceType(query: string): string | null {
    const normalized = query.toLowerCase().trim();
    
    // Common type keywords
    const typeMap: Record<string, string> = {
      'restaurant': 'restaurant',
      'restaurants': 'restaurant',
      'hotel': 'lodging',
      'hotels': 'lodging',
      'motel': 'lodging',
      'lodging': 'lodging',
      'bar': 'bar',
      'bars': 'bar',
      'pub': 'bar',
      'cafe': 'cafe',
      'cafes': 'cafe',
      'coffee': 'cafe',
      'club': 'night_club',
      'clubs': 'night_club',
      'nightclub': 'night_club',
      'attraction': 'tourist_attraction',
      'attractions': 'tourist_attraction',
      'museum': 'museum',
      'park': 'park',
      'shopping': 'shopping_mall',
      'mall': 'shopping_mall',
      'store': 'store',
    };

    // Check if query is just a type keyword
    if (typeMap[normalized]) {
      return typeMap[normalized];
    }

    // Check if query ends with a type keyword
    for (const [keyword, type] of Object.entries(typeMap)) {
      if (normalized.endsWith(keyword) || normalized.startsWith(keyword)) {
        return type;
      }
    }

    return null;
  }

  /**
   * Generate cache key based on query, viewport bounds, and zoom level
   */
  private generateSearchCacheKey(options: TextSearchOptions): string {
    const viewportHash = this.getViewportHash(options.bounds);
    const zoomBucket = this.getZoomBucket();
    const query = options.query.toLowerCase().trim();
    const openNowFlag = options.openNow ? 'open' : 'all';
    
    return `search:${query}:${viewportHash}:z${zoomBucket}:${openNowFlag}`;
  }

  /**
   * Get hash of viewport bounds for caching
   */
  private getViewportHash(bounds?: google.maps.LatLngBounds): string {
    if (!bounds && !this.map) return 'default';
    
    const actualBounds = bounds || this.map!.getBounds();
    if (!actualBounds) return 'default';

    // Round to 3 decimal places for viewport hash
    const ne = actualBounds.getNorthEast();
    const sw = actualBounds.getSouthWest();
    
    return `${ne.lat().toFixed(3)},${ne.lng().toFixed(3)}-${sw.lat().toFixed(3)},${sw.lng().toFixed(3)}`;
  }

  /**
   * Get zoom bucket for caching (groups zoom levels into buckets)
   */
  private getZoomBucket(): number {
    if (!this.map) return 10;
    
    const zoom = this.map.getZoom() || 10;
    // Bucket zoom levels: 0-9, 10-12, 13-15, 16-18, 19-22
    if (zoom < 10) return 5;
    if (zoom < 13) return 11;
    if (zoom < 16) return 14;
    if (zoom < 19) return 17;
    return 20;
  }

  /**
   * Get cached result
   */
  private getFromCache(key: string): SearchResult | null {
    const entry = this.cache.results.get(key);
    
    if (!entry) return null;
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.results.delete(key);
      return null;
    }
    
    return entry.data;
  }

  /**
   * Store result in cache
   */
  private setInCache(key: string, data: SearchResult, ttl: number): void {
    const entry: CacheEntry<SearchResult> = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl,
    };
    
    this.cache.results.set(key, entry);
    
    // Clean up old entries (keep max 50 entries)
    if (this.cache.results.size > 50) {
      const entries = Array.from(this.cache.results.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      // Remove oldest 10 entries
      for (let i = 0; i < 10; i++) {
        this.cache.results.delete(entries[i][0]);
      }
    }
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.cache.results.clear();
    this.cache.details.clear();
  }

  private async performSearch(options: SearchOptions): Promise<SearchResult> {
    if (!this.map) {
      throw new PlacesApiError(
        PlacesApiErrorType.INVALID_REQUEST,
        'Map not initialized. Please initialize the wrapper with a map instance.'
      );
    }

    const requestId = this.generateRequestId();
    const startTime = performance.now();

    // Cancel previous search
    if (this.searchController) {
      this.searchController.abort();
    }

    this.searchController = new AbortController();

    try {
      console.group(`🔍 Places Search Request ${requestId}`);
      console.log('Options:', options);
      console.log('Map bounds:', this.map.getBounds()?.toString());

      // Use new Places API if available, fallback to old API
      const hasNewApi = typeof google.maps.places.Place?.searchNearby === 'function';
      console.log('Using new API:', hasNewApi);
      
      if (hasNewApi) {
        const result = await this.performNewApiSearch(options, requestId, startTime);
        console.groupEnd();
        return result;
      } else {
        const result = await this.performLegacySearch(options, requestId, startTime);
        console.groupEnd();
        return result;
      }
    } catch (error) {
      console.error('Search failed:', error);
      console.groupEnd();
      
      if (error instanceof PlacesApiError) {
        throw error;
      }
      
      throw new PlacesApiError(
        PlacesApiErrorType.UNKNOWN_ERROR,
        `Search failed: ${error}`,
        error,
        requestId
      );
    }
  }

  private async performNewApiSearch(
    options: SearchOptions, 
    requestId: string, 
    startTime: number
  ): Promise<SearchResult> {
    const request: google.maps.places.SearchNearbyRequest = {
      fields: [
        'id', 'displayName', 'formattedAddress', 'location', 
        'rating', 'userRatingCount', 'priceLevel', 'regularOpeningHours',
        'types', 'photos', 'businessStatus'
      ],
      maxResultCount: options.maxResults || 20,
      rankPreference: google.maps.places.SearchNearbyRankPreference.POPULARITY,
      language: 'en-US',
      region: 'us',
      locationRestriction: this.buildLocationRestriction(options),
    };

    // Add category filter if specified
    if (options.category && CATEGORY_TYPES[options.category]) {
      request.includedPrimaryTypes = [CATEGORY_TYPES[options.category].type];
    }

    if (this.searchController?.signal.aborted) {
      throw new PlacesApiError(PlacesApiErrorType.CANCELLED, 'Search was cancelled', null, requestId);
    }

    const { places } = await google.maps.places.Place.searchNearby(request);
    const executionTime = performance.now() - startTime;

    if (this.searchController?.signal.aborted) {
      throw new PlacesApiError(PlacesApiErrorType.CANCELLED, 'Search was cancelled', null, requestId);
    }

    // Filter results based on options
    let filteredPlaces = places || [];
    
    if (options.openNow) {
      filteredPlaces = filteredPlaces.filter(place => 
        (place.regularOpeningHours as any)?.openNow === true
      );
    }

    if (options.keyword) {
      const keyword = options.keyword.toLowerCase();
      filteredPlaces = filteredPlaces.filter(place => 
        place.displayName?.toLowerCase().includes(keyword) ||
        place.formattedAddress?.toLowerCase().includes(keyword)
      );
    }

    const convertedResults = filteredPlaces.map(this.convertNewApiResult.bind(this));

    this.logMetrics('search', executionTime, true);

    console.log(`✅ Found ${convertedResults.length} places in ${executionTime.toFixed(0)}ms`);

    return {
      results: convertedResults,
      hasNextPage: false, // New API doesn't support pagination the same way
      requestId,
      executionTime,
    };
  }

  private async performLegacySearch(
    options: SearchOptions, 
    requestId: string, 
    startTime: number
  ): Promise<SearchResult> {
    if (!this.placesService) {
      throw new PlacesApiError(PlacesApiErrorType.API_KEY_INVALID, 'Places service not initialized');
    }

    return new Promise((resolve, reject) => {
      const location = options.bounds ? options.bounds.getCenter() : this.map!.getCenter();
      const radius = 5000; // 5km radius

      let request: google.maps.places.PlaceSearchRequest = {
        location: location!,
        radius,
        type: options.category && CATEGORY_TYPES[options.category] 
          ? CATEGORY_TYPES[options.category].type 
          : undefined,
        openNow: options.openNow || undefined,
        keyword: options.keyword || undefined,
      };

      this.placesService!.nearbySearch(request, (results, status, pagination) => {
        const executionTime = performance.now() - startTime;
        
        if (this.searchController?.signal.aborted) {
          reject(new PlacesApiError(PlacesApiErrorType.CANCELLED, 'Search was cancelled', null, requestId));
          return;
        }

        this.logMetrics('search', executionTime, status === google.maps.places.PlacesServiceStatus.OK);

        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          const convertedResults = results.map(this.convertLegacyResult.bind(this));
          
          console.log(`✅ Found ${convertedResults.length} places in ${executionTime.toFixed(0)}ms`);

          resolve({
            results: convertedResults,
            hasNextPage: !!pagination?.hasNextPage,
            requestId,
            executionTime,
          });
        } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
          console.log(`ℹ️ No results found in ${executionTime.toFixed(0)}ms`);
          
          resolve({
            results: [],
            hasNextPage: false,
            requestId,
            executionTime,
          });
        } else {
          reject(this.handlePlacesServiceError(status, 'Places search failed', requestId));
        }
      });
    });
  }

  private async performAutocomplete(
    input: string, 
    options: AutocompleteOptions
  ): Promise<AutocompleteResult> {
    if (!this.autocompleteService) {
      throw new PlacesApiError(
        PlacesApiErrorType.API_KEY_INVALID,
        'Autocomplete service not initialized'
      );
    }

    const requestId = this.generateRequestId();
    const startTime = performance.now();

    // Cancel previous autocomplete request
    if (this.autocompleteController) {
      this.autocompleteController.abort();
    }

    this.autocompleteController = new AbortController();

    return new Promise((resolve, reject) => {
      const request: google.maps.places.AutocompletionRequest = {
        input,
        sessionToken: options.sessionToken || new google.maps.places.AutocompleteSessionToken(),
        types: options.types || ['establishment', 'geocode'],
        componentRestrictions: options.componentRestrictions || { country: 'us' },
        bounds: options.bounds,
      };

      console.group(`🔤 Autocomplete Request ${requestId}`);
      console.log('Input:', input);
      console.log('Options:', options);

      this.autocompleteService!.getPlacePredictions(request, (results, status) => {
        const executionTime = performance.now() - startTime;
        
        if (this.autocompleteController?.signal.aborted) {
          console.log('❌ Autocomplete cancelled');
          console.groupEnd();
          reject(new PlacesApiError(PlacesApiErrorType.CANCELLED, 'Autocomplete was cancelled', null, requestId));
          return;
        }

        this.logMetrics('autocomplete', executionTime, status === google.maps.places.PlacesServiceStatus.OK);

        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          const predictions = results.map(this.convertAutocompletePrediction.bind(this));
          
          console.log(`✅ Found ${predictions.length} predictions in ${executionTime.toFixed(0)}ms`);
          console.groupEnd();

          resolve({
            predictions,
            requestId,
            executionTime,
          });
        } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
          console.log(`ℹ️ No autocomplete results in ${executionTime.toFixed(0)}ms`);
          console.groupEnd();
          
          resolve({
            predictions: [],
            requestId,
            executionTime,
          });
        } else {
          console.groupEnd();
          reject(this.handlePlacesServiceError(status, 'Autocomplete request failed', requestId));
        }
      });
    });
  }

  // Utility methods

  private buildLocationRestriction(options: SearchOptions): google.maps.places.SearchNearbyRequest['locationRestriction'] {
    if (options.withinMap && options.bounds) {
      // Use circle at map center when "within map" is enabled
      const center = options.bounds.getCenter();
      const ne = options.bounds.getNorthEast();
      const sw = options.bounds.getSouthWest();
      
      // Calculate approximate radius to cover the map bounds
      const latDiff = Math.abs(ne.lat() - sw.lat());
      const lngDiff = Math.abs(ne.lng() - sw.lng());
      const diagonal = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
      const radiusInDegrees = diagonal / 2;
      const radiusInMeters = Math.min(radiusInDegrees * 111000, 50000); // Cap at 50km (API maximum)
      
      // JavaScript API format: no 'circle' wrapper, use lat/lng (not latitude/longitude)
      return {
        center: new google.maps.LatLng(center.lat(), center.lng()),
        radius: radiusInMeters
      } as any;
    } else {
      // Use circle with center and radius if not restricted to map bounds
      const center = this.map!.getCenter();
      if (center) {
        // JavaScript API format: no 'circle' wrapper, use lat/lng (not latitude/longitude)
        return {
          center: new google.maps.LatLng(center.lat(), center.lng()),
          radius: 5000 // 5km default radius
        } as any;
      }
    }
    
    throw new PlacesApiError(
      PlacesApiErrorType.INVALID_REQUEST,
      'Unable to determine search location'
    );
  }

  private convertNewApiResult(place: google.maps.places.Place): PlaceSearchResult {
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
      rating: place.rating || undefined,
      user_ratings_total: place.userRatingCount || undefined,
      price_level: place.priceLevel ? Number(place.priceLevel) : undefined,
      opening_hours: place.regularOpeningHours ? {
        open_now: (place.regularOpeningHours as any).openNow || false
      } : undefined,
      types: place.types || [],
      photos: (place.photos as any) || [],
      vicinity: place.formattedAddress || '',
      business_status: place.businessStatus || '',
    };
  }

  private convertLegacyResult(place: google.maps.places.PlaceResult): PlaceSearchResult {
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
      photos: place.photos || [],
      vicinity: place.vicinity || '',
      business_status: place.business_status,
    };
  }

  private convertAutocompletePrediction(
    prediction: google.maps.places.AutocompletePrediction
  ): AutocompletePrediction {
    return {
      place_id: prediction.place_id,
      description: prediction.description,
      structured_formatting: {
        main_text: prediction.structured_formatting.main_text,
        secondary_text: prediction.structured_formatting.secondary_text,
      },
      types: prediction.types,
      matched_substrings: prediction.matched_substrings,
    };
  }

  private handlePlacesServiceError(
    status: google.maps.places.PlacesServiceStatus,
    message: string,
    requestId?: string
  ): PlacesApiError {
    switch (status) {
      case google.maps.places.PlacesServiceStatus.ZERO_RESULTS:
        return new PlacesApiError(PlacesApiErrorType.ZERO_RESULTS, 'No results found', status, requestId);
      
      case google.maps.places.PlacesServiceStatus.OVER_QUERY_LIMIT:
        return new PlacesApiError(
          PlacesApiErrorType.QUOTA_EXCEEDED, 
          'Search quota exceeded. Please try again later.', 
          status, 
          requestId
        );
      
      case google.maps.places.PlacesServiceStatus.REQUEST_DENIED:
        return new PlacesApiError(
          PlacesApiErrorType.REQUEST_DENIED, 
          'Request denied. Please check your API key and permissions.', 
          status, 
          requestId
        );
      
      case google.maps.places.PlacesServiceStatus.INVALID_REQUEST:
        return new PlacesApiError(
          PlacesApiErrorType.INVALID_REQUEST, 
          'Invalid request parameters.', 
          status, 
          requestId
        );
      
      default:
        return new PlacesApiError(
          PlacesApiErrorType.UNKNOWN_ERROR, 
          `${message}: ${status}`, 
          status, 
          requestId
        );
    }
  }

  private logMetrics(operation: 'search' | 'autocomplete' | 'details' | 'textSearch', executionTime: number, success: boolean) {
    this.metrics.totalRequests++;
    this.metrics.quotaUsage[operation]++;
    this.responseTimes.push(executionTime);

    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }

    // Update rolling average
    this.metrics.averageResponseTime = 
      this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length;

    // Keep only last 100 response times for rolling average
    if (this.responseTimes.length > 100) {
      this.responseTimes = this.responseTimes.slice(-100);
    }
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton instance for global use
let globalApiWrapper: PlacesApiWrapper | null = null;

/**
 * Get or create the global API wrapper instance
 */
export function getPlacesApiWrapper(map?: google.maps.Map): PlacesApiWrapper {
  if (!globalApiWrapper) {
    globalApiWrapper = new PlacesApiWrapper(map);
  } else if (map && !globalApiWrapper.isInitialized()) {
    globalApiWrapper.initialize(map);
  }
  return globalApiWrapper;
}

/**
 * Create a new API wrapper instance (for components that need isolated instances)
 */
export function createPlacesApiWrapper(map: google.maps.Map): PlacesApiWrapper {
  return new PlacesApiWrapper(map);
}