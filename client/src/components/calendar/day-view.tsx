import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { format, addHours, parseISO, addDays, differenceInDays } from "date-fns";
import { DndContext, DragEndEvent, useSensor, useSensors, PointerSensor } from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import type { Trip } from "@db/schema";

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
  const [isDialogOpen, setIsDialogOpen] = useState(false);

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
    setIsDialogOpen(false);
  };

  return (
    <div className="space-y-8">
      {dates.map((date) => (
        <Card key={date.toISOString()} className="p-4">
          <h3 className="text-lg font-semibold mb-4">
            {format(date, "EEEE, MMMM d, yyyy")}
          </h3>

          <DndContext
            sensors={sensors}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
          >
            <div className="space-y-1">
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
                    id={timeSlotId}
                    className="grid grid-cols-[100px,1fr] gap-4 group hover:bg-accent/50 p-2 rounded-lg"
                  >
                    <div className="text-sm text-muted-foreground">
                      {format(new Date().setHours(hour, 0), "h:mm a")}
                    </div>
                    <div className="min-h-[2rem] relative">
                      {timeSlotEvents.map((event) => (
                        <div
                          key={event.id}
                          id={event.id}
                          className="absolute left-0 right-0 bg-primary/20 rounded-md p-2 cursor-move"
                          draggable
                        >
                          <span className="font-medium">{event.title}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {format(event.startTime, "h:mm a")} - {format(event.endTime, "h:mm a")}
                          </span>
                        </div>
                      ))}
                      {timeSlotEvents.length === 0 && (
                        <Dialog 
                          open={isDialogOpen && 
                            selectedTimeSlot?.date.toDateString() === date.toDateString() && 
                            selectedTimeSlot?.hour === hour
                          } 
                          onOpenChange={setIsDialogOpen}
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
                    </div>
                  </div>
                );
              })}
            </div>
          </DndContext>
        </Card>
      ))}
    </div>
  );
}