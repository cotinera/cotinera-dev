import { useState } from "react";
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
import { format, addHours, addDays, differenceInDays } from "date-fns";
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
import type { Trip } from "@db/schema";
import { Pencil, Trash2 } from "lucide-react";
import { CSS } from "@dnd-kit/utilities";

interface DayViewProps {
  trip: Trip;
}

interface CalendarEvent {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
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
  event: CalendarEvent;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: event.id,
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
      className="absolute left-0 right-0 bg-primary/20 hover:bg-primary/30 rounded-md p-2 cursor-move group/event"
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
        {format(event.startTime, "h:mm a")} - {format(event.endTime, "h:mm a")}
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
    <div ref={setNodeRef} className="min-h-[2rem] relative">
      {children}
    </div>
  );
}

export function DayView({ trip }: DayViewProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [newEventTitle, setNewEventTitle] = useState("");
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) return;

    const eventId = active.id as string;
    const [dateStr, hourStr] = (over.id as string).split('|');
    const newHour = parseInt(hourStr);
    const newDate = new Date(dateStr);

    setEvents((currentEvents) => 
      currentEvents.map((evt) => {
        if (evt.id === eventId) {
          const hourDiff = newHour - evt.startTime.getHours();
          const dateDiff = differenceInDays(newDate, evt.startTime);

          const newStartTime = addHours(addDays(evt.startTime, dateDiff), hourDiff);
          const newEndTime = addHours(addDays(evt.endTime, dateDiff), hourDiff);

          return {
            ...evt,
            startTime: newStartTime,
            endTime: newEndTime,
          };
        }
        return evt;
      })
    );
  };

  const createEvent = () => {
    if (!selectedTimeSlot || !newEventTitle) return;

    const startTime = new Date(selectedTimeSlot.date);
    startTime.setHours(selectedTimeSlot.hour, 0, 0, 0);

    const endTime = addHours(startTime, 1);

    const newEvent: CalendarEvent = {
      id: crypto.randomUUID(),
      title: newEventTitle,
      startTime,
      endTime,
    };

    setEvents((prev) => [...prev, newEvent]);
    setNewEventTitle("");
    setSelectedTimeSlot(null);
    setIsCreateDialogOpen(false);
  };

  const updateEvent = () => {
    if (!selectedEvent) return;

    setEvents((currentEvents) =>
      currentEvents.map((evt) =>
        evt.id === selectedEvent.id ? selectedEvent : evt
      )
    );
    setSelectedEvent(null);
    setIsEditDialogOpen(false);
  };

  const deleteEvent = () => {
    if (!selectedEvent) return;

    setEvents((currentEvents) =>
      currentEvents.filter((evt) => evt.id !== selectedEvent.id)
    );
    setSelectedEvent(null);
    setIsEditDialogOpen(false);
  };

  return (
    <div className="flex border rounded-md">
      {/* Fixed time column */}
      <div className="w-24 flex-none border-r bg-muted/50">
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
            <Card key={date.toISOString()} className="flex-none w-[300px] border-r last:border-r-0">
              <h3 className="text-lg font-semibold p-4 border-b sticky top-0 bg-background">
                {format(date, "EEEE, MMMM d")}
              </h3>

              <DndContext
                sensors={sensors}
                modifiers={[restrictToVerticalAxis]}
                onDragEnd={handleDragEnd}
              >
                <div>
                  {hours.map((hour) => {
                    const timeSlotEvents = events.filter(
                      (event) => 
                        event.startTime.getHours() === hour &&
                        event.startTime.toDateString() === date.toDateString()
                    );

                    const timeSlotId = `${date.toISOString()}|${hour}`;

                    return (
                      <div
                        key={timeSlotId}
                        className="h-12 group hover:bg-accent/50 px-2"
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
                              open={isCreateDialogOpen && 
                                selectedTimeSlot?.date.toDateString() === date.toDateString() && 
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
                                  <Button onClick={createEvent} className="w-full">
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
              >
                Delete
              </Button>
              <Button onClick={updateEvent} className="flex-1">
                Update
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}