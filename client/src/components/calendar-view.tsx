import { Calendar } from "@/components/ui/calendar";
import type { Trip } from "@db/schema";
import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { addDays, isSameDay, isWithinInterval } from "date-fns";

interface CalendarViewProps {
  trips: Trip[];
}

export function CalendarView({ trips }: CalendarViewProps) {
  const [date, setDate] = useState<Date | undefined>(new Date());

  // Get all trips that are happening on the selected date
  const tripsOnDate = trips.filter((trip) => {
    if (!date) return false;
    return isWithinInterval(date, {
      start: new Date(trip.startDate),
      end: new Date(trip.endDate),
    });
  });

  // Create an array of dates that have trips for the calendar to highlight
  const tripDates = trips.reduce<Date[]>((dates, trip) => {
    const start = new Date(trip.startDate);
    const end = new Date(trip.endDate);
    let current = start;

    while (current <= end) {
      dates.push(current);
      current = addDays(current, 1);
    }

    return dates;
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Calendar</CardTitle>
        <CardDescription>View your upcoming trips</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col md:flex-row gap-8">
        <div className="flex-1">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            modifiers={{
              booked: tripDates,
            }}
            modifiersStyles={{
              booked: {
                backgroundColor: "hsl(var(--primary))",
                color: "hsl(var(--primary-foreground))",
              },
            }}
            className="rounded-md border"
          />
        </div>
        <div className="flex-1">
          <h3 className="font-medium mb-4">
            {date
              ? `Trips on ${date.toLocaleDateString()}`
              : "Select a date to view trips"}
          </h3>
          <div className="space-y-4">
            {tripsOnDate.map((trip) => (
              <div
                key={trip.id}
                className="p-4 rounded-lg border bg-card text-card-foreground"
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">{trip.title}</h4>
                  <Badge>{trip.location}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {new Date(trip.startDate).toLocaleDateString()} -{" "}
                  {new Date(trip.endDate).toLocaleDateString()}
                </p>
              </div>
            ))}
            {date && tripsOnDate.length === 0 && (
              <p className="text-muted-foreground">No trips on this date</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
