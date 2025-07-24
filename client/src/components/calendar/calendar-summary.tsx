import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, addHours } from "date-fns";
import { Clock, MapPin, Edit, Trash2, X, Plus } from "lucide-react";
import type { Trip, Activity } from "@db/schema";
import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { MapPicker } from "@/components/map-picker";

interface CalendarSummaryProps {
  trip: Trip;
  activities: Activity[];
}

// Define the form schema for both editing and creating activities
const activityFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  location: z.string().optional(),
  startTime: z.string(),
  endTime: z.string(),
});

type ActivityFormValues = z.infer<typeof activityFormSchema>;

export function CalendarSummary({ trip, activities }: CalendarSummaryProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activityToEdit, setActivityToEdit] = useState<Activity | null>(null);
  const [activityToDelete, setActivityToDelete] = useState<Activity | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedCoordinates, setSelectedCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  
  // Extract trip coordinates from the trip's location or coordinates
  const tripCoordinates = trip.coordinates || null;
  
  // Get pinned places for this trip to show on the map
  const { data: pinnedPlacesData } = useQuery({
    queryKey: [`/api/trips/${trip.id}/pinned-places`],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${trip.id}/pinned-places`);
      if (!res.ok) throw new Error("Failed to fetch pinned places");
      return res.json();
    },
    enabled: !!trip.id,
  });
  
  // Extract the pinned places for use in the map
  const pinnedPlaces = pinnedPlacesData?.places || [];

  // Setup form for editing activities
  const form = useForm<ActivityFormValues>({
    resolver: zodResolver(activityFormSchema),
    defaultValues: {
      title: "",
      description: "",
      location: "",
      startTime: "",
      endTime: ""
    }
  });
  
  // Helper functions for coordinates
  const logCoordinates = () => {
    console.log("No location coordinates available");
    console.log("Effective location being used:", selectedCoordinates);
    console.log("Trip coordinates:", tripCoordinates);
    console.log("Selected coordinates:", selectedCoordinates);
  };
  
  useEffect(() => {
    // When dialog opens, log coordinates info for debugging
    if (isCreateDialogOpen) {
      logCoordinates();
    }
  }, [isCreateDialogOpen]);

  const openCreateDialog = () => {
    setIsCreateDialogOpen(true);
    // Initialize selectedCoordinates with trip coordinates when creating a new event
    if (tripCoordinates) {
      setSelectedCoordinates(tripCoordinates);
    }
    resetForm();
  };

  const resetForm = () => {
    if (activityToEdit) {
      // Use activity data for editing
      const startDate = new Date(activityToEdit.startTime);
      const endDate = new Date(activityToEdit.endTime);
      
      // If editing, use the activity's coordinates if available
      if (activityToEdit.coordinates) {
        setSelectedCoordinates(activityToEdit.coordinates);
      }
      
      form.reset({
        title: activityToEdit.title,
        description: activityToEdit.description || "",
        location: activityToEdit.location || "",
        startTime: format(startDate, "yyyy-MM-dd'T'HH:mm"),
        endTime: format(endDate, "yyyy-MM-dd'T'HH:mm")
      });
    } else {
      // Reset with default times for new activity (today at noon for 1 hour)
      const now = new Date();
      const startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0);
      const endTime = addHours(startTime, 1);
      
      // For new activities, use trip coordinates if available
      if (tripCoordinates && !selectedCoordinates) {
        setSelectedCoordinates(tripCoordinates);
      }
      
      form.reset({
        title: "",
        description: "",
        location: "",
        startTime: format(startTime, "yyyy-MM-dd'T'HH:mm"),
        endTime: format(endTime, "yyyy-MM-dd'T'HH:mm")
      });
    }
  };

  // Create activity mutation
  const createActivityMutation = useMutation({
    mutationFn: async (data: ActivityFormValues) => {
      const response = await fetch(`/api/trips/${trip.id}/activities`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          title: data.title,
          description: data.description || null,
          location: data.location || null,
          coordinates: selectedCoordinates,
          startTime: new Date(data.startTime).toISOString(),
          endTime: new Date(data.endTime).toISOString()
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create activity: ${errorText}`);
      }
      
      return response.json();
    },
    onSuccess: (newActivity) => {
      setIsCreateDialogOpen(false);
      setSelectedCoordinates(null);
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${trip.id}/activities`] });
      toast({
        title: "Success",
        description: "Activity created successfully."
      });
      
      // Sync to Google Calendar if enabled
      const googleCalendarSync = (window as any)[`googleCalendarSync_${trip.id}`];
      if (googleCalendarSync && newActivity) {
        googleCalendarSync(newActivity);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Update activity mutation
  const updateActivityMutation = useMutation({
    mutationFn: async (data: ActivityFormValues & { id: number }) => {
      const response = await fetch(`/api/trips/${trip.id}/activities/${data.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          title: data.title,
          description: data.description || null,
          location: data.location || null,
          coordinates: selectedCoordinates,
          startTime: new Date(data.startTime).toISOString(),
          endTime: new Date(data.endTime).toISOString()
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update activity: ${errorText}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      setActivityToEdit(null);
      setSelectedCoordinates(null);
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${trip.id}/activities`] });
      toast({
        title: "Success",
        description: "Activity updated successfully."
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Delete activity mutation
  const deleteActivityMutation = useMutation({
    mutationFn: async () => {
      if (!activityToDelete) throw new Error("No activity to delete");
      
      const response = await fetch(`/api/trips/${trip.id}/activities/${activityToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to delete activity: ${errorText}`);
      }
      
      // Some DELETE endpoints may not return JSON
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        return response.json();
      }
      
      return { success: true, deletedId: activityToDelete.id };
    },
    onMutate: async () => {
      if (!activityToDelete) return { previousActivities: null };
      
      // This function runs before the mutation is executed
      // Cancel any outgoing refetches to avoid overwriting our optimistic update
      await queryClient.cancelQueries({ queryKey: [`/api/trips/${trip.id}/activities`] });

      // Snapshot the previous value
      const previousActivities = queryClient.getQueryData<Activity[]>([`/api/trips/${trip.id}/activities`]);

      // Optimistically update to the new value
      if (previousActivities) {
        const filteredActivities = previousActivities.filter(
          activity => activity.id !== activityToDelete.id
        );
        
        console.log('Optimistically updating with filtered activities:', filteredActivities);
        
        queryClient.setQueryData(
          [`/api/trips/${trip.id}/activities`],
          filteredActivities
        );
      }

      // Return a context with the previous value
      return { previousActivities };
    },
    onError: (error, variables, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousActivities) {
        queryClient.setQueryData(
          [`/api/trips/${trip.id}/activities`], 
          context.previousActivities
        );
      }
      
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    },
    onSuccess: () => {
      setActivityToDelete(null);
      toast({
        title: "Success",
        description: "Activity deleted successfully."
      });
    },
    onSettled: () => {
      // Always refetch after error or success to make sure our local data is in sync with the server
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${trip.id}/activities`] });
    }
  });

  const handleCreateSubmit = (data: ActivityFormValues) => {
    createActivityMutation.mutate(data);
  };

  const handleEditSubmit = (data: ActivityFormValues) => {
    if (!activityToEdit) return;
    updateActivityMutation.mutate({ ...data, id: activityToEdit.id });
  };

  const handleDeleteConfirm = () => {
    deleteActivityMutation.mutate();
  };

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
    <>
      <ScrollArea className="h-[calc(100vh-16rem)]">
        <div className="space-y-8 p-4">
          {sortedDates.length > 0 ? (
            sortedDates.map((date, index) => (
              <div key={date} className="space-y-4">
                <div className="flex justify-between items-center sticky top-0 bg-background py-2">
                  <h3 className="text-lg font-semibold">
                    {format(new Date(date), 'EEEE, MMMM d, yyyy')}
                  </h3>
                  {index === 0 && (
                    <Button 
                      onClick={openCreateDialog} 
                      variant="outline" 
                      size="sm" 
                      className="text-muted-foreground gap-1 bg-transparent hover:bg-accent/10"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Event
                    </Button>
                  )}
                </div>
                <div className="space-y-4">
                  {groupedActivities[date]
                    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                    .map((activity) => (
                      <Card 
                        key={activity.id} 
                        className="p-4 cursor-pointer hover:bg-accent/10 transition-colors"
                        onClick={() => {
                          setActivityToEdit(activity);
                          setTimeout(resetForm, 0);
                        }}
                      >
                        <div className="flex justify-between">
                          <div className="space-y-2 flex-1">
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
                          </div>
                          
                          <div className="flex space-x-2 items-start">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation(); // Prevent triggering the card's click event
                                setActivityToEdit(activity);
                                setTimeout(resetForm, 0);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                              <span className="sr-only">Edit</span>
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation(); // Prevent triggering the card's click event
                                setActivityToDelete(activity);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                              <span className="sr-only">Delete</span>
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-muted-foreground py-8">
              No activities scheduled yet
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Create Activity Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-h-[70vh] overflow-y-auto rounded-xl sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Add New Event</DialogTitle>
            <DialogDescription>
              Create a new event for your trip. Click save when you're done.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCreateSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Event title" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Time</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="endTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Time</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <div className="h-[400px]">
                        <MapPicker
                          value={field.value}
                          onChange={(address, coordinates) => {
                            field.onChange(address);
                            setSelectedCoordinates(coordinates);
                          }}
                          placeholder="Search for a location or click on the map"
                          initialCenter={selectedCoordinates || tripCoordinates}
                          existingPins={pinnedPlaces}
                          searchBias={tripCoordinates}
                        />
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Event description (optional)" 
                        className="min-h-[100px]"
                        {...field} 
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button type="submit" disabled={createActivityMutation.isPending}>
                  {createActivityMutation.isPending ? 'Creating...' : 'Create Event'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Edit Activity Dialog */}
      <Dialog open={!!activityToEdit} onOpenChange={(open) => !open && setActivityToEdit(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Event</DialogTitle>
            <DialogDescription>
              Make changes to this event. Click save when you're done.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleEditSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Event title" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Time</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="endTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Time</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <div className="h-[400px]">
                        <MapPicker
                          value={field.value}
                          onChange={(address, coordinates) => {
                            field.onChange(address);
                            setSelectedCoordinates(coordinates);
                          }}
                          placeholder="Search for a location or click on the map"
                          initialCenter={selectedCoordinates || tripCoordinates}
                          existingPins={pinnedPlaces}
                          searchBias={tripCoordinates}
                        />
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Event description (optional)" 
                        className="min-h-[100px]"
                        {...field} 
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button 
                  variant="outline"
                  type="button"
                  onClick={() => setActivityToEdit(null)}
                  className="mr-2"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateActivityMutation.isPending}>
                  {updateActivityMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!activityToDelete} onOpenChange={(open) => !open && setActivityToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the event "{activityToDelete?.title}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setActivityToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
              disabled={deleteActivityMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteActivityMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}