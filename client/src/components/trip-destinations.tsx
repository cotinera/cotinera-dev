import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Trip, Destination } from "@db/schema";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import { Pin, Plus, ChevronDown, Edit2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { MapPicker } from "@/components/map-picker";
import { ScrollArea } from "@/components/ui/scroll-area";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const destinationSchema = z.object({
  name: z.string().min(1, "Location name is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
});

type FormData = z.infer<typeof destinationSchema>;

export function TripDestinations({ tripId }: { tripId: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [isAddDestinationOpen, setIsAddDestinationOpen] = useState(false);
  const [isEditDestinationOpen, setIsEditDestinationOpen] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState<Destination | null>(null);
  const [selectedCoordinates, setSelectedCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [destinationToDelete, setDestinationToDelete] = useState<Destination | null>(null);

  const { data: trip } = useQuery({
    queryKey: ["trip", tripId],
    queryFn: async () => {
      const response = await fetch(`/api/trips/${tripId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch trip");
      }
      return response.json();
    },
    enabled: !!tripId,
  });

  const { data: destinations = [] } = useQuery({
    queryKey: ["trip-destinations", tripId],
    queryFn: async () => {
      const response = await fetch(`/api/trips/${tripId}/destinations`);
      if (!response.ok) {
        throw new Error("Failed to fetch destinations");
      }
      return response.json();
    },
    enabled: !!tripId,
  });

  // Sort destinations by start date
  const sortedDestinations = [...destinations].sort((a, b) => {
    return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
  });

  const totalStops = sortedDestinations.length + 1; // +1 for the starting point

  const form = useForm<FormData>({
    resolver: zodResolver(destinationSchema),
    defaultValues: {
      name: "",
      startDate: "",
      endDate: "",
    },
  });

  const editForm = useForm<FormData>({
    resolver: zodResolver(destinationSchema),
    defaultValues: {
      name: "",
      startDate: "",
      endDate: "",
    },
  });

  const addDestinationMutation = useMutation({
    mutationFn: async (data: FormData) => {
      // First, add the destination
      const response = await fetch(`/api/trips/${tripId}/destinations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          coordinates: selectedCoordinates,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to add destination");
      }

      const newDestination = await response.json();
      
      // Now update the trip end date to match the latest destination end date
      // This ensures the trip end date is always synchronized with the latest destination
      if (trip) {
        const updateTripResponse = await fetch(`/api/trips/${tripId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            endDate: data.endDate,
          }),
          credentials: 'include'
        });
        
        if (!updateTripResponse.ok) {
          console.warn("Failed to update trip end date, but destination was added successfully");
        }
      }

      return newDestination;
    },
    onSuccess: () => {
      toast({
        title: "Destination added",
        description: "The destination has been added to your trip.",
      });
      setIsAddDestinationOpen(false);
      
      // Invalidate all relevant queries to update the UI in real-time
      queryClient.invalidateQueries({ queryKey: ["trip-destinations", tripId] });
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/destinations`] });
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId] });
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteDestinationMutation = useMutation({
    mutationFn: async () => {
      if (!destinationToDelete) return null;

      // First, delete the destination
      const response = await fetch(`/api/trips/${tripId}/destinations/${destinationToDelete.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete destination");
      }

      // After deleting the destination, we need to update the trip end date
      // Find the latest destination end date from the remaining destinations
      const remainingDestinations = destinations.filter((d: Destination) => d.id !== destinationToDelete.id);
      
      if (remainingDestinations.length === 0) {
        // If no destinations left, we should update the trip end date to the original trip value
        if (trip) {
          const updateTripResponse = await fetch(`/api/trips/${tripId}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              // Reset to original trip end date which should match the trip start date if no destinations
              endDate: trip.startDate,
            }),
            credentials: 'include'
          });
          
          if (!updateTripResponse.ok) {
            console.warn("Failed to update trip end date, but destination was deleted successfully");
          }
        }
      } else {
        // Get the latest end date from the remaining destinations
        const latestEndDate = new Date(
          Math.max(...remainingDestinations.map((d: Destination) => new Date(d.endDate).getTime()))
        );
        
        // Only update if the deleted destination was the one with the latest end date
        if (trip && destinationToDelete && new Date(destinationToDelete.endDate) > new Date(trip.endDate) 
            || new Date(destinationToDelete.endDate).getTime() === latestEndDate.getTime()) {
          const updateTripResponse = await fetch(`/api/trips/${tripId}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              endDate: latestEndDate.toISOString().split('T')[0],
            }),
            credentials: 'include'
          });
          
          if (!updateTripResponse.ok) {
            console.warn("Failed to update trip end date, but destination was deleted successfully");
          }
        }
      }

      return { success: true };
    },
    onSuccess: () => {
      toast({
        title: "Destination deleted",
        description: "The destination has been removed from your trip.",
      });
      setDestinationToDelete(null);
      
      // Invalidate all relevant queries to update the UI in real-time
      queryClient.invalidateQueries({ queryKey: ["trip-destinations", tripId] });
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/destinations`] });
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId] });
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setDestinationToDelete(null);
    },
  });

  const editDestinationMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!selectedDestination) return null;

      // First, update the destination
      const response = await fetch(`/api/trips/${tripId}/destinations/${selectedDestination.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          coordinates: selectedCoordinates,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update destination");
      }

      const updatedDestination = await response.json();
      
      // Now update the trip end date if this updated destination's end date is later than the current trip end date
      if (trip && new Date(data.endDate) > new Date(trip.endDate)) {
        const updateTripResponse = await fetch(`/api/trips/${tripId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            endDate: data.endDate,
          }),
          credentials: 'include'
        });
        
        if (!updateTripResponse.ok) {
          console.warn("Failed to update trip end date, but destination was updated successfully");
        }
      }

      return updatedDestination;
    },
    onSuccess: () => {
      toast({
        title: "Destination updated",
        description: "The destination has been updated.",
      });
      setIsEditDestinationOpen(false);
      
      // Invalidate all relevant queries to update the UI in real-time
      queryClient.invalidateQueries({ queryKey: ["trip-destinations", tripId] });
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/destinations`] });
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId] });
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getDefaultDates = () => {
    // If there are destinations, set the start date to the day after the last destination's end date
    if (sortedDestinations.length > 0) {
      const lastDestination = sortedDestinations[sortedDestinations.length - 1];
      const lastEndDate = new Date(lastDestination.endDate);
      
      // Add one day to the last end date
      const nextDay = new Date(lastEndDate);
      nextDay.setDate(nextDay.getDate() + 1);
      
      // Set the default end date to be 3 days after the start date
      const defaultEndDate = new Date(nextDay);
      defaultEndDate.setDate(defaultEndDate.getDate() + 3);
      
      return {
        startDate: nextDay.toISOString().split('T')[0],
        endDate: defaultEndDate.toISOString().split('T')[0]
      };
    } 
    // If there are no destinations but we have the trip, set the start date to the day after the trip end date
    else if (trip) {
      const tripEndDate = new Date(trip.endDate);
      
      // Add one day to the trip end date
      const nextDay = new Date(tripEndDate);
      nextDay.setDate(nextDay.getDate() + 1);
      
      // Set the default end date to be 3 days after the start date
      const defaultEndDate = new Date(nextDay);
      defaultEndDate.setDate(defaultEndDate.getDate() + 3);
      
      return {
        startDate: nextDay.toISOString().split('T')[0],
        endDate: defaultEndDate.toISOString().split('T')[0]
      };
    } 
    // Fallback to today and today + 3 days if neither destinations nor trip data is available
    else {
      const today = new Date();
      const threeDaysLater = new Date(today);
      threeDaysLater.setDate(threeDaysLater.getDate() + 3);
      
      return {
        startDate: today.toISOString().split('T')[0],
        endDate: threeDaysLater.toISOString().split('T')[0]
      };
    }
  };

  const onSubmit = (data: FormData) => {
    addDestinationMutation.mutate(data);
  };

  const onEdit = (destination: Destination) => {
    setSelectedDestination(destination);
    editForm.reset({
      name: destination.name,
      startDate: new Date(destination.startDate).toISOString().split('T')[0],
      endDate: new Date(destination.endDate).toISOString().split('T')[0],
    });
    setSelectedCoordinates(destination.coordinates);
    setIsEditDestinationOpen(true);
  };

  const onEditSubmit = (data: FormData) => {
    editDestinationMutation.mutate(data);
  };

  useEffect(() => {
    if (isAddDestinationOpen && (sortedDestinations?.length > 0 || trip)) {
      const defaultDates = getDefaultDates();
      form.setValue("startDate", defaultDates.startDate);
      form.setValue("endDate", defaultDates.endDate);
    }
  }, [isAddDestinationOpen, sortedDestinations, trip, form]);

  const handleScroll = (e: React.WheelEvent<HTMLDivElement>) => {
    e.stopPropagation();
  };

  return (
    <div className="relative z-[2000]">
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-[250px]">
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

          <CollapsibleContent className="overflow-visible">
            <CardContent className="p-2 pt-0 flex flex-col gap-2 relative">
              <div className="border rounded-md overflow-hidden">
                <ScrollArea className="h-[180px] max-h-[40vh]">
                  <div className="p-2 space-y-2">
                    {trip && (
                      <div className="flex items-center justify-between py-1 px-2 rounded-md bg-muted/50 text-sm hover:bg-muted/70 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate text-xs">
                            {trip.location || 'Starting Point'}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {format(new Date(trip.startDate), "MMM d")} -{" "}
                            {format(new Date(sortedDestinations[0]?.startDate || trip.endDate), "MMM d")}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-[10px] h-4 px-1">
                          1
                        </Badge>
                      </div>
                    )}
                    {sortedDestinations.map((destination, index) => (
                      <div
                        key={destination.id}
                        className="flex items-center justify-between py-1 px-2 rounded-md bg-muted/50 text-sm hover:bg-muted/70 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate text-xs">
                            {destination.name}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {format(new Date(destination.startDate), "MMM d")} -{" "}
                            {format(new Date(destination.endDate), "MMM d")}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEdit(destination);
                            }}
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDestinationToDelete(destination);
                            }}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                          <Badge variant="outline" className="text-[10px] h-4 px-1">
                            {index + 2}
                          </Badge>
                        </div>
                      </div>
                    ))}
                    
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsAddDestinationOpen(true);
                      }}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Stop
                    </Button>
                  </div>
                </ScrollArea>
              </div>

              {/* Add Destination Dialog */}
              <Dialog
                open={isAddDestinationOpen}
                onOpenChange={(open) => {
                  if (open) {
                    const defaultDates = getDefaultDates();
                    
                    form.reset({
                      name: "",
                      startDate: defaultDates.startDate,
                      endDate: defaultDates.endDate,
                    });
                  }
                  
                  setIsAddDestinationOpen(open);
                }}
              >
                <DialogContent 
                  className="fixed top-[50%] left-[50%] transform -translate-x-[50%] -translate-y-[50%] w-[90vw] max-w-[425px] max-h-[90vh] overflow-y-auto z-[100]"
                >
                  <DialogHeader>
                    <DialogTitle>Add New Destination</DialogTitle>
                  </DialogHeader>
                  
                  <div className="mb-4 p-3 text-sm rounded-md bg-muted">
                    {sortedDestinations.length > 0 ? (
                      <div>
                        <p>Your previous destination was <span className="font-semibold">{sortedDestinations[sortedDestinations.length - 1].name}</span></p>
                        <p className="mt-1 text-xs text-muted-foreground">Ends on {format(new Date(sortedDestinations[sortedDestinations.length - 1].endDate), "MMM d, yyyy")}</p>
                        <p className="mt-1">Your new destination will start on the following day</p>
                      </div>
                    ) : trip ? (
                      <div>
                        <p>Your trip is at <span className="font-semibold">{trip.location || 'Starting Point'}</span></p>
                        <p className="mt-1 text-xs text-muted-foreground">Trip ends on {format(new Date(trip.endDate), "MMM d, yyyy")}</p>
                        <p className="mt-1">Your new destination will start the day after this end date</p>
                      </div>
                    ) : (
                      <p>Please select dates for your new destination</p>
                    )}
                  </div>
                  
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Location</FormLabel>
                            <FormControl>
                              <MapPicker
                                value={field.value}
                                onChange={(address, coordinates) => {
                                  field.onChange(address);
                                  setSelectedCoordinates(coordinates);
                                }}
                                placeholder="Search for a location..."
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="startDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Start Date</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} />
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
                                <Input type="date" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={addDestinationMutation.isPending}
                      >
                        {addDestinationMutation.isPending ? "Adding..." : "Add Destination"}
                      </Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>

              {/* Edit Destination Dialog */}
              <Dialog
                open={isEditDestinationOpen}
                onOpenChange={setIsEditDestinationOpen}
              >
                <DialogContent 
                  className="fixed top-[50%] left-[50%] transform -translate-x-[50%] -translate-y-[50%] w-[90vw] max-w-[425px] max-h-[90vh] overflow-y-auto z-[100]"
                >
                  <DialogHeader>
                    <DialogTitle>Edit Destination</DialogTitle>
                  </DialogHeader>
                  <Form {...editForm}>
                    <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
                      <FormField
                        control={editForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Location</FormLabel>
                            <FormControl>
                              <MapPicker
                                value={field.value}
                                onChange={(address, coordinates) => {
                                  field.onChange(address);
                                  setSelectedCoordinates(coordinates);
                                }}
                                placeholder="Search for a location..."
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={editForm.control}
                          name="startDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Start Date</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={editForm.control}
                          name="endDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>End Date</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={editDestinationMutation.isPending}
                      >
                        {editDestinationMutation.isPending ? "Updating..." : "Update Destination"}
                      </Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>

              {/* Delete Destination Confirmation Dialog */}
              <AlertDialog
                open={!!destinationToDelete}
                onOpenChange={(open) => {
                  if (!open) setDestinationToDelete(null);
                }}
              >
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Destination</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to remove "{destinationToDelete?.name}" from your trip? 
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        deleteDestinationMutation.mutate();
                      }}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}