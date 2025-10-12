import { useState, useRef, useCallback } from 'react';
import { CalendarEvent } from './types';
import CalendarGrid from './CalendarGrid';
import CalendarEventComponent from './CalendarEvent';
import {
  setTimeInMinutes,
  snapToSlot,
  pixelsToMinutes,
  getTimeInMinutes,
  PIXELS_PER_HOUR
} from './utils';

interface CalendarProps {
  date: Date;
  events: CalendarEvent[];
  onEventsChange: (events: CalendarEvent[]) => void;
}

const Calendar = ({ date, events, onEventsChange }: CalendarProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createStart, setCreateStart] = useState<{ y: number; minutes: number } | null>(null);

  const handleEventUpdate = useCallback((eventId: string, updates: { startTime?: Date; endTime?: Date; title?: string; location?: string }) => {
    const updatedEvents = events.map(event =>
      event.id === eventId
        ? { ...event, ...updates }
        : event
    );
    onEventsChange(updatedEvents);
  }, [events, onEventsChange]);

  const handleEventDelete = useCallback((eventId: string) => {
    const updatedEvents = events.filter(event => event.id !== eventId);
    onEventsChange(updatedEvents);
  }, [events, onEventsChange]);

  const handleSlotPointerDown = useCallback((e: React.PointerEvent) => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const minutes = snapToSlot(pixelsToMinutes(offsetY));
    
    setIsCreating(true);
    setCreateStart({ y: e.clientY, minutes });

    const handlePointerMove = (moveEvent: PointerEvent) => {
      // Visual feedback could be added here
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      if (!containerRef.current || !createStart) return;

      const rect = containerRef.current.getBoundingClientRect();
      const endOffsetY = upEvent.clientY - rect.top;
      const endMinutes = snapToSlot(pixelsToMinutes(endOffsetY));

      // Only create if dragged for at least 15 minutes
      const startMin = Math.min(createStart.minutes, endMinutes);
      const endMin = Math.max(createStart.minutes, endMinutes);

      if (endMin - startMin >= 15) {
        const newEvent: CalendarEvent = {
          id: `event-${Date.now()}`,
          title: 'New Event',
          startTime: setTimeInMinutes(date, startMin),
          endTime: setTimeInMinutes(date, endMin),
          category: 'other'
        };

        onEventsChange([...events, newEvent]);
      }

      setIsCreating(false);
      setCreateStart(null);
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
  }, [date, events, onEventsChange, createStart]);

  const gridTop = containerRef.current?.getBoundingClientRect().top || 0;

  return (
    <div className="relative h-full">
      <div
        ref={containerRef}
        className="relative h-full overflow-y-auto"
        onPointerDown={handleSlotPointerDown}
      >
        <CalendarGrid date={date} />
        
        {/* Events layer */}
        <div className="absolute inset-0 ml-20 pointer-events-none">
          <div className="relative h-full pointer-events-auto">
            {events
              .filter(event => {
                const eventDate = new Date(event.startTime);
                return eventDate.toDateString() === date.toDateString();
              })
              .map(event => (
                <CalendarEventComponent
                  key={event.id}
                  event={event}
                  onUpdate={handleEventUpdate}
                  onDelete={handleEventDelete}
                  gridTop={gridTop}
                />
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Calendar;
