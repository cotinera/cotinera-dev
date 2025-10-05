import { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getPlacesApiWrapper } from '@/lib/places/api-wrapper';
import type { AutocompletePrediction } from '@/lib/places/api-wrapper';

interface PlaceSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: (query: string) => void;
  onSelectPrediction?: (prediction: AutocompletePrediction) => void;
  placeholder?: string;
  className?: string;
  bounds?: google.maps.LatLngBounds;
  map?: google.maps.Map | null;
}

export function PlaceSearchInput({
  value,
  onChange,
  onSearch,
  onSelectPrediction,
  placeholder = 'Search for places (e.g., "italian restaurants", "korean BBQ")',
  className,
  bounds,
  map,
}: PlaceSearchInputProps) {
  const [predictions, setPredictions] = useState<AutocompletePrediction[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const apiWrapper = useRef(getPlacesApiWrapper(map || undefined));

  // Fetch autocomplete predictions
  useEffect(() => {
    if (!value.trim() || value.length < 2) {
      setPredictions([]);
      return;
    }

    const fetchPredictions = async () => {
      try {
        const result = await apiWrapper.current.autocomplete(value, {
          bounds: bounds,
          types: ['establishment', 'geocode'],
        });
        setPredictions(result.predictions);
        setShowSuggestions(true);
      } catch (error) {
        console.error('Autocomplete error:', error);
        setPredictions([]);
      }
    };

    fetchPredictions();
  }, [value, bounds]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    setSelectedIndex(-1);
  }, [onChange]);

  const handleSearch = useCallback(() => {
    if (value.trim()) {
      onSearch(value.trim());
      setShowSuggestions(false);
      inputRef.current?.blur();
    }
  }, [value, onSearch]);

  const handleSelectPrediction = useCallback((prediction: AutocompletePrediction) => {
    onChange(prediction.description);
    setShowSuggestions(false);
    
    if (onSelectPrediction) {
      onSelectPrediction(prediction);
    } else {
      // If no custom handler, just search with the selected text
      onSearch(prediction.description);
    }
  }, [onChange, onSearch, onSelectPrediction]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && predictions[selectedIndex]) {
        handleSelectPrediction(predictions[selectedIndex]);
      } else {
        handleSearch();
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => 
        prev < predictions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      inputRef.current?.blur();
    }
  }, [selectedIndex, predictions, handleSelectPrediction, handleSearch]);

  const handleClear = useCallback(() => {
    onChange('');
    setPredictions([]);
    setShowSuggestions(false);
    inputRef.current?.focus();
  }, [onChange]);

  return (
    <div className={cn('relative w-full', className)}>
      <div className="relative flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="text"
            value={value}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (predictions.length > 0) {
                setShowSuggestions(true);
              }
            }}
            placeholder={placeholder}
            className="pl-10 pr-10"
          />
          {value && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0"
              onClick={handleClear}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <Button onClick={handleSearch} size="sm" disabled={!value.trim()}>
          Search
        </Button>
      </div>

      {/* Autocomplete suggestions */}
      {showSuggestions && predictions.length > 0 && (
        <Card className="absolute top-full left-0 right-0 mt-1 max-h-80 overflow-hidden shadow-lg z-50 bg-background">
          <ScrollArea className="max-h-80">
            <div className="p-1">
              {predictions.map((prediction, index) => (
                <div
                  key={prediction.place_id}
                  className={cn(
                    'flex items-start p-3 cursor-pointer rounded-md transition-colors',
                    selectedIndex === index
                      ? 'bg-accent'
                      : 'hover:bg-accent/50'
                  )}
                  onClick={() => handleSelectPrediction(prediction)}
                >
                  <Search className="h-4 w-4 mt-0.5 mr-3 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {prediction.structured_formatting.main_text}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {prediction.structured_formatting.secondary_text}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </Card>
      )}
    </div>
  );
}
