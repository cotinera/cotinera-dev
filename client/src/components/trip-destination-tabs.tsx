import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MapPin } from "lucide-react";
import type { Destination } from "@db/schema";

interface TripDestinationTabsProps {
  tripId: number;
  currentDestinationId?: number;
  onDestinationChange: (destinationId: number) => void;
}

export function TripDestinationTabs({
  tripId,
  currentDestinationId,
  onDestinationChange,
}: TripDestinationTabsProps) {
  const { data: destinations = [] } = useQuery<Destination[]>({
    queryKey: [`/api/trips/${tripId}/destinations`],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripId}/destinations`);
      if (!res.ok) throw new Error("Failed to fetch destinations");
      return res.json();
    },
  });

  if (destinations.length <= 1) return null;

  return (
    <div className="border-b">
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex items-center px-4 py-2">
          <Tabs
            value={currentDestinationId?.toString()}
            onValueChange={(value) => onDestinationChange(parseInt(value))}
            className="w-full"
          >
            <TabsList className="h-12 items-stretch bg-background p-0">
              {destinations.map((destination) => (
                <TabsTrigger
                  key={destination.id}
                  value={destination.id.toString()}
                  className="relative rounded-none border-r px-6 data-[state=active]:bg-muted"
                >
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span>{destination.name}</span>
                  </div>
                  <div
                    className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary opacity-0 transition-opacity data-[state=active]:opacity-100"
                  />
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </ScrollArea>
    </div>
  );
}