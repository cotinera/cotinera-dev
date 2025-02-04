import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { format, addHours, addDays, differenceInDays } from "date-fns";
import { DndContext, DragEndEvent, useSensor, useSensors, PointerSensor } from "@dnd-kit/core";
import type { Trip } from "@db/schema";
import { Pencil, Trash2 } from "lucide-react";

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
    <Card className="p-4">
      <div className="mb-4 grid grid-cols-[100px,repeat(auto-fit,1fr)] gap-2">
        <div /> {/* Empty cell for time column */}
        {dates.map((date) => (
          <h3 key={date.toISOString()} className="text-sm font-semibold text-center">
            {format(date, "EEE, MMM d")}
          </h3>
        ))}
      </div>

      <ScrollArea className="h-[600px]">
        <DndContext
          sensors={sensors}
          onDragEnd={handleDragEnd}
        >
          {hours.map((hour) => (
            <div
              key={hour}
              className="grid grid-cols-[100px,repeat(auto-fit,1fr)] gap-2 py-1 group hover:bg-accent/50"
            >
              <div className="text-sm text-muted-foreground">
                {format(new Date().setHours(hour, 0), "h:mm a")}
              </div>

              {dates.map((date) => {
                const timeSlotId = `${date.toISOString()}|${hour}`;
                const timeSlotEvents = events.filter(
                  (event) =>
                    event.startTime.getHours() === hour &&
                    event.startTime.toDateString() === date.toDateString()
                );

                return (
                  <div
                    key={timeSlotId}
                    id={timeSlotId}
                    className="relative min-h-[2.5rem] border-t border-border/50"
                  >
                    {timeSlotEvents.map((event) => (
                      <div
                        key={event.id}
                        id={event.id}
                        className="absolute inset-x-1 bg-primary/20 rounded-sm p-1 cursor-move group/event text-sm"
                        draggable
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEvent(event);
                          setIsEditDialogOpen(true);
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium truncate">{event.title}</span>
                          <div className="hidden group-hover/event:flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedEvent(event);
                                setIsEditDialogOpen(true);
                              }}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedEvent(event);
                                deleteEvent();
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
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
                          <button
                            className="absolute inset-0 w-full h-full opacity-0 group-hover:opacity-100"
                            onClick={() => setSelectedTimeSlot({ date, hour })}
                          >
                            <span className="sr-only">Add event</span>
                          </button>
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
                  </div>
                );
              })}
            </div>
          ))}
        </DndContext>
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
    </Card>
  );
}