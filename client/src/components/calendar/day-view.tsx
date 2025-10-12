import {
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  format,
  addHours,
  addDays,
  differenceInDays,
  startOfDay,
  endOfDay,
  differenceInMinutes,
  setMinutes,
  parse,
} from "date-fns";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
// import {
//   DndContext,
//   DragEndEvent,
//   useSensor,
//   useSensors,
//   PointerSensor,
//   useDraggable,
//   useDroppable,
//   DragStartEvent,
//   DragOverEvent,
//   DragOverlay,
// } from "@dnd-kit/core";
import { useDroppable } from "@dnd-kit/core"; // keep droppable for slot highlighting
import type { Trip, Activity, User } from "@db/schema";

// Extended types with relations
type TripWithParticipants = Trip & {
  participants?: Array<{
    id: number;
    user?: User | null;
  }> | null;
};

type ActivityWithParticipants = Activity & {
  participants?: Array<{
    userId: number;
  }> | null;
};
import { Pencil, Trash2, Loader2, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPicker } from "@/components/map-picker";
import { cn } from "@/lib/utils";

// Update the event form schema to include location coordinates
const eventFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:mm)"),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:mm)"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  location: z.string().optional(),
  description: z.string().optional(),
  participants: z.array(z.number()).default([]),
  coordinates: z.object({
    lat: z.number(),
    lng: z.number()
  }).optional().nullable(),
  isAllDay: z.boolean().optional().default(false),
});

type EventFormValues = z.infer<typeof eventFormSchema>;

// Constants for pixel calculations - using 60px per hour for better spacing
const PIXELS_PER_HOUR = 60;
const MINUTES_PER_SLOT = 15;
const PIXELS_PER_SLOT = PIXELS_PER_HOUR / (60 / MINUTES_PER_SLOT);

function snapToQuarterHour(date: Date): Date {
  const minutes = date.getMinutes();
  const snappedMinutes = Math.round(minutes / 15) * 15;
  return new Date(date.setMinutes(snappedMinutes, 0, 0));
}

// Snap to 15-minute intervals
function snapToSlot(minutes: number): number {
  return Math.round(minutes / MINUTES_PER_SLOT) * MINUTES_PER_SLOT;
}

// Convert pixel offset to minutes
function pixelsToMinutes(pixels: number): number {
  return Math.round((pixels / PIXELS_PER_HOUR) * 60);
}

// Convert minutes to pixel offset
function minutesToPixels(minutes: number): number {
  return (minutes / 60) * PIXELS_PER_HOUR;
}

// Get time in minutes from a date
function getTimeInMinutes(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

// Set time in minutes for a date
function setTimeInMinutes(date: Date, minutes: number): Date {
  const newDate = new Date(date);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  newDate.setHours(hours, mins, 0, 0);
  return newDate;
}

// Clamp minutes to valid range (0-1440 for a day)
function clampMinutes(minutes: number): number {
  return Math.max(0, Math.min(1440, minutes));
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
  event: Activity & { isSegment?: boolean; originalEvent?: Activity };
  onEdit: () => void;
  onDelete: () => void;
  onResize: (eventId: number, edge: 'top' | 'bottom' | 'move', newTime: Date) => void;
}) {
  const eventRef = useRef<HTMLDivElement>(null);
  const tempStartRef = useRef<Date>(new Date(event.startTime));
  const tempEndRef = useRef<Date>(new Date(event.endTime));
  const hasDraggedRef = useRef(false);
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragType, setDragType] = useState<'move' | 'resize-top' | 'resize-bottom' | null>(null);
  const [tempStartTime, setTempStartTime] = useState<Date>(new Date(event.startTime));
  const [tempEndTime, setTempEndTime] = useState<Date>(new Date(event.endTime));

  // Reset temp times when event prop changes
  useEffect(() => {
    setTempStartTime(new Date(event.startTime));
    setTempEndTime(new Date(event.endTime));
    tempStartRef.current = new Date(event.startTime);
    tempEndRef.current = new Date(event.endTime);
  }, [event.startTime, event.endTime]);

  const startMinutes = getTimeInMinutes(tempStartTime);
  const endMinutes = getTimeInMinutes(tempEndTime);
  const duration = endMinutes - startMinutes;

  const top = minutesToPixels(startMinutes);
  const height = minutesToPixels(duration);

  const handlePointerDown = useCallback((e: React.PointerEvent, type: 'move' | 'resize-top' | 'resize-bottom') => {
    e.stopPropagation();
    e.preventDefault();
    
    hasDraggedRef.current = false;
    setIsDragging(true);
    setDragType(type);

    const startY = e.clientY;
    const initialStartTime = new Date(tempStartTime);
    const initialEndTime = new Date(tempEndTime);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaY = moveEvent.clientY - startY;
      
      // Mark as dragged if moved more than 3 pixels
      if (Math.abs(deltaY) > 3) {
        hasDraggedRef.current = true;
      }
      
      const deltaMinutes = snapToSlot(pixelsToMinutes(deltaY));

      if (type === 'move') {
        // Get the column element to support cross-day dragging
        const colEl = eventRef.current?.closest('[data-date-column]');
        const newColEl = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY)?.closest('[data-date-column]');
        
        if (newColEl && newColEl !== colEl) {
          // Cross-day dragging
          const newDateStr = newColEl.getAttribute('data-date-column');
          if (newDateStr) {
            const newDate = new Date(newDateStr);
            const newStartMinutes = clampMinutes(getTimeInMinutes(initialStartTime) + deltaMinutes);
            const newEndMinutes = clampMinutes(getTimeInMinutes(initialEndTime) + deltaMinutes);
            
            const newStart = setTimeInMinutes(newDate, newStartMinutes);
            const newEnd = setTimeInMinutes(newDate, newEndMinutes);
            
            tempStartRef.current = newStart;
            tempEndRef.current = newEnd;
            setTempStartTime(newStart);
            setTempEndTime(newEnd);
          }
        } else {
          // Same-day dragging
          const newStartMinutes = clampMinutes(getTimeInMinutes(initialStartTime) + deltaMinutes);
          const newEndMinutes = clampMinutes(getTimeInMinutes(initialEndTime) + deltaMinutes);
          
          const newStart = setTimeInMinutes(event.startTime, newStartMinutes);
          const newEnd = setTimeInMinutes(event.endTime, newEndMinutes);
          
          tempStartRef.current = newStart;
          tempEndRef.current = newEnd;
          setTempStartTime(newStart);
          setTempEndTime(newEnd);
        }
      } else if (type === 'resize-top') {
        const newStartMinutes = clampMinutes(getTimeInMinutes(initialStartTime) + deltaMinutes);
        const currentEndMinutes = getTimeInMinutes(initialEndTime);
        
        // Ensure minimum 15 minutes duration
        if (currentEndMinutes - newStartMinutes >= 15) {
          const newStart = setTimeInMinutes(event.startTime, newStartMinutes);
          tempStartRef.current = newStart;
          setTempStartTime(newStart);
        }
      } else if (type === 'resize-bottom') {
        const newEndMinutes = clampMinutes(getTimeInMinutes(initialEndTime) + deltaMinutes);
        const currentStartMinutes = getTimeInMinutes(initialStartTime);
        
        // Ensure minimum 15 minutes duration
        if (newEndMinutes - currentStartMinutes >= 15) {
          const newEnd = setTimeInMinutes(event.endTime, newEndMinutes);
          tempEndRef.current = newEnd;
          setTempEndTime(newEnd);
        }
      }
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      setDragType(null);
      
      // Commit changes using refs - get the original event ID
      const originalEvent = event.originalEvent || event;
      const eventIdStr = String(originalEvent.id);
      const originalEventId = typeof originalEvent.id === 'number' ? originalEvent.id : parseInt(eventIdStr.split('_')[0]);
      
      if (type === 'move') {
        onResize(originalEventId, 'move', tempStartRef.current);
      } else if (type === 'resize-top') {
        onResize(originalEventId, 'top', tempStartRef.current);
      } else if (type === 'resize-bottom') {
        onResize(originalEventId, 'bottom', tempEndRef.current);
      }

      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
  }, [event, tempStartTime, tempEndTime, onResize]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    // Only open edit dialog if we didn't drag
    if (!hasDraggedRef.current) {
      onEdit();
    }
  }, [onEdit]);

  // Apply the light blue transparent styling from Lovable.ai
  const style: React.CSSProperties = {
    position: 'absolute',
    top: `${top}px`,
    height: `${Math.max(height, 15)}px`,
    left: '8px',
    right: '8px'
  };

  return (
    <div
      ref={eventRef}
      className={cn(
        "absolute rounded-md border border-primary/20 bg-primary/10 overflow-hidden transition-shadow select-none",
        isDragging ? "shadow-lg ring-2 ring-primary/30" : "hover:shadow-md hover:border-primary/40",
        dragType === 'move' && "cursor-move",
        dragType === 'resize-top' && "cursor-ns-resize",
        dragType === 'resize-bottom' && "cursor-ns-resize"
      )}
      style={style}
    >
      {/* Resize handle - top */}
      <div
        className="absolute inset-x-0 top-0 h-1 cursor-ns-resize hover:bg-primary/30 transition-colors"
        onPointerDown={(e) => handlePointerDown(e, 'resize-top')}
      />

      {/* Event content */}
      <div
        className="px-2 py-1 h-full overflow-hidden cursor-pointer select-none"
        onPointerDown={(e) => handlePointerDown(e, 'move')}
        onClick={handleClick}
      >
        <div className="flex justify-between items-start">
          <div className="flex-1 overflow-hidden">
            <div className="text-xs font-medium text-primary truncate">
              {event.title}
            </div>
            <div className="text-xs text-muted-foreground">
              {format(tempStartTime, 'h:mm a')} - {format(tempEndTime, 'h:mm a')}
            </div>
            {event.location && height > 40 && (
              <div className="text-xs text-muted-foreground truncate mt-0.5">
                {event.location}
              </div>
            )}
          </div>
          <div className="flex items-center gap-0.5 opacity-0 hover:opacity-100 transition-opacity ml-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 hover:bg-primary/20"
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
              className="h-5 w-5 hover:bg-destructive/20 hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Resize handle - bottom */}
      <div
        className="absolute inset-x-0 bottom-0 h-1 cursor-ns-resize hover:bg-primary/30 transition-colors"
        onPointerDown={(e) => handlePointerDown(e, 'resize-bottom')}
      />
    </div>
  );
}

function DroppableTimeSlot({
  id,
  isOver,
  isSelected,
  onMouseDown,
  onMouseEnter,
  children,
}: {
  id: string;
  isOver: boolean;
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseEnter: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  const { setNodeRef } = useDroppable({
    id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`h-[60px] relative border-t transition-colors ${
        isOver ? 'bg-primary/20' : ''
      } ${
        isSelected ? 'bg-primary/5' : ''
      } hover:bg-primary/5`}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      style={{ userSelect: 'none', cursor: 'pointer' }}
    >
      {children}
    </div>
  );
}

function EventForm({
  defaultValues,
  onSubmit,
  submitLabel,
  trip,
}: {
  defaultValues: EventFormValues;
  onSubmit: (values: EventFormValues) => void;
  submitLabel: string;
  trip: TripWithParticipants;
}) {
  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      ...defaultValues,
      participants: defaultValues.participants || [],
      coordinates: defaultValues.coordinates || null,
    },
  });

  // Get all participants from the trip, ensuring we have valid user objects
  const participants = (trip.participants || [])
    .map(p => p.user)
    .filter((user): user is User => user != null);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="isAllDay"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <FormLabel>All day event</FormLabel>
                <FormDescription>
                  This event lasts the entire day
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        {!form.watch('isAllDay') && (
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="startTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Start Time</FormLabel>
                  <FormControl>
                    <Input {...field} type="time" />
                  </FormControl>
                  <FormMessage />
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
                    <Input {...field} type="time" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Date</FormLabel>
              <FormControl>
                <Input {...field} type="date" />
              </FormControl>
              <FormMessage />
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
                <div className="h-[200px] rounded-md overflow-hidden">
                  <MapPicker
                    value={field.value || ""}
                    onChange={(address, coordinates) => {
                      field.onChange(address);
                      if (coordinates) {
                        form.setValue('coordinates', coordinates);
                      }
                    }}
                    placeholder="Search for a location..."
                    initialCenter={form.getValues('coordinates') ?? trip.coordinates ?? undefined}
                    searchBias={trip.coordinates ?? undefined}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />



        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (optional)</FormLabel>
              <FormControl>
                <Textarea {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="participants"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>Participants (optional)</span>
                </div>
              </FormLabel>
              <FormControl>
                <div className="space-y-3 rounded-md border p-3">
                  {participants.length > 0 ? (
                    participants.map((participant) => (
                      <div key={participant.id} className="flex items-center space-x-3">
                        <Checkbox
                          id={`participant-${participant.id}`}
                          checked={field.value.includes(participant.id)}
                          onCheckedChange={(checked) => {
                            const newValue = checked
                              ? [...field.value, participant.id]
                              : field.value.filter((id: number) => id !== participant.id);
                            field.onChange(newValue);
                          }}
                        />
                        <label 
                          htmlFor={`participant-${participant.id}`} 
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {participant.name || participant.username || participant.email}
                        </label>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No participants in this trip</p>
                  )}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full">{submitLabel}</Button>
      </form>
    </Form>
  );
}

// Component exports
export function DayView({ trip }: { trip: TripWithParticipants }) {
  const [newEventTitle, setNewEventTitle] = useState("");
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Activity | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [highlightedSlots, setHighlightedSlots] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  
  // Drag selection state
  const [isDragSelecting, setIsDragSelecting] = useState(false);
  const [dragStartSlot, setDragStartSlot] = useState<{ date: Date; hour: number } | null>(null);
  const [dragEndSlot, setDragEndSlot] = useState<{ date: Date; hour: number } | null>(null);
  const [dragSelectedSlots, setDragSelectedSlots] = useState<Set<string>>(new Set());
  
  // Store the drag selection range for the create dialog
  const [dragSelectionRange, setDragSelectionRange] = useState<{ startHour: number; endHour: number; date: Date } | null>(null);

  // Ref to store drag metadata from DraggableEvent
  const dragMetadataRef = useRef<{ clickOffsetY: number; originalTopPixels: number; originalEvent: Activity } | null>(null);


  const tripStartDate = new Date(trip.startDate);
  const tripEndDate = new Date(trip.endDate);
  const numberOfDays = differenceInDays(tripEndDate, tripStartDate) + 1;
  const dates = Array.from({ length: numberOfDays }, (_, i) => addDays(tripStartDate, i));
  const hours = Array.from({ length: 24 }, (_, i) => i); // 12 AM to 11 PM (0-23)
  
  // Helper functions for drag selection
  const getSlotFromCoordinates = (element: HTMLElement): { date: Date; hour: number } | null => {
    const dateStr = element.getAttribute('data-date');
    const hourStr = element.getAttribute('data-hour');
    if (!dateStr || !hourStr) return null;
    
    return {
      date: new Date(dateStr),
      hour: parseInt(hourStr, 10),
    };
  };
  
  const updateDragSelection = (start: { date: Date; hour: number }, end: { date: Date; hour: number }) => {
    const newSelectedSlots = new Set<string>();
    const startHour = Math.min(start.hour, end.hour);
    const endHour = Math.max(start.hour, end.hour);
    
    // Only support single day selection for now
    if (start.date.toDateString() === end.date.toDateString()) {
      for (let hour = startHour; hour <= endHour; hour++) {
        newSelectedSlots.add(`${format(start.date, 'yyyy-MM-dd')}|${hour}`);
      }
    }
    
    setDragSelectedSlots(newSelectedSlots);
  };
  
  // Mouse event handlers for drag selection
  const handleTimeSlotMouseDown = (e: React.MouseEvent, date: Date, hour: number) => {
    // Don't start drag if clicking on an event
    if ((e.target as HTMLElement).closest('.group\\/event')) return;
    
    e.preventDefault();
    setIsDragSelecting(true);
    setDragStartSlot({ date, hour });
    setDragEndSlot({ date, hour });
    setDragSelectedSlots(new Set([`${format(date, 'yyyy-MM-dd')}|${hour}`]));
  };
  
  const handleTimeSlotMouseEnter = (e: React.MouseEvent, date: Date, hour: number) => {
    if (!isDragSelecting || !dragStartSlot) return;
    
    setDragEndSlot({ date, hour });
    updateDragSelection(dragStartSlot, { date, hour });
  };
  
  const handleTimeSlotMouseUp = () => {
    if (!isDragSelecting || !dragStartSlot || !dragEndSlot) return;
    
    // If we have a valid selection, open the create dialog
    if (dragSelectedSlots.size > 0) {
      // Calculate start and end times based on the selection
      const startHour = Math.min(dragStartSlot.hour, dragEndSlot.hour);
      const endHour = Math.max(dragStartSlot.hour, dragEndSlot.hour) + 1; // Add 1 to include the last hour
      
      setSelectedTimeSlot({
        date: dragStartSlot.date,
        hour: startHour
      });
      
      // Store the drag selection range for the dialog
      setDragSelectionRange({
        startHour,
        endHour,
        date: dragStartSlot.date
      });
      
      // We'll need to pass these to the create dialog
      setIsCreateDialogOpen(true);
    }
    
    // Reset drag state
    setIsDragSelecting(false);
    setDragStartSlot(null);
    setDragEndSlot(null);
    setDragSelectedSlots(new Set());
  };
  
  // Add global mouse up handler to handle mouse up outside of time slots
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragSelecting) {
        handleTimeSlotMouseUp();
      }
    };
    
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isDragSelecting, dragStartSlot, dragEndSlot, dragSelectedSlots]);

  const { data: activities = [], isLoading } = useQuery<Activity[]>({
    queryKey: [`/api/trips/${trip.id}/activities`],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${trip.id}/activities`);
      if (!res.ok) throw new Error("Failed to fetch activities");
      return res.json();
    },
  });

  
  
  // Callback to capture drag metadata from DraggableEvent
  const handleEventDragStart = (clickOffsetY: number, originalTopPixels: number, originalEvent: Activity) => {
    dragMetadataRef.current = {
      clickOffsetY,
      originalTopPixels,
      originalEvent,
    };
  };


  const splitMultiDayEvents = (activities: Activity[]) => {
    const splitEvents: (Activity & { isSegment?: boolean; originalEvent?: Activity })[] = [];
    
    activities.forEach((event) => {
      const eventStart = new Date(event.startTime);
      const eventEnd = new Date(event.endTime);
      
      const isAllDay = (
        eventStart.getHours() === 0 && 
        eventStart.getMinutes() === 0 &&
        eventEnd.getHours() === 0 &&
        eventEnd.getMinutes() === 0 &&
        eventEnd.getTime() - eventStart.getTime() >= 24 * 60 * 60 * 1000
      );
      
      if (isAllDay || eventStart.toDateString() === eventEnd.toDateString()) {
        splitEvents.push(event);
        return;
      }
      
      const currentDate = new Date(eventStart);
      currentDate.setHours(0, 0, 0, 0);
      
      while (currentDate < eventEnd) {
        const segmentStart = currentDate.toDateString() === eventStart.toDateString() 
          ? new Date(eventStart) 
          : new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 0, 0, 0, 0);
          
        const segmentEnd = currentDate.toDateString() === eventEnd.toDateString() 
          ? new Date(eventEnd) 
          : new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 1, 0, 0, 0, 0);
        
        if (segmentStart < segmentEnd) {
          splitEvents.push({
            ...event,
            id: (event.id + '_' + format(currentDate, 'yyyy-MM-dd')) as any,
            startTime: new Date(segmentStart),
            endTime: new Date(segmentEnd),
            isSegment: true,
            originalEvent: event
          } as any);
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
    });
    
    return splitEvents;
  };

  const splitActivities = splitMultiDayEvents(activities);

  const getTimeSlotEvents = (date: Date, hour: number) => {
    return splitActivities.filter((event) => {
      const eventStart = new Date(event.startTime);
      const eventEnd = new Date(event.endTime);
      
      // Check if it's an all-day event
      const isAllDay = (
        eventStart.getHours() === 0 && 
        eventStart.getMinutes() === 0 &&
        eventEnd.getHours() === 0 &&
        eventEnd.getMinutes() === 0 &&
        eventEnd.getTime() - eventStart.getTime() >= 24 * 60 * 60 * 1000
      );
      
      if (isAllDay) return false;
      
      // Check if event is on this date
      const eventDate = eventStart.toDateString();
      const targetDate = date.toDateString();
      
      if (eventDate !== targetDate) return false;
      
      // Only show event at its start hour (not every hour it spans)
      return eventStart.getHours() === hour;
    });
  };
  
  const getAllDayEvents = (date: Date) => {
    return splitActivities.filter((event) => {
      const eventStart = new Date(event.startTime);
      const eventEnd = new Date(event.endTime);
      
      // Check if it's an all-day event
      const isAllDay = (
        eventStart.getHours() === 0 && 
        eventStart.getMinutes() === 0 &&
        eventEnd.getHours() === 0 &&
        eventEnd.getMinutes() === 0 &&
        eventEnd.getTime() - eventStart.getTime() >= 24 * 60 * 60 * 1000
      );
      
      // Check if the event occurs on this date
      const eventDate = new Date(eventStart);
      eventDate.setHours(0, 0, 0, 0);
      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);
      
      return isAllDay && eventDate.getTime() === targetDate.getTime();
    });
  };

  const createEvent = async (values: EventFormValues) => {
    try {
      let startTime: Date;
      let endTime: Date;

      if (values.isAllDay) {
        // For all-day events, set times to midnight
        startTime = new Date(values.date);
        startTime.setHours(0, 0, 0, 0);
        endTime = new Date(values.date);
        endTime.setDate(endTime.getDate() + 1);
        endTime.setHours(0, 0, 0, 0);
      } else {
        startTime = new Date(`${values.date}T${values.startTime}:00`);
        endTime = new Date(`${values.date}T${values.endTime}:00`);
      }

      const tripStart = startOfDay(new Date(trip.startDate));
      const tripEnd = endOfDay(new Date(trip.endDate));

      if (startTime < tripStart || (values.isAllDay ? endTime > addDays(tripEnd, 1) : endTime > tripEnd)) {
        toast({
          variant: "destructive",
          title: "Invalid dates",
          description: "Event must be within trip dates",
        });
        return;
      }

      const res = await fetch(`/api/trips/${trip.id}/activities`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
          title: values.title,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          location: values.location || null,
          description: values.description || null,
          coordinates: values.coordinates || null,
          tripId: trip.id
        }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: 'Failed to create activity' }));
        throw new Error(error.message);
      }

      const data = await res.json();
      await queryClient.invalidateQueries({ queryKey: [`/api/trips/${trip.id}/activities`] });
      
      // Sync to Google Calendar if enabled
      const googleCalendarSync = (window as any)[`googleCalendarSync_${trip.id}`];
      if (googleCalendarSync && data) {
        googleCalendarSync(data);
      }
      
      toast({ title: "Event created successfully" });
      setIsCreateDialogOpen(false);
    } catch (error) {
      console.error("Create event error:", error);
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

      await queryClient.invalidateQueries({ queryKey: [`/api/trips/${trip.id}/activities`] });
      
      // Trigger two-way sync to remove from Google Calendar
      const twoWaySync = (window as any)[`googleCalendarTwoWaySync_${trip.id}`];
      if (twoWaySync) {
        twoWaySync();
      }
      
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

  const handleResize = async (
    eventId: number,
    edge: 'top' | 'bottom' | 'move',
    newTime: Date
  ) => {
    const event = activities.find((a) => a.id === eventId);
    if (!event) return;

    // Determine new start and end times
    let newStart = new Date(event.startTime);
    let newEnd = new Date(event.endTime);

    if (edge === 'top') {
      newStart = newTime;
    } else if (edge === 'bottom') {
      newEnd = newTime;
    } else if (edge === 'move') {
      const duration = differenceInMinutes(newEnd, newStart);
      newStart = newTime;
      newEnd = new Date(newTime.getTime() + duration * 60000);
    }

    // Optimistic update so UI feels instant
    const optimisticUpdate = {
      ...event,
      startTime: newStart.toISOString(),
      endTime: newEnd.toISOString(),
    };

    queryClient.setQueryData(
      [`/api/trips/${trip.id}/activities`],
      (old: Activity[] | undefined) => {
        if (!old) return [optimisticUpdate];
        return old.map((a) => (a.id === event.id ? optimisticUpdate : a));
      }
    );

    try {
      const res = await fetch(`/api/trips/${trip.id}/activities/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: event.title,
          description: event.description,
          location: event.location,
          startTime: optimisticUpdate.startTime,
          endTime: optimisticUpdate.endTime,
          coordinates: event.coordinates || null,
        }),
      });

      if (!res.ok) throw new Error("Failed to update activity");
      const updated = await res.json();

      // Replace event in cache with updated one
      queryClient.setQueryData(
        [`/api/trips/${trip.id}/activities`],
        (old: Activity[] | undefined) => {
          if (!old) return [updated];
          return old.map((a) => (a.id === updated.id ? updated : a));
        }
      );

      // Google Calendar sync if enabled
      const googleCalendarSync = (window as any)[`googleCalendarSync_${trip.id}`];
      if (googleCalendarSync) googleCalendarSync(updated);

      toast({
        title:
          edge === "move"
            ? "Event moved successfully"
            : "Event resized successfully",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to update event",
        description:
          error instanceof Error ? error.message : "An error occurred",
      });
    }
  };


  const getCreateFormDefaults = (date: Date, hour: number): EventFormValues => {
    if (hour === -1) {
      // All-day event
      const startTime = new Date(date);
      startTime.setHours(0, 0, 0, 0);
      const endTime = new Date(date);
      endTime.setDate(endTime.getDate() + 1);
      endTime.setHours(0, 0, 0, 0);

      return {
        title: "",
        startTime: "00:00",
        endTime: "00:00",
        date: format(date, "yyyy-MM-dd"),
        location: "",
        description: "",
        participants: [],
        coordinates: null,
        isAllDay: true
      };
    }

    const startTime = new Date(date);
    startTime.setHours(hour, 0, 0, 0);
    const endTime = addHours(startTime, 1);

    return {
      title: "",
      startTime: format(startTime, "HH:mm"),
      endTime: format(endTime, "HH:mm"),
      date: format(date, "yyyy-MM-dd"),
      location: "",
      description: "",
      participants: [],
      coordinates: null,
      isAllDay: false
    };
  };

  const getEditFormDefaults = (event: ActivityWithParticipants): EventFormValues => {
    const startTime = new Date(event.startTime);
    const endTime = new Date(event.endTime);
    
    // Check if it's an all-day event
    const isAllDay = (
      startTime.getHours() === 0 && 
      startTime.getMinutes() === 0 &&
      endTime.getHours() === 0 &&
      endTime.getMinutes() === 0 &&
      endTime.getTime() - startTime.getTime() >= 24 * 60 * 60 * 1000
    );

    return {
      title: event.title,
      startTime: format(startTime, "HH:mm"),
      endTime: format(endTime, "HH:mm"),
      date: format(startTime, "yyyy-MM-dd"),
      location: event.location || "",
      description: event.description || "",
      participants: (event.participants || []).map(p => p.userId),
      coordinates: event.coordinates || null,
      isAllDay
    };
  };


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <ScrollArea className="border rounded-md max-w-full h-[calc(100vh-120px)]">
      
        <div className="min-w-fit relative">
          {/* Combined sticky header with dates and all-day section */}
          <div className="sticky top-0 z-30 bg-background">
            {/* Date headers */}
            <div className="flex border-b bg-background">
              <div className="w-16 flex-none border-r sticky left-0 z-40 bg-background p-4" />
              {dates.map((date) => (
                <div
                  key={format(date, 'yyyy-MM-dd')}
                  className="w-[300px] p-4 border-l first:border-l-0 font-semibold text-center bg-background"
                >
                  {format(date, "EEEE, MMMM d")}
                </div>
              ))}
            </div>

            {/* All-day events section */}
            <div className="flex border-b bg-background">
              <div className="w-16 flex-none border-r sticky left-0 z-40 bg-background p-2 text-sm text-muted-foreground text-right">
                All day
              </div>
            {dates.map((date) => {
              const allDayEvents = getAllDayEvents(date);
              return (
                <div
                  key={`allday-${format(date, 'yyyy-MM-dd')}`}
                  className="w-[300px] border-l first:border-l-0 p-2 min-h-[30px] relative bg-background"
                >
                  <div className="space-y-1">
                    {allDayEvents.map((event) => (
                      <div
                        key={event.id}
                        className="bg-primary text-primary-foreground rounded px-2 py-1 text-sm font-medium cursor-pointer hover:opacity-90"
                        onClick={() => {
                          setSelectedEvent(event);
                          setIsEditDialogOpen(true);
                        }}
                      >
                        {event.title}
                      </div>
                    ))}
                  </div>
                  {allDayEvents.length === 0 && (
                    <div 
                      className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer bg-blue-100 dark:bg-blue-900/30"
                      onClick={() => {
                        setSelectedTimeSlot({ date, hour: -1 }); // Use -1 to indicate all-day
                        setIsCreateDialogOpen(true);
                      }}
                    >
                      <span className="text-sm text-blue-700 dark:text-blue-300">+ Add All-Day Event</span>
                    </div>
                  )}
                </div>
              );
            })}
            </div>
          </div>

          <div className="flex">
            <div className="w-16 flex-none border-r sticky left-0 z-20 bg-background relative">
              {hours.map((hour, index) => (
                <div
                  key={hour}
                  className="h-[60px] relative"
                >
                  {/* Time label positioned on the divider line at the top - skip label for hour 0 (12 AM) */}
                  {hour > 0 && (
                    <div className="absolute top-0 right-2 transform -translate-y-1/2 bg-background px-1 text-sm text-muted-foreground text-right z-10">
                      {format(new Date().setHours(hour, 0), "h a")}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex">
              {dates.map((date) => (
                <div
                  key={format(date, 'yyyy-MM-dd')}
                  className="w-[300px] border-l first:border-l-0"
                  data-date-column={format(date, 'yyyy-MM-dd')}
                >
                  {hours.map((hour) => {
                    const timeSlotEvents = getTimeSlotEvents(date, hour);
                    const timeSlotId = `${format(date, 'yyyy-MM-dd')}|${hour}`;
                    const isOver = highlightedSlots.has(timeSlotId);

                    return (
                      <DroppableTimeSlot 
                        key={timeSlotId} 
                        id={timeSlotId} 
                        isOver={isOver} 
                        isSelected={dragSelectedSlots.has(timeSlotId)}
                        onMouseDown={(e) => handleTimeSlotMouseDown(e, date, hour)}
                        onMouseEnter={(e) => handleTimeSlotMouseEnter(e, date, hour)}
                      >
                        {timeSlotEvents.map((event) => {
                          const originalEvent = event.originalEvent || event;
                          const eventIdStr = String(originalEvent.id);
                          const originalEventId = typeof originalEvent.id === 'number' ? originalEvent.id : parseInt(eventIdStr.split('_')[0]);
                          return (
                            <DraggableEvent
                              key={event.id}
                              event={event}
                              onEdit={() => {
                                setSelectedEvent(originalEvent);
                                setIsEditDialogOpen(true);
                              }}
                              onDelete={() => deleteEvent(originalEventId)}
                              onResize={handleResize}
                            />
                          );
                        })}
                        {/* Show selection overlay during drag */}
                        {dragSelectedSlots.has(timeSlotId) && isDragSelecting && (
                          <div className="absolute inset-0 bg-blue-100 dark:bg-blue-900/30 pointer-events-none" />
                        )}
                        
                        {/* Original add event button (hidden during drag selection) */}
                        {timeSlotEvents.length === 0 && !isDragSelecting && (
                          <div 
                            className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer bg-blue-100 dark:bg-blue-900/30"
                            onClick={() => {
                              setSelectedTimeSlot({ date, hour });
                              setIsCreateDialogOpen(true);
                            }}
                          >
                            <span className="text-sm text-blue-700 dark:text-blue-300">+ Add Event</span>
                          </div>
                        )}
                      </DroppableTimeSlot>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
        

      <ScrollBar orientation="horizontal" />

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-h-[70vh] overflow-y-auto rounded-xl sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Event</DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <EventForm
              defaultValues={getEditFormDefaults(selectedEvent)}
              onSubmit={async (values) => {
                try {
                  let startTime: Date;
                  let endTime: Date;

                  if (values.isAllDay) {
                    // For all-day events, set times to midnight
                    startTime = new Date(values.date);
                    startTime.setHours(0, 0, 0, 0);
                    endTime = new Date(values.date);
                    endTime.setDate(endTime.getDate() + 1);
                    endTime.setHours(0, 0, 0, 0);
                  } else {
                    startTime = new Date(`${values.date}T${values.startTime}:00`);
                    endTime = new Date(`${values.date}T${values.endTime}:00`);
                  }

                  const res = await fetch(`/api/trips/${trip.id}/activities/${selectedEvent.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      title: values.title,
                      startTime: startTime.toISOString(),
                      endTime: endTime.toISOString(),
                      location: values.location,
                      description: values.description,
                      coordinates: values.coordinates
                    }),
                  });

                  if (!res.ok) throw new Error("Failed to update activity");

                  const updatedActivity = await res.json();
                  await queryClient.invalidateQueries({ queryKey: [`/api/trips/${trip.id}/activities`] });
                  
                  // Sync to Google Calendar if enabled
                  const googleCalendarSync = (window as any)[`googleCalendarSync_${trip.id}`];
                  if (googleCalendarSync && updatedActivity) {
                    googleCalendarSync(updatedActivity);
                  }
                  
                  toast({ title: "Event updated successfully" });
                  setIsEditDialogOpen(false);
                } catch (error) {
                  toast({
                    variant: "destructive",
                    title: "Failed to update event",
                    description: error instanceof Error ? error.message : "An error occurred",
                  });
                }
              }}
              submitLabel="Update Event"
              trip={trip}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Create dialog for drag-to-create and regular creation */}
      <Dialog 
        open={isCreateDialogOpen} 
        onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          // Clear drag selection range when dialog closes
          if (!open) {
            setDragSelectionRange(null);
          }
        }}
      >
        <DialogContent className="max-h-[70vh] overflow-y-auto rounded-xl sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Create New Event</DialogTitle>
          </DialogHeader>
          {selectedTimeSlot && (
            <EventForm
              defaultValues={
                dragSelectionRange && dragSelectionRange.date.toDateString() === selectedTimeSlot.date.toDateString()
                  ? {
                      title: "",
                      date: format(selectedTimeSlot.date, 'yyyy-MM-dd'),
                      startTime: `${dragSelectionRange.startHour.toString().padStart(2, '0')}:00`,
                      endTime: `${dragSelectionRange.endHour.toString().padStart(2, '0')}:00`,
                      location: "",
                      description: "",
                      participants: [],
                      coordinates: null,
                      isAllDay: false,
                    }
                  : getCreateFormDefaults(selectedTimeSlot.date, selectedTimeSlot.hour)
              }
              onSubmit={createEvent}
              submitLabel="Create Event"
              trip={trip}
            />
          )}
        </DialogContent>
      </Dialog>
    </ScrollArea>
  );
}