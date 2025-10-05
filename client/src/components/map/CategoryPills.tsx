import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Utensils, Hotel, Wine, Coffee, MapPin, Moon, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

// Official Places API types mapping
export const CATEGORY_TYPES = {
  restaurants: {
    id: 'restaurants',
    label: 'Restaurants',
    type: 'restaurant',
    icon: Utensils,
    color: 'bg-orange-500',
  },
  hotels: {
    id: 'hotels', 
    label: 'Hotels',
    type: 'lodging',
    icon: Hotel,
    color: 'bg-blue-500',
  },
  clubs: {
    id: 'clubs',
    label: 'Clubs', 
    type: 'night_club',
    icon: '🪩',
    color: 'bg-purple-500',
  },
  cafes: {
    id: 'cafes',
    label: 'Cafes',
    type: 'cafe', 
    icon: Coffee,
    color: 'bg-amber-500',
  },
  bars: {
    id: 'bars',
    label: 'Bars',
    type: 'bar',
    icon: Wine,
    color: 'bg-red-500',
  },
  attractions: {
    id: 'attractions',
    label: 'Attractions',
    type: 'tourist_attraction',
    icon: MapPin,
    color: 'bg-green-500',
  },
} as const;

export type CategoryId = keyof typeof CATEGORY_TYPES;
export type CategoryType = typeof CATEGORY_TYPES[CategoryId];

interface CategoryPillsProps {
  selectedCategory: CategoryId | null;
  onCategoryChange: (category: CategoryId | null) => void;
  openNow: boolean;
  onOpenNowChange: (openNow: boolean) => void;
  withinMap: boolean;
  onWithinMapChange: (withinMap: boolean) => void;
  className?: string;
}

export function CategoryPills({
  selectedCategory,
  onCategoryChange,
  openNow,
  onOpenNowChange,
  withinMap,
  onWithinMapChange,
  className
}: CategoryPillsProps) {
  const categories = Object.values(CATEGORY_TYPES);

  return (
    <div className={cn('space-y-3', className)}>
      {/* Category Pills */}
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => {
          const Icon = category.icon;
          const isSelected = selectedCategory === category.id;
          
          return (
            <Button
              key={category.id}
              variant={isSelected ? 'default' : 'outline'}
              size="sm"
              onClick={() => onCategoryChange(isSelected ? null : category.id)}
              className={cn(
                'flex items-center gap-2 transition-all duration-200 hover:scale-105',
                isSelected && `${category.color} text-white border-transparent hover:opacity-90`
              )}
            >
              {typeof Icon === 'string' ? (
                <span className="text-base leading-none">{Icon}</span>
              ) : (
                <Icon className="h-4 w-4" />
              )}
              {category.label}
            </Button>
          );
        })}
      </div>

      {/* Filter Options */}
      <div className="flex flex-wrap gap-2 items-center">
        <Badge 
          variant={openNow ? 'default' : 'outline'}
          className={cn(
            'cursor-pointer transition-all duration-200 hover:scale-105',
            openNow && 'bg-green-600 text-white'
          )}
          onClick={() => onOpenNowChange(!openNow)}
        >
          Open now
        </Badge>
        
        <Badge 
          variant={withinMap ? 'default' : 'outline'}
          className={cn(
            'cursor-pointer transition-all duration-200 hover:scale-105',
            withinMap && 'bg-blue-600 text-white'
          )}
          onClick={() => onWithinMapChange(!withinMap)}
        >
          Within map
        </Badge>
      </div>
    </div>
  );
}