import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { Clock, MapPin, Edit, Trash2, X } from "lucide-react";
import type { Trip, Activity } from "@db/schema";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

interface CalendarSummaryProps {
  trip: Trip;
  activities: Activity[];
}

interface EditActivityForm {
  title: string;
  description?: string;
  location?: string;
  startTime: string;
  endTime: string;
}

export function CalendarSummary({ trip, activities }: CalendarSummaryProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activityToEdit, setActivityToEdit] = useState<Activity | null>(null);
  const [activityToDelete, setActivityToDelete] = useState<Activity | null>(null);

  // Setup form for editing activities
  const form = useForm<EditActivityForm>({
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
    }
  };

  // Update activity mutation
  const updateActivityMutation = useMutation({
    mutationFn: async (data: EditActivityForm) => {
      if (!activityToEdit) return null;
      
      const response = await fetch(`/api/trips/${trip.id}/activities/${activityToEdit.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: data.title,
          description: data.description,
          location: data.location,
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
      queryClient.invalidateQueries({ queryKey: ["/api/trips", trip.id, "activities"] });
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

  // Delete activity mutation
  const deleteActivityMutation = useMutation({
    mutationFn: async () => {
      if (!activityToDelete) return null;
      
      const response = await fetch(`/api/trips/${trip.id}/activities/${activityToDelete.id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete activity');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", trip.id, "activities"] });
      setActivityToDelete(null);
      toast({
        title: "Activity deleted",
        description: "The activity has been deleted successfully."
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete activity",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Handle form submission
  const onSubmit = (data: EditActivityForm) => {
    updateActivityMutation.mutate(data);
  };

  // Handle delete confirmation
  const handleDelete = () => {
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
          {sortedDates.map((date) => (
            <div key={date} className="space-y-4">
              <h3 className="text-lg font-semibold sticky top-0 bg-background py-2">
                {format(new Date(date), 'EEEE, MMMM d, yyyy')}
              </h3>
              <div className="space-y-4">
                {groupedActivities[date]
                  .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                  .map((activity) => (
                    <Card key={activity.id} className="p-4">
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
                            onClick={() => {
                              setActivityToEdit(activity);
                              // Set timeout to ensure dialog is open before setting form values
                              setTimeout(resetForm, 0);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                            <span className="sr-only">Edit</span>
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => setActivityToDelete(activity)}
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
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
