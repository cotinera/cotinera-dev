import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Smile } from 'lucide-react';

// Popular emoji options similar to Google Maps
const ICON_OPTIONS = [
  '📍', // Default red pin
  '❤️', // Heart
  '⭐', // Star
  '🍽️', // Restaurant
  '☕', // Coffee
  '🏨', // Hotel
  '⛽', // Gas station
  '🏛️', // Museum
  '🏖️', // Beach
  '🏔️', // Mountain
  '🌊', // Water/Ocean
  '🏪', // Shop
  '🎭', // Entertainment
  '🏥', // Hospital
  '✈️', // Airport
  '🚂', // Train
  '🚗', // Car/Parking
  '🎯', // Target/Goal
  '🌟', // Special
  '🎉', // Party/Event
  '📚', // Library/Education
  '⛪', // Church
  '🕌', // Mosque
  '🏛️', // Government
  '🎪', // Circus/Fun
  '🎨', // Art
  '🍕', // Pizza
  '🍺', // Bar/Drinks
];

interface IconPickerProps {
  selectedIcon: string;
  onIconSelect: (icon: string) => void;
  className?: string;
}

export function IconPicker({ selectedIcon, onIconSelect, className }: IconPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          className={`w-12 h-12 p-0 text-lg ${className}`}
          aria-label="Choose icon"
        >
          {selectedIcon}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Smile className="h-4 w-4" />
            <span className="text-sm font-medium">Choose an icon for your place</span>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {ICON_OPTIONS.map((icon) => (
              <Button
                key={icon}
                variant={selectedIcon === icon ? "default" : "ghost"}
                className={`w-10 h-10 p-0 text-lg ${
                  selectedIcon === icon ? 'ring-2 ring-primary ring-offset-2' : ''
                }`}
                onClick={() => {
                  onIconSelect(icon);
                  setIsOpen(false);
                }}
                aria-label={`Select ${icon} icon`}
              >
                {icon}
              </Button>
            ))}
          </div>
          <div className="text-xs text-muted-foreground">
            Choose an icon that represents this place, just like in Google Maps!
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Alternative component for use in dialogs
interface IconPickerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIcon: string;
  onIconSelect: (icon: string) => void;
}

export function IconPickerDialog({ 
  isOpen, 
  onClose, 
  selectedIcon, 
  onIconSelect 
}: IconPickerDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smile className="h-5 w-5" />
            Choose an Icon
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-7 gap-2">
            {ICON_OPTIONS.map((icon) => (
              <Button
                key={icon}
                variant={selectedIcon === icon ? "default" : "ghost"}
                className={`w-10 h-10 p-0 text-lg ${
                  selectedIcon === icon ? 'ring-2 ring-primary ring-offset-2' : ''
                }`}
                onClick={() => {
                  onIconSelect(icon);
                  onClose();
                }}
                aria-label={`Select ${icon} icon`}
              >
                {icon}
              </Button>
            ))}
          </div>
          <div className="text-sm text-muted-foreground">
            Choose an icon that represents this place, just like in Google Maps!
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}