import { formatHour, PIXELS_PER_HOUR } from './utils';

interface CalendarGridProps {
  date: Date;
  onSlotClick?: (hour: number, minute: number, clientY: number) => void;
}

const CalendarGrid = ({ date, onSlotClick }: CalendarGridProps) => {
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const handleClick = (e: React.MouseEvent, hour: number) => {
    if (!onSlotClick) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const minute = Math.floor((offsetY / PIXELS_PER_HOUR) * 60 / 15) * 15;
    
    onSlotClick(hour, minute, e.clientY);
  };

  return (
    <div className="flex-1 relative">
      {/* Time labels */}
      <div className="absolute left-0 top-0 w-20 select-none pointer-events-none">
        {hours.map((hour) => (
          <div
            key={hour}
            className="text-xs text-muted-foreground pr-2 text-right"
            style={{
              height: `${PIXELS_PER_HOUR}px`,
              lineHeight: `${PIXELS_PER_HOUR}px`
            }}
          >
            {formatHour(hour)}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="ml-20 relative border-l border-border">
        {hours.map((hour) => (
          <div
            key={hour}
            className="border-b border-border hover:bg-accent/5 cursor-pointer transition-colors"
            style={{ height: `${PIXELS_PER_HOUR}px` }}
            onClick={(e) => handleClick(e, hour)}
          >
            {/* 15-minute subdivisions */}
            <div className="absolute inset-x-0 h-full pointer-events-none">
              {[15, 30, 45].map((minute) => (
                <div
                  key={minute}
                  className="absolute inset-x-0 border-t border-border/30"
                  style={{ top: `${(minute / 60) * PIXELS_PER_HOUR}px` }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CalendarGrid;
