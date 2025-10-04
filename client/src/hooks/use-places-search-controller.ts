import { useState, useCallback, useRef, useEffect } from 'react';
import { PlacesSearchService } from '@/lib/places/search';
import type { PlaceSearchResult, SearchFilters } from '@/lib/places/search';
import { CategoryId } from '@/components/map/CategoryPills';

// Search states for the state machine
export type SearchState = 'IDLE' | 'LOADING' | 'RENDERED' | 'EMPTY' | 'ERROR';

// Sort options
export type SortOption = 'recommended' | 'rating' | 'distance';

// Search session for request versioning
interface SearchSession {
  id: number;
  filters: SearchFilters & { category: CategoryId | null };
  results: PlaceSearchResult[];
  hasNextPage: boolean;
  state: SearchState;
  error?: string;
}

// Cache entry structure
interface CacheEntry {
  results: PlaceSearchResult[];
  hasNextPage: boolean;
  timestamp: number;
  sessionId: number;
}

export interface PlacesSearchController {
  // State
  searchState: SearchState;
  searchResults: PlaceSearchResult[];
  isLoading: boolean;
  hasNextPage: boolean;
  selectedResultId: string | null;
  sortBy: SortOption;
  updateOnMapMove: boolean;
  error: string | null;
  
  // Actions
  performSearch: (filters: SearchFilters & { category: CategoryId | null }) => Promise<void>;
  loadMore: () => Promise<void>;
  setSelectedResultId: (id: string | null) => void;
  setSortBy: (sort: SortOption) => void;
  setUpdateOnMapMove: (enabled: boolean) => void;
  clearResults: () => void;
  getSortedResults: () => PlaceSearchResult[];
}

export function usePlacesSearchController(
  map: google.maps.Map | null,
  mapCenter: { lat: number; lng: number }
): PlacesSearchController {
  const [currentSession, setCurrentSession] = useState<SearchSession>({
    id: 0,
    filters: { category: null, openNow: false, withinMap: true, keyword: '' },
    results: [],
    hasNextPage: false,
    state: 'IDLE',
  });
  
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('recommended');
  const [updateOnMapMove, setUpdateOnMapMove] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  const placesSearchServiceRef = useRef<PlacesSearchService | null>(null);
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
  const sessionIdCounter = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Initialize search service
  useEffect(() => {
    if (map && !placesSearchServiceRef.current) {
      placesSearchServiceRef.current = new PlacesSearchService(map);
    }
  }, [map]);

  // Generate cache key from filters
  const getCacheKey = useCallback((filters: SearchFilters & { category: CategoryId | null }): string => {
    const bounds = filters.bounds;
    const boundsKey = bounds 
      ? `${bounds.getNorthEast().lat().toFixed(3)},${bounds.getNorthEast().lng().toFixed(3)},${bounds.getSouthWest().lat().toFixed(3)},${bounds.getSouthWest().lng().toFixed(3)}`
      : 'no-bounds';
    
    return `${filters.category || 'no-category'}_${filters.openNow}_${filters.withinMap}_${filters.keyword}_${boundsKey}`;
  }, []);

  // Clean old cache entries (older than 2 minutes)
  const cleanCache = useCallback(() => {
    const now = Date.now();
    const maxAge = 2 * 60 * 1000; // 2 minutes
    
    // Convert to array to avoid iterator issues
    const entries = Array.from(cacheRef.current.entries());
    for (const [key, entry] of entries) {
      if (now - entry.timestamp > maxAge) {
        cacheRef.current.delete(key);
      }
    }
  }, []);

  // Calculate distance from map center
  const calculateDistance = useCallback((lat: number, lng: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat - mapCenter.lat) * Math.PI / 180;
    const dLon = (lng - mapCenter.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(mapCenter.lat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }, [mapCenter]);

  // Sort results based on current sort option
  const getSortedResults = useCallback((): PlaceSearchResult[] => {
    const results = [...currentSession.results];
    
    switch (sortBy) {
      case 'rating':
        return results.sort((a, b) => {
          const ratingA = a.rating || 0;
          const ratingB = b.rating || 0;
          if (ratingB !== ratingA) {
            return ratingB - ratingA;
          }
          // If ratings are equal, sort by number of reviews
          return (b.user_ratings_total || 0) - (a.user_ratings_total || 0);
        });
      
      case 'distance':
        return results.sort((a, b) => {
          const distA = calculateDistance(a.geometry.location.lat, a.geometry.location.lng);
          const distB = calculateDistance(b.geometry.location.lat, b.geometry.location.lng);
          return distA - distB;
        });
      
      case 'recommended':
      default:
        // Keep original order (Places API default ranking)
        return results;
    }
  }, [currentSession.results, sortBy, calculateDistance]);

  // Main search function with state machine
  const performSearch = useCallback(async (filters: SearchFilters & { category: CategoryId | null }) => {
    if (!placesSearchServiceRef.current || !map) return;
    
    // Only search if we have a category
    if (!filters.category) {
      setCurrentSession({
        id: 0,
        filters,
        results: [],
        hasNextPage: false,
        state: 'IDLE',
      });
      return;
    }

    // Abort any ongoing search
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    // Increment session ID for request versioning
    sessionIdCounter.current += 1;
    const sessionId = sessionIdCounter.current;
    
    // Check cache first
    const cacheKey = getCacheKey(filters);
    const cached = cacheRef.current.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < 2 * 60 * 1000) {
      // Use cached results if less than 2 minutes old
      setCurrentSession({
        id: sessionId,
        filters,
        results: cached.results,
        hasNextPage: cached.hasNextPage,
        state: 'RENDERED',
      });
      setSelectedResultId(null);
      return;
    }

    // Set loading state but keep previous results visible
    setCurrentSession(prev => ({
      ...prev,
      id: sessionId,
      filters,
      state: 'LOADING',
    }));

    try {
      const bounds = filters.withinMap ? map.getBounds() : null;
      
      const searchOptions: SearchFilters & { map: google.maps.Map } = {
        ...filters,
        bounds,
        map: map
      };

      const result = await placesSearchServiceRef.current.searchDebounced(searchOptions);
      
      // Only update if this is still the current session
      if (sessionId === sessionIdCounter.current && !abortControllerRef.current.signal.aborted) {
        const newState: SearchSession = {
          id: sessionId,
          filters,
          results: result.results,
          hasNextPage: result.hasNextPage,
          state: result.results.length > 0 ? 'RENDERED' : 'EMPTY',
        };
        
        setCurrentSession(newState);
        setSelectedResultId(null);
        
        // Update cache
        cleanCache();
        cacheRef.current.set(cacheKey, {
          results: result.results,
          hasNextPage: result.hasNextPage,
          timestamp: Date.now(),
          sessionId,
        });
      }
    } catch (error) {
      // Only update error if this is still the current session
      if (sessionId === sessionIdCounter.current && !abortControllerRef.current.signal.aborted) {
        console.error('Search error:', error);
        setCurrentSession(prev => ({
          ...prev,
          id: sessionId,
          state: 'ERROR',
          error: error instanceof Error ? error.message : 'Search failed',
        }));
      }
    }
  }, [map, getCacheKey, cleanCache]);

  // Load more results (pagination)
  const loadMore = useCallback(async () => {
    if (!placesSearchServiceRef.current || !currentSession.hasNextPage || isLoadingMore) {
      return;
    }

    setIsLoadingMore(true);
    try {
      const result = await placesSearchServiceRef.current.getNextPage();
      
      // Append new results to existing ones
      setCurrentSession(prev => ({
        ...prev,
        results: [...prev.results, ...result.results],
        hasNextPage: result.hasNextPage,
      }));
    } catch (error) {
      console.error('Load more error:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [currentSession.hasNextPage, isLoadingMore]);

  // Clear results
  const clearResults = useCallback(() => {
    setCurrentSession({
      id: 0,
      filters: { category: null, openNow: false, withinMap: true, keyword: '' },
      results: [],
      hasNextPage: false,
      state: 'IDLE',
    });
    setSelectedResultId(null);
  }, []);

  return {
    searchState: currentSession.state,
    searchResults: currentSession.results,
    isLoading: currentSession.state === 'LOADING',
    hasNextPage: currentSession.hasNextPage,
    selectedResultId,
    sortBy,
    updateOnMapMove,
    error: currentSession.error || null,
    
    performSearch,
    loadMore,
    setSelectedResultId,
    setSortBy,
    setUpdateOnMapMove,
    clearResults,
    getSortedResults,
  };
}
