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
import { format, addHours, parseISO } from "date-fns";
import { DndContext, DragEndEvent, useSensor, useSensors, PointerSensor } from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import type { Trip } from "@db/schema";

interface DayViewProps {
  date: Date;
  trip: Trip;
}

interface Event {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
}

export function DayView({ date, trip }: DayViewProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [newEventTitle, setNewEventTitle] = useState("");
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Generate hours for the day
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) return;

    const eventId = active.id as string;
    const newHour = parseInt(over.id as string);
    
    setEvents(currentEvents => 
      currentEvents.map(evt => {
        if (evt.id === eventId) {
          const startTime = new Date(evt.startTime);
          const hourDiff = newHour - startTime.getHours();
          
          const newStartTime = addHours(startTime, hourDiff);
          const newEndTime = addHours(parseISO(evt.endTime), hourDiff);
          
          return {
            ...evt,
            startTime: newStartTime.toISOString(),
            endTime: newEndTime.toISOString(),
          };
        }
        return evt;
      })
    );
  };

  const createEvent = () => {
    if (!selectedHour || !newEventTitle) return;

    const startTime = new Date(date);
    startTime.setHours(selectedHour, 0, 0, 0);
    
    const endTime = new Date(startTime);
    endTime.setHours(startTime.getHours() + 1);

    const newEvent: Event = {
      id: Math.random().toString(36).substr(2, 9),
      title: newEventTitle,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
    };

    setEvents([...events, newEvent]);
    setNewEventTitle("");
    setSelectedHour(null);
    setIsDialogOpen(false);
  };

  return (
    <Card className="p-4">
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
            const currentEvents = events.filter(
              (event) =>
                new Date(event.startTime).getHours() === hour &&
                new Date(event.startTime).toDateString() === date.toDateString()
            );

            return (
              <div
                key={hour}
                id={hour.toString()}
                className="grid grid-cols-[100px,1fr] gap-4 group hover:bg-accent/50 p-2 rounded-lg"
              >
                <div className="text-sm text-muted-foreground">
                  {format(new Date().setHours(hour, 0), "h:mm a")}
                </div>
                <div className="min-h-[2rem] relative">
                  {currentEvents.map((event) => (
                    <div
                      key={event.id}
                      className="absolute left-0 right-0 bg-primary/20 rounded-md p-2 cursor-move"
                      draggable
                    >
                      {event.title}
                    </div>
                  ))}
                  {currentEvents.length === 0 && (
                    <Dialog open={isDialogOpen && selectedHour === hour} onOpenChange={setIsDialogOpen}>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          className="w-full h-full opacity-0 group-hover:opacity-100"
                          onClick={() => setSelectedHour(hour)}
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
  );
}
