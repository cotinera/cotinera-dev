import { useCallback } from 'react';
import { usePlacesSearchController } from './use-places-search-controller';
import type { PlaceSearchResult } from '@/lib/places/search';
import type { CategoryId } from '@/components/map/CategoryPills';

/**
 * Compatibility adapter that wraps usePlacesSearchController and exposes
 * legacy-compatible state fields while providing the controller's benefits
 * (session versioning, caching, stable state machine)
 */
export function useSearchStateAdapter(
  map: google.maps.Map | null,
  mapCenter: { lat: number; lng: number }
) {
  const controller = usePlacesSearchController(map, mapCenter);

  // Legacy-compatible state fields
  const searchResults = controller.searchResults;
  const isLoadingSearch = controller.isLoading;
  const hasNextPage = controller.hasNextPage;
  const selectedResultId = controller.selectedResultId;
  const isLoadingMore = controller.isLoading && searchResults.length > 0; // Loading more when already have results

  // Legacy-compatible action forwarders
  const setSelectedResultId = useCallback((id: string | null) => {
    controller.setSelectedResultId(id);
  }, [controller]);

  const setSearchResults = useCallback((results: PlaceSearchResult[] | ((prev: PlaceSearchResult[]) => PlaceSearchResult[])) => {
    // This is a compatibility shim - in legacy code, results were set directly
    // With the controller, we don't expose direct result setting, but we can handle the callback form
    if (typeof results === 'function') {
      // For callback form, we can't easily support this without exposing controller internals
      // Log a warning and ignore - the controller manages results internally
      console.warn('Direct searchResults mutation via callback is not supported with the controller');
    } else {
      // For direct assignment, also not supported - controller manages results
      console.warn('Direct searchResults mutation is not supported with the controller');
    }
  }, []);

  // Expose the controller for advanced usage
  const performSearch = controller.performSearch;
  const loadMore = controller.loadMore;
  const sortBy = controller.sortBy;
  const setSortBy = controller.setSortBy;
  const updateOnMapMove = controller.updateOnMapMove;
  const setUpdateOnMapMove = controller.setUpdateOnMapMove;
  const getSortedResults = controller.getSortedResults;
  const searchState = controller.searchState;
  const error = controller.error;

  return {
    // Legacy compatibility fields
    searchResults,
    isLoadingSearch,
    hasNextPage,
    selectedResultId,
    isLoadingMore,
    setSelectedResultId,
    setSearchResults, // Compatibility shim (noop with warning)
    
    // Controller methods
    performSearch,
    loadMore,
    sortBy,
    setSortBy,
    updateOnMapMove,
    setUpdateOnMapMove,
    getSortedResults,
    searchState,
    error,
    
    // Full controller access for progressive migration
    controller,
  };
}

export type SearchStateAdapter = ReturnType<typeof useSearchStateAdapter>;
