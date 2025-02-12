import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Destination } from "@db/schema";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { format } from "date-fns";
import { MapPin, CalendarDays, ArrowRight, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [destinationToDelete, setDestinationToDelete] = useState<Destination | null>(null);

  const { data: destinations } = useQuery<Destination[]>({
    queryKey: [`/api/trips/${tripId}/destinations`],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripId}/destinations`);
      if (!res.ok) throw new Error("Failed to fetch destinations");
      return res.json();
    },
  });

  const deleteDestinationMutation = useMutation({
    mutationFn: async (destinationId: number) => {
      const res = await fetch(`/api/trips/${tripId}/destinations/${destinationId}`, {
        method: "DELETE",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const errorData = await res.json();
          throw new Error(errorData.error || "Failed to delete destination");
        }
        throw new Error(`Failed to delete destination: ${res.status} ${res.statusText}`);
      }

      // Return true to indicate successful deletion
      return true;
    },
    onSuccess: async (_, deletedDestinationId) => {
      // Immediately invalidate and refetch to ensure we have the latest data
      await queryClient.invalidateQueries({ 
        queryKey: [`/api/trips/${tripId}/destinations`] 
      });

      // If the deleted destination was selected, clear the selection
      if (currentDestinationId === deletedDestinationId) {
        onDestinationChange(undefined);
      }

      toast({
        title: "Success",
        description: "Destination deleted successfully",
      });
      setDestinationToDelete(null);
    },
    onError: (error: Error) => {
      console.error("Delete destination error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete destination",
      });
      setDestinationToDelete(null);
    },
  });

  if (!destinations?.length) return null;

  const sortedDestinations = destinations?.sort((a, b) => a.order - b.order) || [];
  const allStops = sortedDestinations;

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
                "relative ml-8 transition-colors hover:bg-accent cursor-pointer group",
                currentDestinationId === stop.id && "bg-accent"
              )}
              onClick={() => {
                onDestinationChange(stop.id === currentDestinationId ? undefined : stop.id);
              }}
            >
              {/* Timeline dot and arrow */}
              <div className="absolute -left-8 top-1/2 -translate-y-1/2 flex items-center">
                <div className={cn(
                  "w-2 h-2 rounded-full border-2 border-background",
                  currentDestinationId === stop.id ? "bg-primary" : "bg-muted"
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
                  <div className="flex items-center gap-2">
                    <div className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs">
                      {`Stop ${index + 1}`}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDestinationToDelete(stop);
                      }}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>

      <AlertDialog 
        open={!!destinationToDelete} 
        onOpenChange={(open) => !open && setDestinationToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete destination</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this destination? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (destinationToDelete) {
                  deleteDestinationMutation.mutate(destinationToDelete.id);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}