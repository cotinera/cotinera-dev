import { useRef, useState, useCallback, useEffect } from 'react';
import { CalendarEvent } from './types';
import {
  getTimeInMinutes,
  minutesToPixels,
  pixelsToMinutes,
  snapToSlot,
  setTimeInMinutes,
  formatTime,
  clampMinutes,
  getDuration,
  PIXELS_PER_HOUR
} from './utils';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

interface CalendarEventProps {
  event: CalendarEvent;
  onUpdate: (eventId: string, updates: { startTime?: Date; endTime?: Date; title?: string; location?: string }) => void;
  onDelete: (eventId: string) => void;
  gridTop: number;
}

const CalendarEventComponent = ({ event, onUpdate, onDelete, gridTop }: CalendarEventProps) => {
  const eventRef = useRef<HTMLDivElement>(null);
  const tempStartRef = useRef<Date>(event.startTime);
  const tempEndRef = useRef<Date>(event.endTime);
  const hasDraggedRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragType, setDragType] = useState<'move' | 'resize-top' | 'resize-bottom' | null>(null);
  const [tempStartTime, setTempStartTime] = useState<Date>(event.startTime);
  const [tempEndTime, setTempEndTime] = useState<Date>(event.endTime);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(event.title);
  const [editLocation, setEditLocation] = useState(event.location || '');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');

  // Reset temp times when event prop changes
  useEffect(() => {
    setTempStartTime(event.startTime);
    setTempEndTime(event.endTime);
    tempStartRef.current = event.startTime;
    tempEndRef.current = event.endTime;
  }, [event.startTime, event.endTime]);

  const startMinutes = getTimeInMinutes(tempStartTime);
  const endMinutes = getTimeInMinutes(tempEndTime);
  const duration = endMinutes - startMinutes;

  const top = minutesToPixels(startMinutes);
  const height = minutesToPixels(duration);

  const handlePointerDown = useCallback((e: React.PointerEvent, type: 'move' | 'resize-top' | 'resize-bottom') => {
    e.stopPropagation();
    e.preventDefault();
    
    hasDraggedRef.current = false;
    setIsDragging(true);
    setDragType(type);

    const startY = e.clientY;
    const initialStartTime = new Date(tempStartTime);
    const initialEndTime = new Date(tempEndTime);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaY = moveEvent.clientY - startY;
      
      // Mark as dragged if moved more than 3 pixels
      if (Math.abs(deltaY) > 3) {
        hasDraggedRef.current = true;
      }
      
      const deltaMinutes = snapToSlot(pixelsToMinutes(deltaY));

      if (type === 'move') {
        const newStartMinutes = clampMinutes(getTimeInMinutes(initialStartTime) + deltaMinutes);
        const newEndMinutes = clampMinutes(getTimeInMinutes(initialEndTime) + deltaMinutes);
        
        const newStart = setTimeInMinutes(event.startTime, newStartMinutes);
        const newEnd = setTimeInMinutes(event.endTime, newEndMinutes);
        
        tempStartRef.current = newStart;
        tempEndRef.current = newEnd;
        setTempStartTime(newStart);
        setTempEndTime(newEnd);
      } else if (type === 'resize-top') {
        const newStartMinutes = clampMinutes(getTimeInMinutes(initialStartTime) + deltaMinutes);
        const currentEndMinutes = getTimeInMinutes(initialEndTime);
        
        // Ensure minimum 15 minutes duration
        if (currentEndMinutes - newStartMinutes >= 15) {
          const newStart = setTimeInMinutes(event.startTime, newStartMinutes);
          tempStartRef.current = newStart;
          setTempStartTime(newStart);
        }
      } else if (type === 'resize-bottom') {
        const newEndMinutes = clampMinutes(getTimeInMinutes(initialEndTime) + deltaMinutes);
        const currentStartMinutes = getTimeInMinutes(initialStartTime);
        
        // Ensure minimum 15 minutes duration
        if (newEndMinutes - currentStartMinutes >= 15) {
          const newEnd = setTimeInMinutes(event.endTime, newEndMinutes);
          tempEndRef.current = newEnd;
          setTempEndTime(newEnd);
        }
      }
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      setDragType(null);
      
      // Commit changes using refs
      onUpdate(event.id, {
        startTime: tempStartRef.current,
        endTime: tempEndRef.current
      });

      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
  }, [event, tempStartTime, tempEndTime, onUpdate]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    // Only open edit dialog if we didn't drag
    if (!hasDraggedRef.current) {
      setIsEditing(true);
      setEditTitle(event.title);
      setEditLocation(event.location || '');
      setEditStartTime(formatTime(event.startTime));
      setEditEndTime(formatTime(event.endTime));
    }
  }, [event]);

  const handleSaveEdit = useCallback(() => {
    const parseTime = (timeStr: string, baseDate: Date): Date => {
      const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (!match) return baseDate;
      
      let hours = parseInt(match[1]);
      const minutes = parseInt(match[2]);
      const period = match[3].toUpperCase();
      
      if (period === 'PM' && hours !== 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
      
      return setTimeInMinutes(baseDate, hours * 60 + minutes);
    };

    const newStartTime = parseTime(editStartTime, event.startTime);
    const newEndTime = parseTime(editEndTime, event.endTime);

    onUpdate(event.id, {
      title: editTitle,
      location: editLocation,
      startTime: newStartTime,
      endTime: newEndTime
    });
    
    setIsEditing(false);
  }, [editTitle, editLocation, editStartTime, editEndTime, event, onUpdate]);

  return (
    <div
      ref={eventRef}
      className={cn(
        "absolute inset-x-2 rounded-md border border-primary/20 bg-primary/10 overflow-hidden transition-shadow",
        isDragging ? "shadow-lg ring-2 ring-primary/30" : "hover:shadow-md hover:border-primary/40",
        dragType === 'move' && "cursor-move",
        dragType === 'resize-top' && "cursor-ns-resize",
        dragType === 'resize-bottom' && "cursor-ns-resize"
      )}
      style={{
        top: `${top}px`,
        height: `${Math.max(height, 15)}px`
      }}
    >
      {/* Resize handle - top */}
      <div
        className="absolute inset-x-0 top-0 h-1 cursor-ns-resize hover:bg-primary/30 transition-colors"
        onPointerDown={(e) => handlePointerDown(e, 'resize-top')}
      />

      {/* Event content */}
      <div
        className="px-2 py-1 h-full overflow-hidden cursor-pointer select-none"
        onPointerDown={(e) => handlePointerDown(e, 'move')}
        onClick={handleClick}
      >
        <div className="text-xs font-medium text-primary truncate">
          {event.title}
        </div>
        <div className="text-xs text-muted-foreground">
          {formatTime(tempStartTime)} - {formatTime(tempEndTime)}
        </div>
        {event.location && height > 40 && (
          <div className="text-xs text-muted-foreground truncate mt-0.5">
            {event.location}
          </div>
        )}
      </div>

      {/* Resize handle - bottom */}
      <div
        className="absolute inset-x-0 bottom-0 h-1 cursor-ns-resize hover:bg-primary/30 transition-colors"
        onPointerDown={(e) => handlePointerDown(e, 'resize-bottom')}
      />

      {/* Edit Dialog */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Edit Event</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Event title"
              />
            </div>
            <div>
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={editLocation}
                onChange={(e) => setEditLocation(e.target.value)}
                placeholder="Event location (optional)"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startTime">Start Time</Label>
                <Input
                  id="startTime"
                  value={editStartTime}
                  onChange={(e) => setEditStartTime(e.target.value)}
                  placeholder="9:00 AM"
                />
              </div>
              <div>
                <Label htmlFor="endTime">End Time</Label>
                <Input
                  id="endTime"
                  value={editEndTime}
                  onChange={(e) => setEditEndTime(e.target.value)}
                  placeholder="10:00 AM"
                />
              </div>
            </div>
            <div className="flex justify-between gap-2">
              <Button 
                variant="destructive" 
                onClick={() => {
                  onDelete(event.id);
                  setIsEditing(false);
                }}
              >
                Delete
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveEdit}>
                  Save
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CalendarEventComponent;
