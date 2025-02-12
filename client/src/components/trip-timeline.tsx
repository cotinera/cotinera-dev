import { useQuery } from "@tanstack/react-query";
import type { Destination } from "@db/schema";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { format } from "date-fns";
import { MapPin, CalendarDays, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface TripTimelineProps {
  tripId: number;
  currentDestinationId?: number;
  onDestinationChange: (destinationId?: number) => void;
}

export function TripTimeline({ 
  tripId, 
  currentDestinationId,
  onDestinationChange 
}: TripTimelineProps) {
  const { data: tripData } = useQuery({
    queryKey: ["/api/trips", tripId],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripId}`);
      if (!res.ok) throw new Error("Failed to fetch trip");
      return res.json();
    },
  });

  const { data: destinations } = useQuery<Destination[]>({
    queryKey: [`/api/trips/${tripId}/destinations`],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripId}/destinations`);
      if (!res.ok) throw new Error("Failed to fetch destinations");
      return res.json();
    },
  });

  if (!destinations?.length && !tripData?.location) return null;

  const sortedDestinations = destinations?.sort((a, b) => a.order - b.order) || [];
  const allStops = [
    {
      id: 'main',
      name: tripData?.location || 'Starting Point',
      startDate: tripData?.startDate,
      endDate: sortedDestinations[0]?.startDate || tripData?.endDate,
      order: -1
    },
    ...sortedDestinations
  ];

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <MapPin className="h-4 w-4" />
        Trip Timeline
      </h2>
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-4 bottom-4 w-px bg-border" />

        <div className="space-y-2">
          {allStops.map((stop, index) => (
            <Card 
              key={stop.id} 
              className={cn(
                "relative ml-8 transition-colors hover:bg-accent cursor-pointer",
                currentDestinationId === (stop.id === 'main' ? undefined : stop.id) && "bg-accent"
              )}
              onClick={() => {
                if (stop.id === 'main') {
                  onDestinationChange(undefined);
                } else {
                  onDestinationChange(stop.id === currentDestinationId ? undefined : stop.id);
                }
              }}
            >
              {/* Timeline dot and arrow */}
              <div className="absolute -left-8 top-1/2 -translate-y-1/2 flex items-center">
                <div className={cn(
                  "w-2 h-2 rounded-full border-2 border-background",
                  (currentDestinationId === (stop.id === 'main' ? undefined : stop.id)) ? "bg-primary" : "bg-muted"
                )} />
                {index < allStops.length - 1 && (
                  <ArrowRight className="h-4 w-4 text-muted-foreground ml-2" />
                )}
              </div>

              <CardHeader className="py-2">
                <div className="flex items-start justify-between">
                  <div className="space-y-0.5">
                    <CardTitle className="text-sm">
                      {stop.name}
                    </CardTitle>
                    <div className="flex items-center text-xs text-muted-foreground">
                      <CalendarDays className="h-3 w-3 mr-1" />
                      {format(new Date(stop.startDate), "MMM d")} -{" "}
                      {format(new Date(stop.endDate), "MMM d")}
                    </div>
                  </div>
                  <div className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs">
                    {`Stop ${index + 1}`}
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}