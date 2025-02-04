import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, format, getDay, startOfMonth, endOfMonth, isSameMonth, isToday } from "date-fns";
import type { Trip } from "@db/schema";
import { useLocation } from "wouter";

interface MonthViewProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  trip: Trip;
}

export function MonthView({ currentDate, onDateChange, trip }: MonthViewProps) {
  const [, setLocation] = useLocation();
  const startDate = new Date(trip.startDate);
  const endDate = new Date(trip.endDate);

  // Get first day of the month
  const firstDayOfMonth = startOfMonth(currentDate);
  const lastDayOfMonth = endOfMonth(currentDate);

  // Calculate days to display
  const startingDayOfWeek = getDay(firstDayOfMonth);
  const daysInMonth = [];

  // Previous month days
  for (let i = 0; i < startingDayOfWeek; i++) {
    daysInMonth.push(addDays(firstDayOfMonth, -startingDayOfWeek + i));
  }

  // Current month days
  let currentDay = firstDayOfMonth;
  while (currentDay <= lastDayOfMonth) {
    daysInMonth.push(currentDay);
    currentDay = addDays(currentDay, 1);
  }

  // Next month days to complete the grid
  const remainingDays = 42 - daysInMonth.length; // 6 rows * 7 days
  for (let i = 0; i < remainingDays; i++) {
    daysInMonth.push(addDays(lastDayOfMonth, i + 1));
  }

  const isInTripRange = (date: Date) => {
    return date >= startDate && date <= endDate;
  };

  const handleDateClick = (date: Date) => {
    if (!isInTripRange(date)) return;
    setLocation(`/trips/${trip.id}/calendar/day/${format(date, 'yyyy-MM-dd')}`);
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">
          {format(currentDate, "MMMM yyyy")}
        </h3>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => onDateChange(addDays(currentDate, -30))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => onDateChange(addDays(currentDate, 30))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div
            key={day}
            className="text-center text-sm font-medium text-muted-foreground p-2"
          >
            {day}
          </div>
        ))}

        {daysInMonth.map((date, index) => {
          const isCurrentMonth = isSameMonth(date, currentDate);
          const isCurrentDay = isToday(date);
          const inTripRange = isInTripRange(date);

          return (
            <Button
              key={index}
              variant="ghost"
              className={cn(
                "h-12 w-full rounded-sm",
                !isCurrentMonth && "text-muted-foreground opacity-50",
                isCurrentDay && "bg-accent",
                inTripRange && "bg-primary/10 hover:bg-primary/20",
                !inTripRange && "cursor-not-allowed"
              )}
              onClick={() => handleDateClick(date)}
              disabled={!inTripRange}
            >
              <time dateTime={format(date, "yyyy-MM-dd")}>
                {format(date, "d")}
              </time>
            </Button>
          );
        })}
      </div>
    </Card>
  );
}