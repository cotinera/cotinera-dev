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
import { addDays, isSameDay, isWithinInterval, min, max } from "date-fns";
import { useQuery } from "@tanstack/react-query";

interface CalendarViewProps {
  trips: Trip[];
}

export function CalendarView({ trips }: CalendarViewProps) {
  const [date, setDate] = useState<Date | undefined>(new Date());

  // Get destinations for all trips
  const tripDestinationsQueries = trips.map(trip =>
    useQuery({
      queryKey: [`/api/trips/${trip.id}/destinations`],
      queryFn: async () => {
        const res = await fetch(`/api/trips/${trip.id}/destinations`);
        if (!res.ok) throw new Error("Failed to fetch destinations");
        return res.json();
      },
      enabled: !!trip.id
    })
  );

  // Get all trips that are happening on the selected date
  const tripsOnDate = trips.filter((trip, index) => {
    if (!date) return false;

    const destinations = tripDestinationsQueries[index].data;

    if (destinations && destinations.length > 0) {
      // If trip has destinations, use them to determine date range
      const startDates = destinations.map(d => new Date(d.startDate));
      const endDates = destinations.map(d => new Date(d.endDate));
      const tripStart = min(startDates);
      const tripEnd = max(endDates);

      return isWithinInterval(date, {
        start: tripStart,
        end: tripEnd,
      });
    } else {
      // Fallback to trip's main dates if no destinations
      return isWithinInterval(date, {
        start: new Date(trip.startDate),
        end: new Date(trip.endDate),
      });
    }
  });

  // Create an array of dates that have trips for the calendar to highlight
  const tripDates = trips.reduce<Date[]>((dates, trip, index) => {
    const destinations = tripDestinationsQueries[index].data;

    if (destinations && destinations.length > 0) {
      // If trip has destinations, use them to determine date range
      const startDates = destinations.map(d => new Date(d.startDate));
      const endDates = destinations.map(d => new Date(d.endDate));
      const tripStart = min(startDates);
      const tripEnd = max(endDates);

      let current = tripStart;
      while (current <= tripEnd) {
        dates.push(current);
        current = addDays(current, 1);
      }
    } else {
      // Fallback to trip's main dates if no destinations
      const start = new Date(trip.startDate);
      const end = new Date(trip.endDate);
      let current = start;

      while (current <= end) {
        dates.push(current);
        current = addDays(current, 1);
      }
    }

    return dates;
  }, []);

  return (
    <Card data-tutorial="calendar">
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