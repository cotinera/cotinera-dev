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
  differenceInMinutes,
  setMinutes,
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
import { Pencil, Trash2, Loader2 } from "lucide-react";
import { CSS } from "@dnd-kit/utilities";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";

// Helper function to snap time to nearest 15 minutes
function snapToQuarterHour(date: Date): Date {
  const minutes = date.getMinutes();
  const snappedMinutes = Math.round(minutes / 15) * 15;
  return new Date(date.setMinutes(snappedMinutes, 0, 0));
}

// Helper function to convert pixels to minutes (with 15-minute snapping)
function pixelsToMinutes(pixels: number): number {
  // 48px = 1 hour, so 12px = 15 minutes
  const minutes = (pixels / 48) * 60;
  return Math.round(minutes / 15) * 15;
}

interface TimeSlot {
  date: Date;
  hour: number;
}

function DraggableEvent({
  event,
  onEdit,
  onDelete,
  onResize,
}: {
  event: Activity;
  onEdit: () => void;
  onDelete: () => void;
  onResize: (edge: 'top' | 'bottom', newTime: Date) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: event.id.toString(),
  });

  const [isResizing, setIsResizing] = useState(false);
  const [resizeEdge, setResizeEdge] = useState<'top' | 'bottom' | null>(null);
  const elementRef = useRef<HTMLDivElement>(null);
  const initialHeightRef = useRef<number | null>(null);
  const initialEventRef = useRef<Activity>(event);

  // Calculate initial height
  const eventStart = new Date(event.startTime);
  const eventEnd = new Date(event.endTime);
  const durationInMinutes = differenceInMinutes(eventEnd, eventStart);
  const heightInPixels = Math.max((durationInMinutes / 60) * 48, 48); // 48px per hour, minimum 1 hour

  const handleResizeStart = (e: React.MouseEvent, edge: 'top' | 'bottom') => {
    e.preventDefault();
    e.stopPropagation();
    if (!elementRef.current) return;

    setIsResizing(true);
    setResizeEdge(edge);
    initialHeightRef.current = elementRef.current.offsetHeight;
    initialEventRef.current = event;
  };

  const handleResizeMove = (e: MouseEvent) => {
    if (!isResizing || !resizeEdge || !elementRef.current || !initialHeightRef.current) return;

    e.preventDefault();
    const rect = elementRef.current.getBoundingClientRect();
    const mouseY = e.clientY;

    if (resizeEdge === 'top') {
      // When dragging top edge, only modify start time
      const maxDelta = rect.bottom - rect.top - 48; // Minimum 1 hour
      const delta = Math.min(Math.max(mouseY - rect.top, -maxDelta), maxDelta);
      const newHeight = initialHeightRef.current - delta;

      if (newHeight >= 48) { // Minimum 1 hour
        const minutesDelta = pixelsToMinutes(delta);
        const newStartTime = new Date(initialEventRef.current.startTime);
        newStartTime.setMinutes(newStartTime.getMinutes() + minutesDelta);
        const snappedStartTime = snapToQuarterHour(newStartTime);

        if (snappedStartTime < eventEnd) {
          const newHeightAfterSnap = (differenceInMinutes(eventEnd, snappedStartTime) / 60) * 48;
          elementRef.current.style.height = `${newHeightAfterSnap}px`;
          onResize('top', snappedStartTime);
        }
      }
    } else {
      // When dragging bottom edge, only modify end time
      const maxDelta = (24 * 48) - (rect.bottom - rect.top); // Maximum 24 hours
      const delta = Math.min(Math.max(mouseY - rect.bottom, -initialHeightRef.current + 48), maxDelta);
      const newHeight = initialHeightRef.current + delta;

      if (newHeight >= 48) { // Minimum 1 hour
        const minutesDelta = pixelsToMinutes(delta);
        const newEndTime = new Date(initialEventRef.current.endTime);
        newEndTime.setMinutes(newEndTime.getMinutes() + minutesDelta);
        const snappedEndTime = snapToQuarterHour(newEndTime);

        if (snappedEndTime > eventStart) {
          const newHeightAfterSnap = (differenceInMinutes(snappedEndTime, eventStart) / 60) * 48;
          elementRef.current.style.height = `${newHeightAfterSnap}px`;
          onResize('bottom', snappedEndTime);
        }
      }
    }
  };

  const handleResizeEnd = () => {
    setIsResizing(false);
    setResizeEdge(null);
    initialHeightRef.current = null;
  };

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleResizeMove);
      window.addEventListener('mouseup', handleResizeEnd);
      return () => {
        window.removeEventListener('mousemove', handleResizeMove);
        window.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [isResizing, resizeEdge]);

  const style: React.CSSProperties = {
    transform: !isResizing && transform ? CSS.Transform.toString(transform) : undefined,
    width: '280px',
    height: `${heightInPixels}px`,
    position: 'absolute',
    left: '8px',
    top: '0',
    backgroundColor: isDragging ? 'hsl(var(--primary)/0.2)' : undefined,
    boxShadow: isDragging ? 'var(--shadow-md)' : undefined,
    opacity: isDragging ? 0.9 : 1,
    zIndex: isDragging || isResizing ? 50 : 1,
    cursor: isResizing ? 'ns-resize' : 'move',
    transition: isResizing ? 'none' : undefined,
  };

  const combinedRef = (el: HTMLDivElement | null) => {
    if (!isResizing) setNodeRef(el);
    elementRef.current = el;
  };

  return (
    <div
      ref={combinedRef}
      {...(!isResizing ? { ...attributes, ...listeners } : {})}
      style={style}
      className={`bg-primary/20 hover:bg-primary/30 rounded-md px-2 py-1 group/event ${
        isDragging ? 'ring-1 ring-primary/50' : ''
      }`}
    >
      {/* Top resize handle */}
      <div
        className="absolute top-0 left-0 w-full h-1 cursor-ns-resize hover:bg-primary/50 rounded-t-md"
        onMouseDown={(e) => handleResizeStart(e, 'top')}
      />

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
        {format(eventStart, "h:mm a")} - {format(eventEnd, "h:mm a")}
      </span>

      {/* Bottom resize handle */}
      <div
        className="absolute bottom-0 left-0 w-full h-1 cursor-ns-resize hover:bg-primary/50 rounded-b-md"
        onMouseDown={(e) => handleResizeStart(e, 'bottom')}
      />
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
    const durationMs = differenceInMinutes(endDate, startDate);

    // Preserve exact duration when moving
    const newStartTime = new Date(newDate);
    newStartTime.setHours(newHour, startDate.getMinutes(), 0, 0);
    const newEndTime = new Date(newStartTime);
    newEndTime.setMinutes(newEndTime.getMinutes() + durationMs);

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
            ? { ...activity, startTime: newStartTime.toISOString(), endTime: newEndTime.toISOString() }
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

  const handleResize = async (eventId: number, edge: 'top' | 'bottom', newTime: Date) => {
    const activityToUpdate = activities.find((a) => a.id === eventId);
    if (!activityToUpdate) return;

    const updatedActivity = { ...activityToUpdate };
    if (edge === 'top') {
      updatedActivity.startTime = newTime.toISOString();
    } else {
      updatedActivity.endTime = newTime.toISOString();
    }

    try {
      const res = await fetch(`/api/trips/${trip.id}/activities/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedActivity),
      });

      if (!res.ok) throw new Error("Failed to update activity");

      // Optimistically update the UI
      queryClient.setQueryData(
        ["/api/trips", trip.id, "activities"],
        activities.map(activity =>
          activity.id === eventId ? updatedActivity : activity
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
          {/* Header row with dates */}
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

          {/* Time slots and events grid */}
          <div className="flex">
            {/* Time column */}
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
                            onResize={(edge, newTime) => handleResize(event.id, edge, newTime)}
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
                                className="w-full h-12 opacity-0 hover:opacity-100 transition-opacity"
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
                                <Button onClick={createEvent} className="w-full">
                                  Create Event
                                </Button>
                              </div>
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