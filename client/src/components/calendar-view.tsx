import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDays, MapPin, Plus } from "lucide-react";
import { addDays, isSameDay, isWithinInterval, min, max } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import type { Trip } from "@db/schema";

interface CalendarViewProps {
  tripId: number;
}

export function CalendarView({ tripId }: CalendarViewProps) {
  const [date, setDate] = useState<Date | undefined>(new Date());

  const { data: trip } = useQuery<Trip>({
    queryKey: ["/api/trips", tripId],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripId}`);
      if (!res.ok) throw new Error("Failed to fetch trip");
      return res.json();
    },
    enabled: !!tripId,
  });

  const { data: destinations = [] } = useQuery({
    queryKey: [`/api/trips/${tripId}/destinations`],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripId}/destinations`);
      if (!res.ok) throw new Error("Failed to fetch destinations");
      return res.json();
    },
    enabled: !!tripId
  });

  const { data: activities = [] } = useQuery({
    queryKey: [`/api/trips/${tripId}/activities`],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripId}/activities`);
      if (!res.ok) throw new Error("Failed to fetch activities");
      return res.json();
    },
    enabled: !!tripId
  });

  // Get activities on the selected date
  const activitiesOnDate = activities.filter((activity: any) => {
    if (!date) return false;
    const activityDate = new Date(activity.startTime);
    return isSameDay(activityDate, date);
  });

  // Create an array of dates that have activities for the calendar to highlight
  const activityDates = activities.reduce<Date[]>((dates, activity: any) => {
    const activityDate = new Date(activity.startTime);
    dates.push(activityDate);
    return dates;
  }, []);

  // Also highlight trip dates
  const tripDates: Date[] = [];
  if (trip) {
    let current = new Date(trip.startDate);
    const end = new Date(trip.endDate);
    while (current <= end) {
      tripDates.push(new Date(current));
      current = addDays(current, 1);
    }
  }

  const allHighlightedDates = [...activityDates, ...tripDates];

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="w-5 h-5" />
          Trip Calendar
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Calendar */}
          <div className="space-y-4">
            <div className="rounded-lg border p-4">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                modifiers={{
                  booked: allHighlightedDates,
                }}
                modifiersStyles={{
                  booked: {
                    backgroundColor: "hsl(var(--primary))",
                    color: "hsl(var(--primary-foreground))",
                  },
                }}
                className="rounded-md"
              />
            </div>
            
            {trip && (
              <div className="text-sm text-muted-foreground">
                <p>Trip dates: {new Date(trip.startDate).toLocaleDateString()} - {new Date(trip.endDate).toLocaleDateString()}</p>
                <p>Timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
              </div>
            )}
          </div>

          {/* Events for selected date */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">
                {date
                  ? `Events on ${date.toLocaleDateString()}`
                  : "Select a date to view events"}
              </h3>
              <Button variant="outline" size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Event
              </Button>
            </div>
            
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {activitiesOnDate.length > 0 ? (
                activitiesOnDate.map((activity: any) => (
                  <div
                    key={activity.id}
                    className="p-4 rounded-lg border border-border/50 bg-card hover:shadow-soft transition-all"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-foreground">{activity.title}</h4>
                      <Badge variant="outline" className="ml-2">
                        {formatTime(activity.startTime)}
                      </Badge>
                    </div>
                    
                    {activity.description && (
                      <p className="text-sm text-muted-foreground mb-2">{activity.description}</p>
                    )}
                    
                    {activity.location && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3" />
                        <span>{activity.location}</span>
                      </div>
                    )}
                  </div>
                ))
              ) : date ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No events on this date</p>
                  <Button variant="outline" size="sm" className="mt-3">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Event
                  </Button>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Select a date to view events</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}