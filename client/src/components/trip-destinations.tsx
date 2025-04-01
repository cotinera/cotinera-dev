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
import { Pin, Plus, ChevronDown, Edit2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  const [isAddDestinationOpen, setIsAddDestinationOpen] = useState(false);
  const [isEditDestinationOpen, setIsEditDestinationOpen] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCoordinates, setSelectedCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [editingDestination, setEditingDestination] = useState<Destination | null>(null);

  const { data: destinations = [], refetch } = useQuery<Destination[]>({
    queryKey: [`/api/trips/${tripId}/destinations`],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripId}/destinations`);
      if (!res.ok) throw new Error("Failed to fetch destinations");
      return res.json();
    },
  });

  const { data: trip } = useQuery<Trip>({
    queryKey: ["/api/trips", tripId],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripId}`);
      if (!res.ok) throw new Error("Failed to fetch trip");
      return res.json();
    },
  });

  const form = useForm<FormData>({
    resolver: zodResolver(destinationSchema),
    defaultValues: {
      name: "",
      startDate: "",
      endDate: "",
    },
  });
  
  // Pre-calculate default dates based on current state with better chaining logic
  const getDefaultDates = () => {
    let previousEndDate;
    let sourceName = '';
    
    if (sortedDestinations.length > 0) {
      // Use the most recent destination's end date
      const lastDestination = sortedDestinations[sortedDestinations.length - 1];
      previousEndDate = new Date(lastDestination.endDate);
      sourceName = lastDestination.name;
    } else if (trip) {
      // No destinations yet, use the trip start date (not end date)
      // This is more logical for the first destination in a trip
      previousEndDate = new Date(trip.startDate);
      sourceName = trip.location || 'Starting Point';
    } else {
      // Fallback to today
      previousEndDate = new Date();
    }
    
    // Ensure we're starting from the next day after the previous end date
    // This creates a continuous timeline without gaps or overlaps
    const nextDay = new Date(previousEndDate);
    nextDay.setDate(nextDay.getDate() + 1); // Start the day after previous end
    
    const defaultStartDate = format(nextDay, "yyyy-MM-dd");
    
    // End date is a week after start date by default
    const defaultEndDate = new Date(nextDay);
    defaultEndDate.setDate(defaultEndDate.getDate() + 7);
    
    return {
      startDate: defaultStartDate,
      endDate: format(defaultEndDate, "yyyy-MM-dd"),
      sourceDate: format(previousEndDate, "yyyy-MM-dd"),
      sourceName
    };
  };

  const editForm = useForm<FormData & { id: number }>({
    resolver: zodResolver(destinationSchema),
    defaultValues: {
      id: 0,
      name: "",
      startDate: "",
      endDate: "",
    },
  });

  const addDestinationMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!selectedCoordinates) {
        throw new Error("Please select a location from the map");
      }

      const res = await fetch(`/api/trips/${tripId}/destinations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          coordinates: selectedCoordinates
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to add destination");
      }

      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/destinations`] });
      await refetch();
      setIsAddDestinationOpen(false);
      form.reset();
      setSelectedCoordinates(null);
      toast({
        title: "Success",
        description: "Destination added successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to add destination",
      });
    },
  });

  const editDestinationMutation = useMutation({
    mutationFn: async (data: FormData & { id: number }) => {
      const res = await fetch(`/api/trips/${tripId}/destinations/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          startDate: data.startDate,
          endDate: data.endDate,
          coordinates: selectedCoordinates || undefined,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to update destination");
      }

      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/destinations`] });
      await refetch();
      setIsEditDestinationOpen(false);
      editForm.reset();
      setSelectedCoordinates(null);
      setEditingDestination(null);
      toast({
        title: "Success",
        description: "Destination updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update destination",
      });
    },
  });

  const onEdit = (destination: Destination) => {
    setEditingDestination(destination);
    setSelectedCoordinates(destination.coordinates);
    editForm.reset({
      id: destination.id,
      name: destination.name,
      startDate: format(new Date(destination.startDate), "yyyy-MM-dd"),
      endDate: format(new Date(destination.endDate), "yyyy-MM-dd"),
    });
    setIsEditDestinationOpen(true);
  };

  const onSubmit = (data: FormData) => {
    addDestinationMutation.mutate(data);
  };

  const onEditSubmit = (data: FormData & { id: number }) => {
    editDestinationMutation.mutate(data);
  };

  const sortedDestinations = destinations?.sort((a, b) => a.order - b.order) || [];
  const totalStops = (sortedDestinations.length || 0) + 1;
  
  // Reset form with default dates whenever relevant data changes or when dialog opens
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
    <div className="relative z-10">
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

          <CollapsibleContent className="overflow-visible">
            <CardContent className="p-2 pt-0 flex flex-col gap-2">
              <div className="border rounded-md overflow-hidden">
                <ScrollArea className="h-[200px]">
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
                <DialogContent className="fixed top-[50%] left-[50%] transform -translate-x-[50%] -translate-y-[50%] w-[90vw] max-w-[425px] max-h-[90vh] overflow-y-auto z-50">
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
                        <p>Your trip starts at <span className="font-semibold">{trip.location || 'Starting Point'}</span></p>
                        <p className="mt-1 text-xs text-muted-foreground">Trip begins on {format(new Date(trip.startDate), "MMM d, yyyy")}</p>
                        <p className="mt-1">Your new destination will be automatically scheduled to start after this date</p>
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

              <Dialog
                open={isEditDestinationOpen}
                onOpenChange={setIsEditDestinationOpen}
              >
                <DialogContent className="fixed top-[50%] left-[50%] transform -translate-x-[50%] -translate-y-[50%] w-[90vw] max-w-[425px] max-h-[90vh] overflow-y-auto z-50">
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
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}