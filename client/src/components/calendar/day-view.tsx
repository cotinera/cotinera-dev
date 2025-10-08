import {
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DragOverlay,
} from "@dnd-kit/core";
import type { Trip, Activity, User } from "@db/schema";
import { Pencil, Trash2, Loader2, Users } from "lucide-react";
import { CSS } from "@dnd-kit/utilities";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPicker } from "@/components/map-picker";

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

function snapToQuarterHour(date: Date): Date {
  const minutes = date.getMinutes();
  const snappedMinutes = Math.round(minutes / 15) * 15;
  return new Date(date.setMinutes(snappedMinutes, 0, 0));
}

function pixelsToMinutes(pixels: number): number {
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
  onDragStart,
}: {
  event: Activity & { isSegment?: boolean; originalEvent?: Activity };
  onEdit: () => void;
  onDelete: () => void;
  onResize: (eventId: number, edge: 'top' | 'bottom', newTime: Date) => void;
  onDragStart?: (clickOffsetY: number, originalTopPixels: number, originalEvent: Activity) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: event.id.toString(),
  });

  const [isResizing, setIsResizing] = useState(false);
  const [resizeEdge, setResizeEdge] = useState<'top' | 'bottom' | null>(null);
  const [previewHeight, setPreviewHeight] = useState<number | null>(null);
  const [previewTop, setPreviewTop] = useState<number | null>(null);
  const [previewStart, setPreviewStart] = useState<Date | null>(null);
  const [previewEnd, setPreviewEnd] = useState<Date | null>(null);
  
  const elementRef = useRef<HTMLDivElement>(null);
  const initialMouseYRef = useRef<number>(0);
  const initialTopOffsetRef = useRef<number>(0);
  const initialEventRef = useRef<Activity>(event);

  const eventStart = new Date(event.startTime);
  const eventEnd = new Date(event.endTime);
  const durationInMinutes = differenceInMinutes(eventEnd, eventStart);
  const heightInPixels = Math.max((durationInMinutes / 60) * 48, 12);

  const handleResizeStart = (e: React.MouseEvent, edge: 'top' | 'bottom') => {
    e.preventDefault();
    e.stopPropagation();

    setIsResizing(true);
    setResizeEdge(edge);
    initialMouseYRef.current = e.clientY;
    initialEventRef.current = event;
    
    const minutesFromMidnight = eventStart.getHours() * 60 + eventStart.getMinutes();
    const topOffset = (minutesFromMidnight / 60) * 48;
    initialTopOffsetRef.current = topOffset;
    
    setPreviewHeight(heightInPixels);
    setPreviewTop(topOffset);
    setPreviewStart(eventStart);
    setPreviewEnd(eventEnd);
  };

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !resizeEdge) return;

    e.preventDefault();
    const deltaY = e.clientY - initialMouseYRef.current;
    const deltaMinutes = Math.round((deltaY / 48) * 60 / 15) * 15;

    if (resizeEdge === 'top') {
      const originalStartTime = new Date(initialEventRef.current.startTime);
      const originalEndTime = new Date(initialEventRef.current.endTime);
      const newStartTime = new Date(originalStartTime.getTime() + deltaMinutes * 60 * 1000);
      
      const maxStartTime = new Date(originalEndTime.getTime() - 15 * 60 * 1000);
      
      if (newStartTime <= maxStartTime) {
        const newDurationMinutes = differenceInMinutes(originalEndTime, newStartTime);
        const newHeight = Math.max((newDurationMinutes / 60) * 48, 12);
        const minutesFromMidnight = newStartTime.getHours() * 60 + newStartTime.getMinutes();
        const newTopOffset = (minutesFromMidnight / 60) * 48;
        
        setPreviewHeight(newHeight);
        setPreviewTop(newTopOffset);
        setPreviewStart(newStartTime);
        setPreviewEnd(originalEndTime);
      }
    } else {
      const originalEndTime = new Date(initialEventRef.current.endTime);
      const originalStartTime = new Date(initialEventRef.current.startTime);
      const newEndTime = new Date(originalEndTime.getTime() + deltaMinutes * 60 * 1000);
      
      const minEndTime = new Date(originalStartTime.getTime() + 15 * 60 * 1000);
      
      if (newEndTime >= minEndTime) {
        const newDurationMinutes = differenceInMinutes(newEndTime, originalStartTime);
        const newHeight = Math.max((newDurationMinutes / 60) * 48, 12);
        
        setPreviewHeight(newHeight);
        setPreviewStart(originalStartTime);
        setPreviewEnd(newEndTime);
      }
    }
  }, [isResizing, resizeEdge]);

  const handleResizeEnd = useCallback(() => {
    if (isResizing && resizeEdge && previewStart && previewEnd) {
      const originalEvent = event.originalEvent || event;
      const eventIdStr = String(originalEvent.id);
      const originalEventId = typeof originalEvent.id === 'number' ? originalEvent.id : parseInt(eventIdStr.split('_')[0]);
      
      if (resizeEdge === 'top') {
        onResize(originalEventId, 'top', previewStart);
      } else if (resizeEdge === 'bottom') {
        onResize(originalEventId, 'bottom', previewEnd);
      }
    }
    
    setIsResizing(false);
    setResizeEdge(null);
  }, [isResizing, resizeEdge, previewStart, previewEnd, onResize, event]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleResizeMove);
      window.addEventListener('mouseup', handleResizeEnd);
      return () => {
        window.removeEventListener('mousemove', handleResizeMove);
        window.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [isResizing, resizeEdge, handleResizeMove, handleResizeEnd]);

  useEffect(() => {
    if (!isResizing && previewStart && previewEnd) {
      const currentStart = new Date(event.startTime);
      const currentEnd = new Date(event.endTime);
      
      if (
        Math.abs(currentStart.getTime() - previewStart.getTime()) < 1000 &&
        Math.abs(currentEnd.getTime() - previewEnd.getTime()) < 1000
      ) {
        setPreviewHeight(null);
        setPreviewTop(null);
        setPreviewStart(null);
        setPreviewEnd(null);
      }
    }
  }, [event.startTime, event.endTime, isResizing, previewStart, previewEnd]);

  const displayHeight = previewHeight ?? heightInPixels;
  const displayStart = previewStart ?? eventStart;
  const displayEnd = previewEnd ?? eventEnd;

  const minutesFromMidnight = displayStart.getHours() * 60 + displayStart.getMinutes();
  const calculatedTopOffset = (minutesFromMidnight / 60) * 48;
  const topOffset = previewTop ?? calculatedTopOffset;

  const style: React.CSSProperties = {
    width: '90%',
    height: `${displayHeight}px`,
    position: 'absolute',
    left: '0',
    top: `${topOffset}px`,
    backgroundColor: isResizing ? 'hsl(var(--primary)/0.8)' : undefined,
    boxShadow: isDragging || isResizing ? 'var(--shadow-md)' : undefined,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging || isResizing ? 50 : 1,
    cursor: isResizing ? 'ns-resize' : 'move',
    transition: isResizing ? 'none' : undefined,
  };

  const combinedRef = (el: HTMLDivElement | null) => {
    if (!isResizing) setNodeRef(el);
    if (elementRef.current !== el) {
      (elementRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
    }
  };

  // Store the initial click position to determine if it's a click or drag
  const clickRef = useRef<{ x: number; y: number } | null>(null);
  const [mouseDown, setMouseDown] = useState(false);
  
  // Handle mousedown to detect the start of a potential click or drag
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isResizing) return;
    clickRef.current = { x: e.clientX, y: e.clientY };
    setMouseDown(true);
    
    // Capture click offset for drag behavior fix
    if (onDragStart && elementRef.current) {
      const rect = elementRef.current.getBoundingClientRect();
      const clickOffsetY = e.clientY - rect.top;
      
      // Calculate original top position in pixels based on event start time
      const eventStart = new Date(event.startTime);
      const minutesFromMidnight = eventStart.getHours() * 60 + eventStart.getMinutes();
      const originalTopPixels = (minutesFromMidnight / 60) * 48;
      
      // Get the original event (not a segment)
      const originalEvent = event.originalEvent || event;
      
      onDragStart(clickOffsetY, originalTopPixels, originalEvent);
    }
  };
  
  // Handle mouseup to detect if it was a click (not much movement) or a drag
  const handleMouseUp = (e: React.MouseEvent) => {
    if (!clickRef.current || isResizing || isDragging) return;
    
    const deltaX = Math.abs(e.clientX - clickRef.current.x);
    const deltaY = Math.abs(e.clientY - clickRef.current.y);
    
    // If minimal movement (less than 5px) and not dragging, treat as a click and open edit
    if (deltaX < 5 && deltaY < 5 && mouseDown && !isDragging) {
      onEdit();
    }
    
    setMouseDown(false);
    clickRef.current = null;
  };

  return (
    <div
      ref={combinedRef}
      {...(!isResizing ? { ...attributes, ...listeners } : {})}
      style={style}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      className={`bg-blue-500/90 hover:bg-blue-600/90 rounded-sm group/event ${
        isDragging ? 'ring-1 ring-primary/50' : ''
      } ${!isResizing && !isDragging ? 'cursor-pointer' : ''}`}
    >
      <div
        className="absolute top-0 left-0 w-full h-2 cursor-ns-resize hover:bg-black/30 transition-colors"
        onMouseDown={(e) => handleResizeStart(e, 'top')}
      />

      <div className="relative h-[18px] px-2 mt-1">
        <span className="font-medium text-sm text-white truncate max-w-[180px] block">{event.title}</span>
        <div className="absolute right-2 top-0 hidden group-hover/event:flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-white hover:bg-white/20"
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
            className="h-6 w-6 text-white hover:bg-white/20 hover:text-red-300"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <span className="text-xs text-white/80 block px-2">
        {format(displayStart, "h:mm a")} - {format(displayEnd, "h:mm a")}
      </span>

      <div
        className="absolute bottom-0 left-0 w-full h-2 cursor-ns-resize hover:bg-black/30 transition-colors"
        onMouseDown={(e) => handleResizeStart(e, 'bottom')}
      />
    </div>
  );
}

function DroppableTimeSlot({
  id,
  isOver,
  isDragging,
  isSelected,
  onMouseDown,
  onMouseEnter,
  children,
}: {
  id: string;
  isOver: boolean;
  isDragging: boolean;
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
      className={`h-12 relative border-t transition-colors ${
        isOver ? 'bg-primary/20' : ''
      } ${
        isSelected ? 'bg-blue-100 dark:bg-blue-900/30' : ''
      } hover:bg-blue-50 dark:hover:bg-blue-900/20`}
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
  trip: Trip;
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
    .filter((user): user is User => !!user);

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
                    value={field.value}
                    onChange={(address, coordinates) => {
                      field.onChange(address);
                      if (coordinates) {
                        form.setValue('coordinates', coordinates);
                      }
                    }}
                    placeholder="Search for a location..."
                    initialCenter={form.getValues('coordinates') || trip.coordinates}
                    searchBias={trip.coordinates}
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
              <Select
                defaultValue={field.value.map(String)}
                onValueChange={(values) => {
                  field.onChange(values.map(Number));
                }}
                multiple
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select participants" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {participants.map((participant) => (
                    <SelectItem
                      key={participant.id}
                      value={participant.id.toString()}
                    >
                      {participant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
export function DayView({ trip }: { trip: Trip }) {
  const [newEventTitle, setNewEventTitle] = useState("");
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Activity | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [activeDropId, setActiveDropId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedEvent, setDraggedEvent] = useState<Activity | null>(null);
  const [highlightedSlots, setHighlightedSlots] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Store drag metadata to fix positioning
  const dragMetadataRef = useRef<{
    clickOffsetY: number;
    originalTopPixels: number;
    originalEvent: Activity;
  } | null>(null);
  
  // Drag selection state
  const [isDragSelecting, setIsDragSelecting] = useState(false);
  const [dragStartSlot, setDragStartSlot] = useState<{ date: Date; hour: number } | null>(null);
  const [dragEndSlot, setDragEndSlot] = useState<{ date: Date; hour: number } | null>(null);
  const [dragSelectedSlots, setDragSelectedSlots] = useState<Set<string>>(new Set());
  
  // Store the drag selection range for the create dialog
  const [dragSelectionRange, setDragSelectionRange] = useState<{ startHour: number; endHour: number; date: Date } | null>(null);

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

  const handleDragStart = (event: DragStartEvent) => {
    setIsDragging(true);
    document.body.classList.add('select-none');
    
    // Find the dragged event
    const draggedId = event.active.id as string;
    const splitEvent = splitActivities.find((a) => a.id.toString() === draggedId);
    if (splitEvent) {
      const originalEvent = splitEvent.originalEvent || splitEvent;
      setDraggedEvent(originalEvent);
    }
  };
  
  // Callback to capture drag metadata from DraggableEvent
  const handleEventDragStart = (clickOffsetY: number, originalTopPixels: number, originalEvent: Activity) => {
    dragMetadataRef.current = {
      clickOffsetY,
      originalTopPixels,
      originalEvent,
    };
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (over && draggedEvent) {
      const dropId = over.id as string;
      setActiveDropId(dropId);
      
      // Calculate event duration in hours (rounded up to nearest hour)
      const eventStart = new Date(draggedEvent.startTime);
      const eventEnd = new Date(draggedEvent.endTime);
      const durationInMinutes = differenceInMinutes(eventEnd, eventStart);
      const durationInHours = Math.ceil(durationInMinutes / 60);
      
      // Parse the drop target to get date and hour
      const [dateStr, hourStr] = dropId.split("|");
      const dropHour = parseInt(hourStr);
      
      // Calculate which slots to highlight based on event duration
      const slotsToHighlight = new Set<string>();
      for (let i = 0; i < durationInHours; i++) {
        const slotHour = dropHour + i;
        if (slotHour < 24) { // Don't exceed 24 hours in a day
          slotsToHighlight.add(`${dateStr}|${slotHour}`);
        }
      }
      
      setHighlightedSlots(slotsToHighlight);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const metadata = dragMetadataRef.current;
    
    setIsDragging(false);
    document.body.classList.remove('select-none');
    setActiveDropId(null);
    setDraggedEvent(null);
    setHighlightedSlots(new Set());
    dragMetadataRef.current = null;

    if (!event.over || !metadata) return;

    const [dateStr] = (event.over.id as string).split("|");

    // Use metadata to get the original event
    const originalEvent = metadata.originalEvent;
    const originalStart = new Date(originalEvent.startTime);
    const originalEnd = new Date(originalEvent.endTime);
    const fullDurationInMinutes = differenceInMinutes(originalEnd, originalStart);

    // Calculate new top position using delta.y (which already accounts for movement)
    const newTopPixels = metadata.originalTopPixels + event.delta.y;
    
    // Convert pixels to minutes (48px = 1 hour = 60 minutes)
    const newMinutesFromMidnight = Math.round((newTopPixels / 48) * 60 / 15) * 15; // Snap to 15 minutes
    
    // Ensure within valid range (0-1440 minutes in a day)
    const clampedMinutes = Math.max(0, Math.min(1440 - fullDurationInMinutes, newMinutesFromMidnight));
    
    // Create new start time with the calculated minutes (parse as local date to avoid timezone shift)
    const droppedDate = parse(dateStr, 'yyyy-MM-dd', new Date());
    const newStartTime = new Date(droppedDate);
    newStartTime.setHours(0, 0, 0, 0);
    newStartTime.setMinutes(clampedMinutes);
    
    const newEndTime = new Date(newStartTime.getTime() + fullDurationInMinutes * 60 * 1000);

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

    // Check if position actually changed
    if (originalStart.getTime() === newStartTime.getTime()) {
      return; // No change, don't update
    }

    // Create optimistic update
    const optimisticUpdate = {
      ...originalEvent,
      startTime: newStartTime.toISOString(),
      endTime: newEndTime.toISOString(),
    };

    // Apply optimistic update to cache immediately
    queryClient.setQueryData(
      [`/api/trips/${trip.id}/activities`],
      (old: Activity[] | undefined) => {
        if (!old) return [optimisticUpdate];
        return old.map(activity => 
          activity.id === originalEvent.id ? optimisticUpdate : activity
        );
      }
    );

    try {
      const res = await fetch(`/api/trips/${trip.id}/activities/${originalEvent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: originalEvent.title,
          description: originalEvent.description,
          location: originalEvent.location,
          startTime: newStartTime.toISOString(),
          endTime: newEndTime.toISOString(),
          coordinates: originalEvent.coordinates || null,
        }),
      });

      if (!res.ok) {
        // Revert optimistic update on error
        queryClient.setQueryData(
          [`/api/trips/${trip.id}/activities`],
          (old: Activity[] | undefined) => {
            if (!old) return [originalEvent];
            return old.map(activity => 
              activity.id === originalEvent.id ? originalEvent : activity
            );
          }
        );
        throw new Error("Failed to update activity");
      }

      const updatedActivity = await res.json();
      
      // Update cache with server response
      queryClient.setQueryData(
        [`/api/trips/${trip.id}/activities`],
        (old: Activity[] | undefined) => {
          if (!old) return [updatedActivity];
          return old.map(activity => 
            activity.id === updatedActivity.id ? updatedActivity : activity
          );
        }
      );
      
      // Sync updated activity to Google Calendar
      const googleCalendarSync = (window as any)[`googleCalendarSync_${trip.id}`];
      if (googleCalendarSync && updatedActivity) {
        googleCalendarSync(updatedActivity);
      }
      
      toast({ title: "Event moved successfully" });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to move event",
        description: error instanceof Error ? error.message : "An error occurred",
      });
    }
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

  const handleResize = async (eventId: number, edge: 'top' | 'bottom', newTime: Date) => {
    const event = activities.find((a) => a.id === eventId);
    if (!event) return;

    const optimisticUpdate = {
      ...event,
      startTime: edge === 'top' ? newTime.toISOString() : event.startTime,
      endTime: edge === 'bottom' ? newTime.toISOString() : event.endTime,
    };

    queryClient.setQueryData(
      [`/api/trips/${trip.id}/activities`],
      (old: Activity[] | undefined) => {
        if (!old) return [optimisticUpdate];
        return old.map(activity => 
          activity.id === event.id ? optimisticUpdate : activity
        );
      }
    );

    const updateData = {
      title: event.title,
      description: event.description,
      location: event.location,  
      startTime: optimisticUpdate.startTime,
      endTime: optimisticUpdate.endTime,
      coordinates: event.coordinates || null,
    };

    try {
      const res = await fetch(`/api/trips/${trip.id}/activities/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });

      if (!res.ok) {
        queryClient.setQueryData(
          [`/api/trips/${trip.id}/activities`],
          (old: Activity[] | undefined) => {
            if (!old) return [event];
            return old.map(activity => 
              activity.id === event.id ? event : activity
            );
          }
        );
        throw new Error("Failed to update activity");
      }

      const updatedActivity = await res.json();
      
      queryClient.setQueryData(
        [`/api/trips/${trip.id}/activities`],
        (old: Activity[] | undefined) => {
          if (!old) return [updatedActivity];
          return old.map(activity => 
            activity.id === updatedActivity.id ? updatedActivity : activity
          );
        }
      );
      
      const googleCalendarSync = (window as any)[`googleCalendarSync_${trip.id}`];
      if (googleCalendarSync && updatedActivity) {
        googleCalendarSync(updatedActivity);
      }
      
      toast({ title: "Event resized successfully" });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to resize event",
        description: error instanceof Error ? error.message : "An error occurred",
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

  const getEditFormDefaults = (event: Activity): EventFormValues => {
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
      participants: event.participants?.map(p => p.userId) || [],
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
      
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
      >
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
                  className="h-12 relative"
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
                        isDragging={isDragging}
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
                              onDragStart={handleEventDragStart}
                            />
                          );
                        })}
                        {/* Show selection overlay during drag */}
                        {dragSelectedSlots.has(timeSlotId) && isDragSelecting && (
                          <div className="absolute inset-0 bg-blue-100 dark:bg-blue-900/30 pointer-events-none" />
                        )}
                        
                        {/* Original add event button (hidden during drag selection) */}
                        {timeSlotEvents.length === 0 && !isDragging && !isDragSelecting && (
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
        
        <DragOverlay>
          {draggedEvent && (
            <div 
              className="bg-primary text-primary-foreground rounded-sm p-2 text-sm font-medium shadow-lg border"
              style={{
                width: '270px', // Match the calendar column width minus padding
                height: `${Math.max((differenceInMinutes(new Date(draggedEvent.endTime), new Date(draggedEvent.startTime)) / 60) * 48, 48)}px`,
                opacity: 0.95
              }}
            >
              <div className="truncate font-medium">
                {draggedEvent.title}
              </div>
              <div className="text-xs opacity-90 mt-1">
                {format(new Date(draggedEvent.startTime), "h:mm a")} - {format(new Date(draggedEvent.endTime), "h:mm a")}
              </div>
              {draggedEvent.location && (
                <div className="text-xs opacity-75 mt-1 truncate">
                  📍 {draggedEvent.location}
                </div>
              )}
            </div>
          )}
        </DragOverlay>
      </DndContext>
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