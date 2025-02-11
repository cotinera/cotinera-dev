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
    <div className="space-y-4">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <MapPin className="h-5 w-5" />
        Trip Timeline
      </h2>
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-6 top-4 bottom-4 w-px bg-border" />

        <div className="space-y-4">
          {sortedDestinations.map((destination, index) => (
            <Card key={destination.id} className="relative ml-12">
              {/* Timeline dot */}
              <div className="absolute -left-12 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary border-2 border-background" />
              
              <CardHeader className="py-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base">
                      {destination.name}
                    </CardTitle>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <CalendarDays className="h-4 w-4 mr-1" />
                      {format(new Date(destination.startDate), "MMM d")} -{" "}
                      {format(new Date(destination.endDate), "MMM d")}
                    </div>
                  </div>
                  <div className="px-2 py-1 rounded-full bg-primary/10 text-primary text-sm">
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
