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
import {
  format,
  addHours,
  addDays,
  differenceInDays,
  startOfDay,
  endOfDay,
} from "date-fns";
import {
  DndContext,
  DragEndEvent,
  useSensor,
  useSensors,
  PointerSensor,
  useDraggable,
  useDroppable,
  DragStartEvent,
  DragOverEvent,
} from "@dnd-kit/core";
import type { Trip, Activity } from "@db/schema";
import { Pencil, Trash2, Loader2, Plus } from "lucide-react";
import { CSS } from "@dnd-kit/utilities";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface TimeSlot {
  date: Date;
  hour: number;
}

function DraggableEvent({ event, onEdit, onDelete }: {
  event: Activity;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: event.id.toString(),
  });

  const style = {
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    width: '280px',
    height: '3rem',
    position: 'absolute',
    left: '8px',
    top: '0',
    backgroundColor: isDragging ? 'hsl(var(--primary)/0.2)' : undefined,
    boxShadow: isDragging ? 'var(--shadow-md)' : undefined,
    opacity: isDragging ? 0.9 : 1,
    zIndex: isDragging ? 50 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={style}
      className={`bg-primary/20 hover:bg-primary/30 rounded-md px-2 py-1 cursor-move group/event transition-colors ${
        isDragging ? 'ring-1 ring-primary/50' : ''
      }`}
    >
      <div className="flex items-center justify-between h-[18px]">
        <span className="font-medium text-sm truncate max-w-[180px]">{event.title}</span>
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
      <span className="text-xs text-muted-foreground block">
        {format(new Date(event.startTime), "h:mm a")} -{" "}
        {format(new Date(event.endTime), "h:mm a")}
      </span>
    </div>
  );
}

function DroppableTimeSlot({
  id,
  isOver,
  children,
}: {
  id: string;
  isOver: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef } = useDroppable({
    id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`h-12 relative border-t ${
        isOver ? 'bg-primary/10' : ''
      }`}
    >
      {children}
    </div>
  );
}

export function DayView({ trip }: { trip: Trip }) {
  const [newEventTitle, setNewEventTitle] = useState("");
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Activity | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [activeDropId, setActiveDropId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 4,
      },
    })
  );

  const tripStartDate = new Date(trip.startDate);
  const tripEndDate = new Date(trip.endDate);
  const numberOfDays = differenceInDays(tripEndDate, tripStartDate) + 1;
  const dates = Array.from({ length: numberOfDays }, (_, i) => addDays(tripStartDate, i));
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const { data: activities = [], isLoading } = useQuery<Activity[]>({
    queryKey: ["/api/trips", trip.id, "activities"],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${trip.id}/activities`);
      if (!res.ok) throw new Error("Failed to fetch activities");
      return res.json();
    },
  });

  useEffect(() => {
    if (isCreateDialogOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCreateDialogOpen]);

  const handleDragStart = () => {
    document.body.classList.add('select-none');
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    document.body.classList.remove('select-none');
    setActiveDropId(null);

    if (!over) return;

    const eventId = parseInt(active.id as string);
    const [dateStr, hourStr] = (over.id as string).split("|");
    const newDate = new Date(dateStr);
    const newHour = parseInt(hourStr);

    const activityToUpdate = activities.find((a) => a.id === eventId);
    if (!activityToUpdate) return;

    const startDate = new Date(activityToUpdate.startTime);
    const endDate = new Date(activityToUpdate.endTime);
    const durationMs = endDate.getTime() - startDate.getTime();

    const newStartTime = new Date(newDate);
    newStartTime.setHours(newHour, startDate.getMinutes(), 0, 0);
    const newEndTime = new Date(newStartTime.getTime() + durationMs);

    // Validate that the new times are within trip dates
    const tripStart = startOfDay(new Date(trip.startDate));
    const tripEnd = endOfDay(new Date(trip.endDate));

    if (newStartTime < tripStart || newEndTime > tripEnd) {
      toast({
        variant: "destructive",
        title: "Invalid move",
        description: "Event must stay within trip dates",
      });
      return;
    }

    try {
      const res = await fetch(`/api/trips/${trip.id}/activities/${activityToUpdate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...activityToUpdate,
          startTime: newStartTime.toISOString(),
          endTime: newEndTime.toISOString(),
        }),
      });

      if (!res.ok) throw new Error("Failed to update activity");

      // Optimistically update the UI
      queryClient.setQueryData(
        ["/api/trips", trip.id, "activities"],
        activities.map(activity =>
          activity.id === eventId
            ? { ...activity, startTime: newStartTime, endTime: newEndTime }
            : activity
        )
      );

      // Then refetch to ensure consistency
      await queryClient.invalidateQueries({ queryKey: ["/api/trips", trip.id, "activities"] });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to update event",
        description: error instanceof Error ? error.message : "An error occurred",
      });
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    setActiveDropId(over?.id as string || null);
  };

  const getTimeSlotEvents = (date: Date, hour: number) => {
    return activities.filter((event) => {
      const eventStart = new Date(event.startTime);
      return (
        eventStart.getHours() === hour &&
        eventStart.toDateString() === date.toDateString()
      );
    });
  };

  const createEvent = async () => {
    if (!selectedTimeSlot || !newEventTitle) return;

    setIsCreating(true);
    const startTime = new Date(selectedTimeSlot.date);
    startTime.setHours(selectedTimeSlot.hour, 0, 0, 0);
    const endTime = addHours(startTime, 1);

    try {
      const res = await fetch(`/api/trips/${trip.id}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newEventTitle,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        }),
      });

      if (!res.ok) throw new Error("Failed to create activity");

      // Optimistically update the UI
      const newEvent = await res.json();
      queryClient.setQueryData(
        ["/api/trips", trip.id, "activities"],
        (old: Activity[]) => [...(old || []), newEvent]
      );

      toast({
        title: "Event created",
        description: `"${newEventTitle}" has been added to your schedule.`,
      });

      setIsCreateDialogOpen(false);
      setNewEventTitle("");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to create event",
        description: error instanceof Error ? error.message : "An error occurred",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const deleteEvent = async (activityId: number) => {
    try {
      const res = await fetch(`/api/trips/${trip.id}/activities/${activityId}`, {
        method: "DELETE"
      });

      if (!res.ok) throw new Error("Failed to delete activity");

      await queryClient.invalidateQueries({ queryKey: ["/api/trips", trip.id, "activities"] });
      toast({ title: "Event deleted successfully" });
      setIsEditDialogOpen(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to delete event",
        description: error instanceof Error ? error.message : "An error occurred",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <ScrollArea className="border rounded-md max-w-full">
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
      >
        <div className="min-w-fit relative">
          <div className="flex border-b bg-muted/5">
            <div className="w-24 flex-none border-r sticky left-0 z-20 bg-background" />
            {dates.map((date) => (
              <div
                key={date.toISOString()}
                className="w-[300px] p-4 border-l first:border-l-0 font-semibold"
              >
                {format(date, "EEEE, MMMM d")}
              </div>
            ))}
          </div>

          <div className="flex">
            <div className="w-24 flex-none border-r sticky left-0 z-20 bg-background">
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="h-12 flex items-center px-2 text-sm text-muted-foreground border-t first:border-t-0"
                >
                  {format(new Date().setHours(hour, 0), "h:mm a")}
                </div>
              ))}
            </div>

            <div className="flex">
              {dates.map((date) => (
                <div
                  key={date.toISOString()}
                  className="w-[300px] border-l first:border-l-0"
                >
                  {hours.map((hour) => {
                    const timeSlotEvents = getTimeSlotEvents(date, hour);
                    const timeSlotId = `${date.toISOString()}|${hour}`;
                    const isOver = activeDropId === timeSlotId;

                    return (
                      <DroppableTimeSlot key={timeSlotId} id={timeSlotId} isOver={isOver}>
                        {timeSlotEvents.map((event) => (
                          <DraggableEvent
                            key={event.id}
                            event={event}
                            onEdit={() => {
                              setSelectedEvent(event);
                              setIsEditDialogOpen(true);
                            }}
                            onDelete={() => deleteEvent(event.id)}
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
                                className="w-full h-12 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 hover:bg-primary/5"
                                onClick={() => setSelectedTimeSlot({ date, hour })}
                              >
                                <Plus className="h-4 w-4" />
                                <span>Add Event</span>
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[425px]">
                              <DialogHeader>
                                <DialogTitle>Create New Event</DialogTitle>
                              </DialogHeader>
                              <form
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  createEvent();
                                }}
                                className="space-y-4 mt-4"
                              >
                                <Input
                                  ref={inputRef}
                                  placeholder="Event title"
                                  value={newEventTitle}
                                  onChange={(e) => setNewEventTitle(e.target.value)}
                                  className="transition-all duration-200 focus-visible:ring-2"
                                />
                                <Button
                                  type="submit"
                                  className="w-full relative"
                                  disabled={isCreating || !newEventTitle.trim()}
                                >
                                  {isCreating ? (
                                    <>
                                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                      Creating...
                                    </>
                                  ) : (
                                    'Create Event'
                                  )}
                                </Button>
                              </form>
                            </DialogContent>
                          </Dialog>
                        )}
                      </DroppableTimeSlot>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </DndContext>
      <ScrollBar orientation="horizontal" />

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
                onClick={() => {
                  if (selectedEvent) {
                    deleteEvent(selectedEvent.id);
                  }
                }}
                className="flex-1"
              >
                Delete
              </Button>
              <Button
                onClick={async () => {
                  if (selectedEvent) {
                    try {
                      const res = await fetch(`/api/trips/${trip.id}/activities/${selectedEvent.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(selectedEvent),
                      });

                      if (!res.ok) throw new Error("Failed to update activity");

                      await queryClient.invalidateQueries({
                        queryKey: ["/api/trips", trip.id, "activities"],
                      });
                      toast({ title: "Event updated successfully" });
                      setIsEditDialogOpen(false);
                    } catch (error) {
                      toast({
                        variant: "destructive",
                        title: "Failed to update event",
                        description: error instanceof Error ? error.message : "An error occurred",
                      });
                    }
                  }
                }}
                className="flex-1"
              >
                Update
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </ScrollArea>
  );
}