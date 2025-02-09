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
  parseISO 
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
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import type { Trip, Activity } from "@db/schema";
import { Pencil, Trash2, Loader2 } from "lucide-react";
import { CSS } from "@dnd-kit/utilities";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

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
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: event.id.toString(),
  });

  const style = transform ? {
    transform: CSS.Transform.toString(transform),
    width: '280px', // Fixed width to match the column width
    backgroundColor: isDragging ? 'hsl(var(--primary))' : undefined,
    boxShadow: isDragging ? 'var(--shadow-lg)' : undefined,
    opacity: isDragging ? 0.9 : 1,
    zIndex: isDragging ? 50 : 1,
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={style}
      className={`bg-primary/20 hover:bg-primary/30 rounded-md p-2 cursor-move group/event transition-all duration-200 ${
        isDragging ? 'ring-2 ring-primary shadow-xl' : ''
      }`}
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
      className={`min-h-[3rem] relative border-t first:border-t-0 transition-colors duration-200 ${
        isOver ? 'bg-primary/10 ring-2 ring-primary/50 ring-inset' : ''
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
  const [activeDropId, setActiveDropId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

      await queryClient.invalidateQueries({ queryKey: ["/api/trips", trip.id, "activities"] });
      toast({ title: "Event updated successfully" });
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

      await queryClient.invalidateQueries({ queryKey: ["/api/trips", trip.id, "activities"] });
      toast({ title: "Event created successfully" });
      setIsCreateDialogOpen(false);
      setNewEventTitle("");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to create event",
        description: error instanceof Error ? error.message : "An error occurred",
      });
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
        <div className="min-w-fit">
          {/* Header row with dates */}
          <div className="flex border-b bg-muted/5">
            <div className="w-24 flex-none border-r" />
            {dates.map((date) => (
              <div
                key={date.toISOString()}
                className="w-[300px] p-4 border-l first:border-l-0 font-semibold"
              >
                {format(date, "EEEE, MMMM d")}
              </div>
            ))}
          </div>

          {/* Time slots and events grid */}
          <div className="flex">
            {/* Time column */}
            <div className="w-24 flex-none border-r">
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="h-12 px-2 py-3 text-sm text-muted-foreground"
                >
                  {format(new Date().setHours(hour, 0), "h:mm a")}
                </div>
              ))}
            </div>

            {/* Days columns */}
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
                      <div
                        key={timeSlotId}
                        className="h-12 relative group hover:bg-accent/50 border-t first:border-t-0"
                      >
                        <DroppableTimeSlot id={timeSlotId} isOver={isOver}>
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
                                  >
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
              ))}
            </div>
          </div>
        </div>
      </DndContext>
      <ScrollBar orientation="horizontal" />

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