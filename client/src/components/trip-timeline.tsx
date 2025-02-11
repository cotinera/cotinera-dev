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

export function TripTimeline({ tripId }: { tripId: number }) {
  const { data: destinations } = useQuery<Destination[]>({
    queryKey: [`/api/trips/${tripId}/destinations`],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripId}/destinations`);
      if (!res.ok) throw new Error("Failed to fetch destinations");
      return res.json();
    },
  });

  if (!destinations?.length) return null;

  const sortedDestinations = destinations.sort((a, b) => a.order - b.order);

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
          {sortedDestinations.map((destination, index) => (
            <Card key={destination.id} className="relative ml-8">
              {/* Timeline dot and arrow */}
              <div className="absolute -left-8 top-1/2 -translate-y-1/2 flex items-center">
                <div className="w-2 h-2 rounded-full bg-primary border-2 border-background" />
                {index < sortedDestinations.length - 1 && (
                  <ArrowRight className="h-4 w-4 text-muted-foreground ml-2" />
                )}
              </div>

              <CardHeader className="py-2">
                <div className="flex items-start justify-between">
                  <div className="space-y-0.5">
                    <CardTitle className="text-sm">
                      {destination.name}
                    </CardTitle>
                    <div className="flex items-center text-xs text-muted-foreground">
                      <CalendarDays className="h-3 w-3 mr-1" />
                      {format(new Date(destination.startDate), "MMM d")} -{" "}
                      {format(new Date(destination.endDate), "MMM d")}
                    </div>
                  </div>
                  <div className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs">
                    Stop {index + 1}
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