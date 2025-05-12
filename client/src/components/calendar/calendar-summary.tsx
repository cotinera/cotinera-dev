import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, addHours } from "date-fns";
import { Clock, MapPin, Edit, Trash2, X, Plus } from "lucide-react";
import type { Trip, Activity } from "@db/schema";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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

  // Reset form when selected activity changes
  const resetForm = () => {
    if (activityToEdit) {
      const startDate = new Date(activityToEdit.startTime);
      const endDate = new Date(activityToEdit.endTime);
      
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
          startTime: new Date(data.startTime).toISOString(),
          endTime: new Date(data.endTime).toISOString()
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Create activity error:', errorText);
        throw new Error(`Failed to create activity: ${errorText}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${trip.id}/activities`] });
      setIsCreateDialogOpen(false);
      toast({
        title: "Activity created",
        description: "The activity has been added to your calendar."
      });
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create activity",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Update activity mutation
  const updateActivityMutation = useMutation({
    mutationFn: async (data: ActivityFormValues) => {
      if (!activityToEdit) return null;
      
      const response = await fetch(`/api/trips/${trip.id}/activities/${activityToEdit.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          title: data.title,
          description: data.description || null,
          location: data.location || null,
          startTime: new Date(data.startTime).toISOString(),
          endTime: new Date(data.endTime).toISOString()
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update activity');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${trip.id}/activities`] });
      setActivityToEdit(null);
      toast({
        title: "Activity updated",
        description: "The activity has been updated successfully."
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update activity",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Delete activity mutation with proper optimistic updates
  const deleteActivityMutation = useMutation({
    mutationFn: async () => {
      if (!activityToDelete) return null;
      
      console.log(`Deleting activity: ${activityToDelete.id} from trip: ${trip.id}`);
      
      const response = await fetch(`/api/trips/${trip.id}/activities/${activityToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include' // Add credentials to ensure cookies are sent
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Delete activity error:', errorText);
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
      
      console.error('Delete activity mutation error:', error);
      toast({
        title: "Failed to delete activity",
        description: error.message,
        variant: "destructive"
      });
    },
    onSuccess: (data) => {
      console.log('Successfully deleted activity:', data);
      
      // Update the cache directly to ensure the deleted item is removed
      queryClient.setQueryData<Activity[]>(
        [`/api/trips/${trip.id}/activities`],
        (old) => {
          if (!old || !activityToDelete) return old;
          // Filter out the deleted activity
          return old.filter(activity => activity.id !== activityToDelete.id);
        }
      );
      
      // Clear the dialog state
      setActivityToDelete(null);
      
      toast({
        title: "Activity deleted",
        description: "The activity has been permanently deleted."
      });
    },
    onSettled: () => {
      // Always force refresh the data from the server
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${trip.id}/activities`] });
    }
  });

  // Handle create form submission
  const handleCreateSubmit = (data: ActivityFormValues) => {
    createActivityMutation.mutate(data);
  };

  // Handle edit form submission
  const handleEditSubmit = (data: ActivityFormValues) => {
    updateActivityMutation.mutate(data);
  };

  // Handle delete confirmation - now simplified since optimistic updates are handled in the mutation
  const handleDelete = () => {
    if (!activityToDelete) return;
    console.log('Confirming delete for activity:', activityToDelete);
    deleteActivityMutation.mutate();
  };
  
  // Open the create dialog with default times
  const openCreateDialog = () => {
    setActivityToEdit(null);
    resetForm();
    setIsCreateDialogOpen(true);
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
      <div className="flex justify-end mb-4">
        <Button onClick={openCreateDialog} className="gap-1">
          <Plus className="h-4 w-4" />
          Add Event
        </Button>
      </div>
      
      <ScrollArea className="h-[calc(100vh-16rem)]">
        <div className="space-y-8 p-4">
          {sortedDates.map((date) => (
            <div key={date} className="space-y-4">
              <h3 className="text-lg font-semibold sticky top-0 bg-background py-2">
                {format(new Date(date), 'EEEE, MMMM d, yyyy')}
              </h3>
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
                          {activity.description && (
                            <p className="text-sm text-muted-foreground mt-2">
                              {activity.description}
                            </p>
                          )}
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
          ))}
          {sortedDates.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              No activities scheduled yet
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Create Activity Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
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
                      <Input {...field} placeholder="Event title" required />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Location (optional)" />
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
                        <Input {...field} type="datetime-local" required />
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
                        <Input {...field} type="datetime-local" required />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field}
                        placeholder="Add a description (optional)"
                        className="min-h-[100px]"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={createActivityMutation.isPending}
                >
                  {createActivityMutation.isPending ? "Creating..." : "Create Event"}
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
            <DialogTitle>Edit Activity</DialogTitle>
            <DialogDescription>
              Update the details for this activity. Click save when you're done.
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
                      <Input {...field} placeholder="Activity title" required />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Location (optional)" />
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
                        <Input {...field} type="datetime-local" required />
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
                        <Input {...field} type="datetime-local" required />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field}
                        placeholder="Add a description (optional)"
                        className="min-h-[100px]"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActivityToEdit(null)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={updateActivityMutation.isPending}
                >
                  {updateActivityMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Activity Confirmation */}
      <AlertDialog open={!!activityToDelete} onOpenChange={(open) => !open && setActivityToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Activity</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this activity? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteActivityMutation.isPending}
            >
              {deleteActivityMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
