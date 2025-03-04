import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { Clock, MapPin } from "lucide-react";
import type { Trip, Activity } from "@db/schema";

interface CalendarSummaryProps {
  trip: Trip;
  activities: Activity[];
}

export function CalendarSummary({ trip, activities }: CalendarSummaryProps) {
  // Group activities by date
  const groupedActivities = activities.reduce((acc, activity) => {
    const date = format(new Date(activity.startTime), 'yyyy-MM-dd');
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(activity);
    return acc;
  }, {} as Record<string, Activity[]>);

  // Sort dates
  const sortedDates = Object.keys(groupedActivities).sort();

  return (
    <ScrollArea className="h-[calc(100vh-16rem)]">
      <div className="space-y-8 p-4">
        {sortedDates.map((date) => (
          <div key={date} className="space-y-4">
            <h3 className="text-lg font-semibold sticky top-0 bg-background py-2">
              {format(new Date(date), 'EEEE, MMMM d, yyyy')}
            </h3>
            <div className="space-y-4">
              {groupedActivities[date]
                .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                .map((activity) => (
                  <Card key={activity.id} className="p-4">
                    <div className="space-y-2">
                      <h4 className="font-medium">{activity.title}</h4>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          <span>
                            {format(new Date(activity.startTime), 'h:mm a')} -{' '}
                            {format(new Date(activity.endTime), 'h:mm a')}
                          </span>
                        </div>
                        {activity.location && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            <span>{activity.location}</span>
                          </div>
                        )}
                      </div>
                      {activity.description && (
                        <p className="text-sm text-muted-foreground mt-2">
                          {activity.description}
                        </p>
                      )}
                    </div>
                  </Card>
                ))}
            </div>
          </div>
        ))}
        {sortedDates.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            No activities scheduled yet
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
