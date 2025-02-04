import { useState, useEffect } from "react";
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
import { format, addHours, addDays, differenceInDays, isSameDay, startOfDay } from "date-fns";
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
  const [currentTime, setCurrentTime] = useState(new Date());

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

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

  // Calculate current time indicator position
  const currentTimeTop = (() => {
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    return `${(minutes / 1440) * 100}%`;
  })();

  return (
    <Card className="p-4">
      <ScrollArea className="h-[600px] relative">
        <div className="grid grid-cols-[60px,1fr] gap-0">
          {/* Hours column */}
          <div className="space-y-6 pr-2 text-right">
            {hours.map((hour) => (
              <div key={hour} className="text-sm text-muted-foreground h-24">
                {format(new Date().setHours(hour, 0), "h a")}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="relative border-l pl-2">
            {/* Current time indicator */}
            {dates.some(date => isSameDay(currentTime, date)) && (
              <div 
                className="absolute left-0 right-0 flex items-center z-50"
                style={{ top: currentTimeTop }}
              >
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <div className="flex-1 h-px bg-red-500" />
              </div>
            )}

            {/* Hour grid lines */}
            {hours.map((hour) => (
              <div
                key={hour}
                className="h-24 border-t border-border/30 relative group"
              >
                {/* Event drop zone */}
                <div className="absolute inset-0">
                  {dates.map((date) => {
                    const timeSlotId = `${date.toISOString()}|${hour}`;
                    return (
                      <div
                        key={timeSlotId}
                        id={timeSlotId}
                        className="absolute inset-0"
                      />
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Events */}
            {events.map((event) => {
              const startDate = startOfDay(event.startTime);
              const dayOffset = differenceInDays(startDate, tripStartDate);
              const startMinutes = event.startTime.getHours() * 60 + event.startTime.getMinutes();
              const endMinutes = event.endTime.getHours() * 60 + event.endTime.getMinutes();
              const duration = endMinutes - startMinutes;

              return (
                <div
                  key={event.id}
                  id={event.id}
                  className="absolute left-2 right-2 bg-primary/15 hover:bg-primary/20 rounded px-2 py-1 cursor-move group/event"
                  style={{
                    top: `${(startMinutes / 1440) * 100}%`,
                    height: `${(duration / 1440) * 100}%`,
                    left: `${(dayOffset / numberOfDays) * 100}%`,
                    width: `${(1 / numberOfDays) * 100}%`,
                  }}
                  draggable
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedEvent(event);
                    setIsEditDialogOpen(true);
                  }}
                >
                  <div className="flex items-center justify-between h-full">
                    <span className="font-medium text-sm truncate">{event.title}</span>
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
              );
            })}
          </div>
        </div>
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