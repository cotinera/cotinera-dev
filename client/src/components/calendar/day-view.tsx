import {
  useState,
  useRef,
  useEffect,
} from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { format, addHours, addDays, differenceInDays, parseISO } from "date-fns";
import {
  DndContext,
  DragEndEvent,
  useSensor,
  useSensors,
  PointerSensor,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import type { Trip, Activity } from "@db/schema";
import { Pencil, Trash2, Loader2 } from "lucide-react";
import { CSS } from "@dnd-kit/utilities";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface DayViewProps {
  trip: Trip;
}

interface TimeSlot {
  date: Date;
  hour: number;
}

function DraggableEvent({
  event,
  onEdit,
  onDelete,
}: {
  event: Activity;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: event.id.toString(),
  });

  const style = {
    transform: CSS.Transform.toString(transform),
  };

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={style}
      className="absolute inset-x-0 mx-2 bg-primary/20 hover:bg-primary/30 rounded-md p-2 cursor-move group/event"
    >
      <div className="flex items-center justify-between">
        <span className="font-medium">{event.title}</span>
        <div className="hidden group-hover/event:flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <span className="text-xs text-muted-foreground">
        {format(parseISO(event.startTime.toString()), "h:mm a")} -{" "}
        {format(parseISO(event.endTime.toString()), "h:mm a")}
      </span>
    </div>
  );
}

function DroppableTimeSlot({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const { setNodeRef } = useDroppable({
    id,
  });

  return (
    <div ref={setNodeRef} className="min-h-[3rem] relative">
      {children}
    </div>
  );
}

export function DayView({ trip }: DayViewProps) {
  const [newEventTitle, setNewEventTitle] = useState("");
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Activity | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const tripStartDate = new Date(trip.startDate);
  const tripEndDate = new Date(trip.endDate);
  const numberOfDays = differenceInDays(tripEndDate, tripStartDate) + 1;

  // Generate all dates for the trip duration
  const dates = Array.from({ length: numberOfDays }, (_, i) =>
    addDays(tripStartDate, i)
  );

  // Generate hours for the day
  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Fetch activities
  const { data: activities = [], isLoading } = useQuery<Activity[]>({
    queryKey: ["/api/trips", trip.id, "activities"],
    queryFn: async () => {
      try {
        const res = await fetch(`/api/trips/${trip.id}/activities`);
        if (!res.ok) throw new Error("Failed to fetch activities");
        const data = await res.json();
        return data;
      } catch (error) {
        console.error("Error fetching activities:", error);
        throw error;
      }
    },
  });

  // Create activity mutation
  const createActivityMutation = useMutation({
    mutationFn: async (data: { title: string; startTime: string; endTime: string }) => {
      try {
        const res = await fetch(`/api/trips/${trip.id}/activities`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tripId: trip.id,
            ...data
          }),
        });
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`Failed to create activity: ${errorText}`);
        }
        return res.json();
      } catch (error) {
        console.error("Error creating activity:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", trip.id, "activities"] });
      toast({ title: "Event created successfully" });
      setIsCreateDialogOpen(false);
      setNewEventTitle("");
    },
    onError: (error: Error) => {
      console.error("Create activity error:", error);
      toast({
        variant: "destructive",
        title: "Failed to create event",
        description: error.message,
      });
    },
  });

  // Update activity mutation
  const updateActivityMutation = useMutation({
    mutationFn: async (data: Activity) => {
      try {
        const res = await fetch(`/api/trips/${trip.id}/activities/${data.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error("Failed to update activity");
        return res.json();
      } catch (error) {
        console.error("Error updating activity:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", trip.id, "activities"] });
      toast({ title: "Event updated successfully" });
      setIsEditDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to update event",
        description: error.message,
      });
    },
  });

  // Delete activity mutation
  const deleteActivityMutation = useMutation({
    mutationFn: async (activityId: number) => {
      try {
        const res = await fetch(
          `/api/trips/${trip.id}/activities/${activityId}`,
          {
            method: "DELETE",
          }
        );
        if (!res.ok) throw new Error("Failed to delete activity");
        return res.json();
      } catch (error) {
        console.error("Error deleting activity:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", trip.id, "activities"] });
      toast({ title: "Event deleted successfully" });
      setIsEditDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to delete event",
        description: error.message,
      });
    },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) return;

    const eventId = parseInt(active.id as string);
    const [dateStr, hourStr] = (over.id as string).split("|");
    const newHour = parseInt(hourStr);
    const newDate = new Date(dateStr);

    const activityToUpdate = activities.find((a) => a.id === eventId);
    if (!activityToUpdate) return;

    const startDate = parseISO(activityToUpdate.startTime.toString());
    const endDate = parseISO(activityToUpdate.endTime.toString());

    const hourDiff = newHour - startDate.getHours();
    const dateDiff = differenceInDays(newDate, startDate);

    const newStartTime = addHours(addDays(startDate, dateDiff), hourDiff);
    const newEndTime = addHours(addDays(endDate, dateDiff), hourDiff);

    updateActivityMutation.mutate({
      ...activityToUpdate,
      startTime: newStartTime.toISOString(),
      endTime: newEndTime.toISOString(),
    });
  };

  const createEvent = () => {
    if (!selectedTimeSlot || !newEventTitle) return;

    const startTime = new Date(selectedTimeSlot.date);
    startTime.setHours(selectedTimeSlot.hour, 0, 0, 0);

    const endTime = addHours(startTime, 1);

    createActivityMutation.mutate({
      title: newEventTitle,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
    });
  };

  const updateEvent = () => {
    if (!selectedEvent) return;
    updateActivityMutation.mutate(selectedEvent);
  };

  const deleteEvent = () => {
    if (!selectedEvent) return;
    deleteActivityMutation.mutate(selectedEvent.id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col border rounded-md">
      <div className="flex">
        {/* Empty space above time column to align with dates */}
        <div className="w-24 flex-none h-[60px]" />

        {/* Date headers */}
        <div className="flex flex-1">
          {dates.map((date) => (
            <div key={date.toISOString()} className="flex-none w-[300px] p-4 border-l first:border-l-0 font-semibold">
              {format(date, "EEEE, MMMM d")}
            </div>
          ))}
        </div>
      </div>

      <div className="flex">
        {/* Fixed time column */}
        <div className="w-24 flex-none">
          {hours.map((hour) => (
            <div key={hour} className="h-12 px-2 py-3 text-sm text-muted-foreground">
              {format(new Date().setHours(hour, 0), "h:mm a")}
            </div>
          ))}
        </div>

        {/* Scrollable days */}
        <ScrollArea className="w-full">
          <div className="flex min-w-full">
            {dates.map((date) => (
              <Card
                key={date.toISOString()}
                className="flex-none w-[300px] border-l first:border-l-0"
              >
                <DndContext
                  sensors={sensors}
                  modifiers={[restrictToVerticalAxis]}
                  onDragEnd={handleDragEnd}
                >
                  <div>
                    {hours.map((hour) => {
                      const timeSlotEvents = activities.filter((event) => {
                        const eventStart = parseISO(event.startTime.toString());
                        return (
                          eventStart.getHours() === hour &&
                          eventStart.toDateString() === date.toDateString()
                        );
                      });

                      const timeSlotId = `${date.toISOString()}|${hour}`;

                      return (
                        <div
                          key={timeSlotId}
                          className="min-h-[3rem] relative group hover:bg-accent/50 px-2 border-t first:border-t-0"
                        >
                          <DroppableTimeSlot id={timeSlotId}>
                            {timeSlotEvents.map((event) => (
                              <DraggableEvent
                                key={event.id}
                                event={event}
                                onEdit={() => {
                                  setSelectedEvent(event);
                                  setIsEditDialogOpen(true);
                                }}
                                onDelete={() => {
                                  setSelectedEvent(event);
                                  deleteEvent();
                                }}
                              />
                            ))}
                            {timeSlotEvents.length === 0 && (
                              <Dialog
                                open={
                                  isCreateDialogOpen &&
                                  selectedTimeSlot?.date.toDateString() ===
                                    date.toDateString() &&
                                  selectedTimeSlot?.hour === hour
                                }
                                onOpenChange={setIsCreateDialogOpen}
                              >
                                <DialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    className="w-full h-full opacity-0 group-hover:opacity-100"
                                    onClick={() => setSelectedTimeSlot({ date, hour })}
                                  >
                                    + Add Event
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Create New Event</DialogTitle>
                                  </DialogHeader>
                                  <div className="space-y-4 mt-4">
                                    <Input
                                      placeholder="Event title"
                                      value={newEventTitle}
                                      onChange={(e) => setNewEventTitle(e.target.value)}
                                    />
                                    <Button
                                      onClick={createEvent}
                                      className="w-full"
                                      disabled={createActivityMutation.isPending}
                                    >
                                      {createActivityMutation.isPending && (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      )}
                                      Create Event
                                    </Button>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            )}
                          </DroppableTimeSlot>
                        </div>
                      );
                    })}
                  </div>
                </DndContext>
              </Card>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* Edit Event Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Event</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <Input
              placeholder="Event title"
              value={selectedEvent?.title || ""}
              onChange={(e) =>
                setSelectedEvent(
                  selectedEvent
                    ? { ...selectedEvent, title: e.target.value }
                    : null
                )
              }
            />
            <div className="flex justify-between gap-4">
              <Button
                variant="destructive"
                onClick={deleteEvent}
                className="flex-1"
                disabled={deleteActivityMutation.isPending}
              >
                {deleteActivityMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Delete
              </Button>
              <Button
                onClick={updateEvent}
                className="flex-1"
                disabled={updateActivityMutation.isPending}
              >
                {updateActivityMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Update
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}