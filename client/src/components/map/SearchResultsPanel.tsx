import { useState, useCallback, useRef, useEffect } from 'react';
import { Search, Loader2, MapPin, ChevronDown, Info, RefreshCw } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PlaceResultCard } from './PlaceResultCard';
import type { PlaceSearchResult } from '@/lib/places/search';
import type { SortOption, SearchState } from '@/hooks/use-places-search-controller';
import { cn } from '@/lib/utils';

interface SearchResultsPanelProps {
  // Search state
  searchState: SearchState;
  results: PlaceSearchResult[];
  sortedResults: PlaceSearchResult[];
  isLoading: boolean;
  hasNextPage: boolean;
  error: string | null;
  
  // Filters
  selectedCategoryLabel: string | null;
  sortBy: SortOption;
  updateOnMapMove: boolean;
  
  // Selection
  selectedResultId: string | null;
  hoveredResultId: string | null;
  
  // Actions
  onResultClick: (place: PlaceSearchResult) => void;
  onResultHover: (placeId: string | null) => void;
  onSavePlace: (place: PlaceSearchResult, e: React.MouseEvent) => void;
  onAddToItinerary?: (place: PlaceSearchResult, e: React.MouseEvent) => void;
  onLoadMore: () => void;
  onSortChange: (sort: SortOption) => void;
  onUpdateOnMapMoveChange: (enabled: boolean) => void;
  onUpdateResultsClick?: () => void;
  
  // Map center for distance calculation
  mapCenter: { lat: number; lng: number };
  
  // Map instance for photo loading
  map?: google.maps.Map | null;
  
  // Mobile
  isMobile?: boolean;
}

export function SearchResultsPanel({
  searchState,
  results,
  sortedResults,
  isLoading,
  hasNextPage,
  error,
  selectedCategoryLabel,
  sortBy,
  updateOnMapMove,
  selectedResultId,
  hoveredResultId,
  onResultClick,
  onResultHover,
  onSavePlace,
  onAddToItinerary,
  onLoadMore,
  onSortChange,
  onUpdateOnMapMoveChange,
  onUpdateResultsClick,
  mapCenter,
  map,
  isMobile = false,
}: SearchResultsPanelProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  // Keyboard navigation handler
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (sortedResults.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex((prev) => {
          const next = Math.min(prev + 1, sortedResults.length - 1);
          if (sortedResults[next]) {
            onResultHover(sortedResults[next].place_id);
          }
          return next;
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((prev) => {
          const next = Math.max(prev - 1, 0);
          if (sortedResults[next]) {
            onResultHover(sortedResults[next].place_id);
          }
          return next;
        });
        break;
      case 'Enter':
        e.preventDefault();
        if (focusedIndex >= 0 && sortedResults[focusedIndex]) {
          onResultClick(sortedResults[focusedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setFocusedIndex(-1);
        onResultHover(null);
        break;
    }
  }, [sortedResults, focusedIndex, onResultHover, onResultClick]);

  // Reset focus when results change
  useEffect(() => {
    setFocusedIndex(-1);
  }, [sortedResults.length]);

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

  // Scroll to selected or hovered result (for marker hover sync)
  useEffect(() => {
    const targetId = hoveredResultId || selectedResultId;
    if (targetId && scrollAreaRef.current) {
      const targetElement = scrollAreaRef.current.querySelector(`[data-result-id="${targetId}"]`);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [selectedResultId, hoveredResultId]);

  // Render empty state
  const renderEmptyState = () => {
    if (searchState === 'IDLE') {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-center px-4">
          <Search className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="font-semibold text-lg mb-2">Search for Places</h3>
          <p className="text-sm text-muted-foreground">
            Select a category above to find restaurants, hotels, and more
          </p>
        </div>
      );
    }

    if (searchState === 'EMPTY') {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-center px-4">
          <MapPin className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="font-semibold text-lg mb-2">No Results Found</h3>
          <p className="text-sm text-muted-foreground mb-4">
            No results here—try zooming out or moving the map.
          </p>
          {onUpdateResultsClick && (
            <Button variant="outline" size="sm" onClick={onUpdateResultsClick}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Different Area
            </Button>
          )}
        </div>
      );
    }

    if (searchState === 'ERROR') {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-center px-4">
          <Info className="h-12 w-12 text-destructive/40 mb-4" />
          <h3 className="font-semibold text-lg mb-2">Search Error</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {error || 'Failed to load results. Please try again.'}
          </p>
          {onUpdateResultsClick && (
            <Button variant="outline" size="sm" onClick={onUpdateResultsClick}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          )}
        </div>
      );
    }

    return null;
  };

  // Render loading skeleton
  const renderLoadingSkeleton = () => {
    if (!isLoading || sortedResults.length > 0) return null;

    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-3 animate-pulse">
            <div className="flex gap-3">
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
                <div className="h-3 bg-muted rounded w-2/3" />
              </div>
              <div className="w-20 h-20 bg-muted rounded-xl flex-shrink-0" />
            </div>
          </Card>
        ))}
      </div>
    );
  };

  const hasResults = sortedResults.length > 0;
  const showContent = hasResults || isLoading;

  return (
    <div 
      className={cn(
        "flex flex-col h-full border-r bg-background outline-none",
        isMobile ? "w-full" : "w-[380px]"
      )}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-muted/30">
        <div className="p-4 space-y-3">
          {/* Title and query label */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-lg">
                {selectedCategoryLabel || 'Search Results'}
              </h3>
            </div>
            {isLoading && sortedResults.length > 0 && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>

          {/* Filters row */}
          {showContent && (
            <div className="flex items-center gap-3 flex-wrap">
              {/* Sort dropdown */}
              <div className="flex-1 min-w-[140px]">
                <Select value={sortBy} onValueChange={(value) => onSortChange(value as SortOption)}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recommended">Recommended</SelectItem>
                    <SelectItem value="rating">Rating</SelectItem>
                    <SelectItem value="distance">Distance</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Results count */}
              {sortedResults.length > 0 && (
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {sortedResults.length} {sortedResults.length === 1 ? 'result' : 'results'}
                </span>
              )}
            </div>
          )}

          {/* Update on map move toggle */}
          {showContent && (
            <div className="flex items-center justify-between">
              <Label htmlFor="update-toggle" className="text-xs text-muted-foreground cursor-pointer">
                Update results when map moves
              </Label>
              <Switch
                id="update-toggle"
                checked={updateOnMapMove}
                onCheckedChange={onUpdateOnMapMoveChange}
              />
            </div>
          )}

          {/* Update button (when toggle is off) */}
          {!updateOnMapMove && onUpdateResultsClick && sortedResults.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={onUpdateResultsClick}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Update results for this area
            </Button>
          )}
        </div>
      </div>

      {/* Results list */}
      <ScrollArea 
        className="flex-1" 
        ref={scrollAreaRef}
        onScrollCapture={(e) => {
          const target = e.target as HTMLElement;
          setScrollPosition(target.scrollTop);
        }}
      >
        <div className="p-4 space-y-3">
          {/* Empty/Error states */}
          {!showContent && renderEmptyState()}

          {/* Loading skeleton */}
          {renderLoadingSkeleton()}

          {/* Results */}
          {sortedResults.map((place) => (
            <div
              key={place.place_id}
              data-result-id={place.place_id}
            >
              <PlaceResultCard
                place={place}
                distance={calculateDistance(
                  place.geometry.location.lat,
                  place.geometry.location.lng
                )}
                isSelected={selectedResultId === place.place_id}
                isHovered={hoveredResultId === place.place_id}
                onCardClick={() => onResultClick(place)}
                onSaveClick={(e) => onSavePlace(place, e)}
                onAddToItinerary={onAddToItinerary ? (e) => onAddToItinerary(place, e) : undefined}
                onMouseEnter={() => onResultHover(place.place_id)}
                onMouseLeave={() => onResultHover(null)}
                map={map}
              />
            </div>
          ))}

          {/* Load more button */}
          {hasNextPage && sortedResults.length > 0 && (
            <Button
              variant="outline"
              className="w-full"
              onClick={onLoadMore}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-2" />
                  Load More Results
                </>
              )}
            </Button>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
