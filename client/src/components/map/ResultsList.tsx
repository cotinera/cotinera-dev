import { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Star, Clock, Phone, MapPin, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PlaceSearchResult } from '@/lib/places/search';

// Skeleton loader for loading states
function ResultSkeleton() {
  return (
    <Card className="p-4 animate-pulse">
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <Skeleton className="h-6 w-16" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
    </Card>
  );
}

// Empty state component
function EmptyResults() {
  return (
    <Card className="p-8 text-center">
      <div className="space-y-4">
        <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <MapPin className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h3 className="font-semibold text-lg">No places found in this area</h3>
          <p className="text-muted-foreground">
            Try adjusting your filters or moving the map to a different location.
          </p>
        </div>
      </div>
    </Card>
  );
}

// Individual result item component
function ResultItem({ 
  result, 
  isSelected, 
  onClick 
}: { 
  result: PlaceSearchResult;
  isSelected: boolean;
  onClick: () => void;
}) {
  const getPlaceCategory = (types: string[]) => {
    const priorityTypes = {
      restaurant: 'Restaurant',
      food: 'Food',
      lodging: 'Hotel',
      tourist_attraction: 'Attraction',
      shopping_mall: 'Shopping',
      store: 'Store',
      hospital: 'Hospital',
      bank: 'Bank',
      gas_station: 'Gas Station',
      park: 'Park',
      cafe: 'Cafe',
      bar: 'Bar',
      night_club: 'Club'
    };
    
    for (const [type, label] of Object.entries(priorityTypes)) {
      if (types.includes(type)) {
        return label;
      }
    }
    
    return types[0]?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Place';
  };

  const formatPriceLevel = (level?: number) => {
    if (typeof level !== 'number') return null;
    return '$'.repeat(Math.min(level, 4));
  };

  return (
    <Card 
      className={cn(
        'p-4 cursor-pointer transition-all duration-200 hover:shadow-md',
        isSelected && 'ring-2 ring-primary bg-primary/5'
      )}
      onClick={onClick}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1 min-w-0">
            <h3 className="font-semibold text-base truncate">{result.name}</h3>
            <p className="text-sm text-muted-foreground truncate">{result.formatted_address}</p>
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
            {result.rating && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                {result.rating.toFixed(1)}
              </Badge>
            )}
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary">{getPlaceCategory(result.types)}</Badge>
          
          {result.opening_hours?.open_now && (
            <Badge variant="outline" className="flex items-center gap-1 text-green-600 border-green-600">
              <Clock className="h-3 w-3" />
              Open now
            </Badge>
          )}
          
          {result.price_level && (
            <Badge variant="outline">{formatPriceLevel(result.price_level)}</Badge>
          )}
          
          {result.user_ratings_total && (
            <span className="text-xs text-muted-foreground">
              ({result.user_ratings_total} reviews)
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}

interface ResultsListProps {
  results: PlaceSearchResult[];
  isLoading: boolean;
  hasNextPage: boolean;
  selectedResultId: string | null;
  onResultClick: (result: PlaceSearchResult) => void;
  onLoadMore: () => void;
  isLoadingMore?: boolean;
  className?: string;
}

export function ResultsList({
  results,
  isLoading,
  hasNextPage,
  selectedResultId,
  onResultClick,
  onLoadMore,
  isLoadingMore = false,
  className
}: ResultsListProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to top when new results load (but not when loading more)
  useEffect(() => {
    if (!isLoadingMore && scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = 0;
    }
  }, [results, isLoadingMore]);

  if (isLoading && results.length === 0) {
    return (
      <div className={cn('space-y-3', className)}>
        {Array.from({ length: 5 }).map((_, i) => (
          <ResultSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (!isLoading && results.length === 0) {
    return <EmptyResults />;
  }

  return (
    <div className={cn('space-y-4', className)}>
      <ScrollArea className="h-96" ref={scrollAreaRef}>
        <div className="space-y-3 pr-4">
          {results.map((result) => (
            <ResultItem
              key={result.place_id}
              result={result}
              isSelected={selectedResultId === result.place_id}
              onClick={() => onResultClick(result)}
            />
          ))}
          
          {/* Loading more skeleton */}
          {isLoadingMore && (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <ResultSkeleton key={`loading-${i}`} />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Load More Button */}
      {hasNextPage && !isLoadingMore && (
        <Button
          onClick={onLoadMore}
          variant="outline"
          className="w-full"
          disabled={isLoading}
        >
          <Loader2 className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
          More results
        </Button>
      )}
    </div>
  );
}