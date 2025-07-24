import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Destination } from "@db/schema";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { format } from "date-fns";
import { MapPin, CalendarDays, ArrowRight, Trash2, Calendar } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";

interface TripTimelineProps {
  tripId: number;
  currentDestinationId?: number;
  onDestinationChange: (destinationId?: number) => void;
}

const dateEditSchema = z.object({
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
}).refine((data) => new Date(data.startDate) <= new Date(data.endDate), {
  message: "End date must be after start date",
  path: ["endDate"],
});

export function TripTimeline({ 
  tripId, 
  currentDestinationId,
  onDestinationChange 
}: TripTimelineProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [destinationToDelete, setDestinationToDelete] = useState<Destination | null>(null);
  const [isDateEditOpen, setIsDateEditOpen] = useState(false);

  const { data: tripData } = useQuery({
    queryKey: ["/api/trips", tripId],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripId}`);
      if (!res.ok) throw new Error("Failed to fetch trip");
      return res.json();
    },
  });

  const form = useForm({
    resolver: zodResolver(dateEditSchema),
    defaultValues: {
      startDate: tripData?.startDate?.split('T')[0] || '',
      endDate: tripData?.endDate?.split('T')[0] || '',
    },
  });

  const updateTripDatesMutation = useMutation({
    mutationFn: async (data: z.infer<typeof dateEditSchema>) => {
      const res = await fetch(`/api/trips/${tripId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error("Failed to update trip dates");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId] });
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      setIsDateEditOpen(false);
      toast({
        title: "Success",
        description: "Trip dates updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update trip dates",
      });
    },
  });

  // Update form values when tripData changes
  useEffect(() => {
    if (tripData) {
      form.reset({
        startDate: tripData.startDate.split('T')[0],
        endDate: tripData.endDate.split('T')[0],
      });
    }
  }, [tripData, form]);

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
      try {
        const res = await fetch(`/api/trips/${tripId}/destinations/${destinationId}`, {
          method: "DELETE",
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || 'Failed to delete destination');
        }

        // Get remaining destinations to determine if we need to update the trip end date
        const remainingRes = await fetch(`/api/trips/${tripId}/destinations`);
        if (!remainingRes.ok) {
          throw new Error('Failed to fetch remaining destinations after deletion');
        }
        
        const remainingDestinations = await remainingRes.json();
        
        // If there are no more destinations, update trip end date to match trip start date
        // If there are remaining destinations, update trip end date to match the latest destination's end date
        if (tripData) {
          let newEndDate = tripData.startDate; // Default to trip start date
          
          if (remainingDestinations && remainingDestinations.length > 0) {
            // Sort the destinations by order to ensure we're respecting the chronological sequence
            const sortedDests = [...remainingDestinations].sort((a, b) => a.order - b.order);
            
            // Get the end date of the last destination in the chronological order
            const lastDestination = sortedDests[sortedDests.length - 1];
            newEndDate = lastDestination.endDate;
          }
          
          // Update the trip end date if needed
          const updateTripRes = await fetch(`/api/trips/${tripId}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              endDate: newEndDate,
            }),
            credentials: 'include'
          });
          
          if (!updateTripRes.ok) {
            console.warn("Failed to update trip end date after destination deletion");
          }
        }

        return await res.json();
      } catch (error) {
        console.error('Delete destination error:', error);
        throw error;
      }
    },
    onMutate: async (destinationId: number) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: [`/api/trips/${tripId}/destinations`] });
      
      // Snapshot the previous destination data
      const previousDestinations = queryClient.getQueryData<Destination[]>([`/api/trips/${tripId}/destinations`]);
      
      // Optimistically remove the deleted destination from the destinations array
      if (previousDestinations) {
        queryClient.setQueryData<Destination[]>(
          [`/api/trips/${tripId}/destinations`],
          previousDestinations.filter(d => d.id !== destinationId)
        );
      }
      
      return { previousDestinations };
    },
    onSuccess: () => {
      // Invalidate all related queries to ensure real-time updates everywhere
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/destinations`] });
      // Also invalidate the trip data query to update the trip timeline
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId] });
      // Invalidate the trips list
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      // Also invalidate the query used by the destinations dropdown in the TripDestinations component
      queryClient.invalidateQueries({ queryKey: ["trip-destinations", tripId] });
      
      if (currentDestinationId === destinationToDelete?.id) {
        onDestinationChange(undefined);
      }
      toast({
        title: "Success",
        description: "Destination deleted successfully",
      });
      setDestinationToDelete(null);
    },
    onError: (error: Error, _, context) => {
      // Revert to the previous state if there was an error
      if (context?.previousDestinations) {
        queryClient.setQueryData([`/api/trips/${tripId}/destinations`], context.previousDestinations);
      }
      
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete destination",
      });
      setDestinationToDelete(null);
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
                "relative ml-8 transition-colors hover:bg-accent cursor-pointer group",
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
                    <div 
                      className="flex items-center text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                      onClick={(e) => {
                        if (stop.id === 'main') {
                          e.stopPropagation();
                          setIsDateEditOpen(true);
                        }
                      }}
                      title={stop.id === 'main' ? "Click to edit trip dates" : undefined}
                    >
                      <CalendarDays className="h-3 w-3 mr-1" />
                      {format(new Date(stop.startDate), "MMM d")} -{" "}
                      {format(new Date(stop.endDate), "MMM d")}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {stop.id !== 'main' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDestinationToDelete(stop as Destination);
                        }}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    )}
                    <div className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs">
                      {`Stop ${index + 1}`}
                    </div>
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

      <Dialog open={isDateEditOpen} onOpenChange={setIsDateEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Trip Dates</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => updateTripDatesMutation.mutate(data))} className="space-y-4">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDateEditOpen(false)}
                  disabled={updateTripDatesMutation.isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateTripDatesMutation.isPending}>
                  {updateTripDatesMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Update Dates
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}