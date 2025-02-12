import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Trip, Destination } from "@db/schema";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Pin, Plus, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export function TripDestinations({ tripId }: { tripId: number }) {
  const [isOpen, setIsOpen] = useState(false);
  const { data: trip } = useQuery<Trip>({
    queryKey: ["/api/trips", tripId],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripId}`);
      if (!res.ok) throw new Error("Failed to fetch trip");
      return res.json();
    },
  });

  const { data: destinations = [] } = useQuery<Destination[]>({
    queryKey: [`/api/trips/${tripId}/destinations`],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripId}/destinations`);
      if (!res.ok) throw new Error("Failed to fetch destinations");
      return res.json();
    },
  });

  const sortedDestinations = destinations?.sort((a, b) => a.order - b.order) || [];
  const totalStops = sortedDestinations.length + 1; // Including the initial stop

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="w-[250px]"
    >
      <Card className="border shadow-sm">
        <CollapsibleTrigger asChild>
          <CardHeader className="p-2 cursor-pointer">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Pin className="h-4 w-4" />
                <span className="font-medium text-sm">
                  Destinations ({totalStops})
                </span>
              </div>
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-200 ${
                  isOpen ? "transform rotate-180" : ""
                }`}
              />
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="p-2 pt-0">
            <div className="space-y-1.5 max-h-[250px] overflow-y-auto">
              {/* Initial Stop */}
              <div
                key="main"
                className="flex items-center justify-between p-1.5 rounded-md bg-muted/50 text-sm"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate text-xs">
                    {trip?.location || 'Starting Point'}
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">1</Badge>
              </div>

              {/* Additional Destinations */}
              {sortedDestinations.map((destination, index) => (
                <div
                  key={destination.id}
                  className="flex items-center justify-between p-1.5 rounded-md bg-muted/50 text-sm"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-xs">
                      {destination.name}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {index + 2}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}