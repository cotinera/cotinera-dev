import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Clock, MapPin, GripVertical, ExternalLink, User, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axios from "axios";
import { format, parseISO, isValid } from "date-fns";
import { LocationSearchBar } from "@/components/location-search-bar";
import { IconPicker } from "@/components/icon-picker";

// DnD Kit imports
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragOverEvent,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Define the TripIdea schema for form validation
const tripIdeaSchema = z.object({
  title: z.string().min(2, { message: "Title is required" }),
  description: z.string().optional(),
  status: z.enum(["pending", "booked"]).default("pending"),
  location: z.string().optional(),
  ownerId: z.number().optional(),
  plannedDate: z.date().optional(),
  plannedTime: z.string().optional(),
  placeId: z.number().optional(),
});

// Define the PinnedPlace schema for editing
const pinnedPlaceSchema = z.object({
  name: z.string().min(1, "Name is required"),
  notes: z.string().optional(),
  category: z.string().optional(),
  icon: z.string().default('📍'),
});

// Define the Calendar Event schema for adding places to calendar
const calendarEventSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  date: z.date({ required_error: "Date is required" }),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
});

// Define types for our data
interface TripIdea {
  id: number;
  title: string;
  description?: string;
  status: "pending" | "booked";
  location?: string;
  ownerId?: number;
  ownerName?: string;
  ownerAvatar?: string;
  votes: number;
  plannedDate?: string;
  plannedTime?: string;
  createdAt: string;
  updatedAt: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  placeId?: number;
}

interface PinnedPlace {
  id: number;
  name: string;
  address: string;
  notes?: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  placeId?: string;
  tripId: number;
  destinationId?: number;
  category?: string;
  icon?: string;
  createdAt?: string;
  status: "places" | "pending" | "booked";
}

type ColumnType = "places" | "pending" | "booked";

interface Column {
  id: ColumnType;
  title: string;
  count: number;
  color: string;
  bgColor: string;
}

interface TripIdeasAndPlacesProps {
  tripId: number;
  participants: Array<{
    id: number;
    name: string;
    userId: number;
    avatar?: string;
  }>;
  tripCoordinates?: { lat: number; lng: number };
  onShowPlaceDetails?: (placeId: string) => void;
}

// Draggable Card Component
function DraggableCard({ 
  item, 
  type,
  onEditIdea,
  onEditPlace,
  onAddToCalendar,
  onShowPlaceDetails
}: { 
  item: TripIdea | PinnedPlace; 
  type: 'idea' | 'place';
  onEditIdea?: (idea: TripIdea) => void;
  onEditPlace?: (place: PinnedPlace) => void;
  onAddToCalendar?: (place: PinnedPlace) => void;
  onShowPlaceDetails?: (placeId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: `${type}-${item.id}`,
    data: { type, item }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
    opacity: isDragging ? 0.8 : 1,
    zIndex: isDragging ? 1000 : 'auto',
  };

  const isIdea = type === 'idea';
  const idea = isIdea ? (item as TripIdea) : null;
  const place = !isIdea ? (item as PinnedPlace) : null;

  const title = isIdea ? idea!.title : place!.name;
  const description = isIdea ? idea!.description : place!.notes;
  const location = isIdea ? idea!.location : place!.address;
  const createdAt = isIdea ? idea!.createdAt : place!.createdAt;
  const ownerName = isIdea ? idea!.ownerName : null;

  const handleCardClick = async (e: React.MouseEvent) => {
    // Handle clicks if we're not dragging
    if (!isDragging) {
      e.stopPropagation();
      if (isIdea && onEditIdea) {
        onEditIdea(idea!);
      } else if (!isIdea && place) {
        // For places, show details sidebar instead of edit dialog
        if (place.placeId && onShowPlaceDetails) {
          // If place has a placeId, show full details
          onShowPlaceDetails(place.placeId);
        } else if (place.coordinates && onShowPlaceDetails) {
          // If no placeId, try reverse geocoding to find it
          try {
            const geocoder = new google.maps.Geocoder();
            const result = await geocoder.geocode({ location: place.coordinates });
            
            if (result.results && result.results.length > 0) {
              const firstResult = result.results[0];
              if (firstResult.place_id) {
                onShowPlaceDetails(firstResult.place_id);
              }
            }
          } catch (error) {
            console.error('Error reverse geocoding:', error);
            // Fallback to edit dialog if reverse geocoding fails
            if (onEditPlace) {
              onEditPlace(place);
            }
          }
        } else if (onEditPlace) {
          // Fallback if no callback is provided
          onEditPlace(place);
        }
      }
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`touch-none select-none ${isDragging ? 'pointer-events-none' : ''}`}
    >
      <Card 
        className={`bg-white border border-border/50 shadow-soft hover:shadow-card transition-all duration-300 cursor-grab active:cursor-grabbing ${isDragging ? 'shadow-2xl scale-105' : ''}`}
        onClick={handleCardClick}
      >
        <div {...listeners} className="w-full h-full">
          <CardContent className="p-4 space-y-3">
          {/* Drag Handle and Title */}
          <div className="flex items-start gap-3">
            <div className="mt-1 text-muted-foreground">
              <GripVertical className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm leading-5 truncate">{title}</h4>
              {description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {description}
                </p>
              )}
            </div>
            {/* Calendar Button for Places */}
            {!isIdea && onAddToCalendar && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddToCalendar(place!);
                }}
              >
                <Calendar className="h-3 w-3" />
              </Button>
            )}
          </div>

          {/* Time/Duration Info */}
          {isIdea && (idea!.plannedTime || idea!.plannedDate) && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>
                {idea!.plannedTime || "All day"}
                {idea!.plannedDate && ` • ${format(parseISO(idea!.plannedDate), 'MMM d')}`}
              </span>
            </div>
          )}

          {/* Location */}
          {location && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground truncate">
              {!isIdea ? (
                <span className="text-xs flex-shrink-0">{place!.icon || '📍'}</span>
              ) : (
                <MapPin className="h-3 w-3 flex-shrink-0" />
              )}
              <span className="truncate">{location}</span>
            </div>
          )}


          {/* Author and Date */}
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/30">
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              <span>{ownerName || 'Anonymous'}</span>
            </div>
            {createdAt && (
              <span>
                {format(parseISO(createdAt), 'MMM d')}
              </span>
            )}
          </div>
          </CardContent>
        </div>
      </Card>
    </div>
  );
}

// Droppable Column Component
function DroppableColumn({ 
  column, 
  items, 
  type,
  onEditIdea,
  onEditPlace,
  onAddToCalendar,
  onShowPlaceDetails
}: { 
  column: Column; 
  items: (TripIdea | PinnedPlace)[]; 
  type: 'idea' | 'place';
  onEditIdea?: (idea: TripIdea) => void;
  onEditPlace?: (place: PinnedPlace) => void;
  onAddToCalendar?: (place: PinnedPlace) => void;
  onShowPlaceDetails?: (placeId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  return (
    <div 
      ref={setNodeRef}
      className={`flex flex-col min-h-0 transition-all duration-200 ${
        isOver ? 'bg-primary/5 rounded-lg' : ''
      }`}
    >
      {/* Column Header */}
      <div className={`${column.bgColor} rounded-lg p-3 mb-4`}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm text-gray-800">{column.title}</h3>
          <Badge variant="secondary" className="bg-white/50 text-gray-800 border-0">
            {column.count}
          </Badge>
        </div>
      </div>

      {/* Column Items */}
      <div className="flex-1 min-h-[200px] p-2 rounded-lg">
        <SortableContext 
          items={items.map(item => `${type}-${item.id}`)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {items.map((item) => (
              <DraggableCard 
                key={`${type}-${item.id}`}
                item={item} 
                type={type}
                onEditIdea={onEditIdea}
                onEditPlace={onEditPlace}
                onAddToCalendar={onAddToCalendar}
                onShowPlaceDetails={onShowPlaceDetails}
              />
            ))}
            {items.length === 0 && (
              <div className="h-16 border-2 border-dashed border-border/30 rounded-lg flex items-center justify-center text-muted-foreground text-sm">
                Drop items here
              </div>
            )}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}

export function TripIdeasAndPlaces({ 
  tripId, 
  participants,
  tripCoordinates,
  onShowPlaceDetails
}: TripIdeasAndPlacesProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingIdea, setEditingIdea] = useState<TripIdea | null>(null);
  const [isEditPlaceDialogOpen, setIsEditPlaceDialogOpen] = useState(false);
  const [editingPlace, setEditingPlace] = useState<PinnedPlace | null>(null);
  const [isCalendarDialogOpen, setIsCalendarDialogOpen] = useState(false);
  const [calendarPlace, setCalendarPlace] = useState<PinnedPlace | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Form for adding new ideas
  const ideaForm = useForm<z.infer<typeof tripIdeaSchema>>({
    resolver: zodResolver(tripIdeaSchema),
    defaultValues: {
      title: "",
      description: "",
      status: "pending",
      location: "",
    },
  });

  // Form for editing ideas
  const editForm = useForm<z.infer<typeof tripIdeaSchema>>({
    resolver: zodResolver(tripIdeaSchema),
    defaultValues: {
      title: "",
      description: "",
      status: "pending",
      location: "",
    },
  });

  // Form for editing places
  const editPlaceForm = useForm<z.infer<typeof pinnedPlaceSchema>>({
    resolver: zodResolver(pinnedPlaceSchema),
    defaultValues: {
      name: "",
      notes: "",
      category: "",
      icon: "📍",
    },
  });

  // Form for adding to calendar
  const calendarForm = useForm<z.infer<typeof calendarEventSchema>>({
    resolver: zodResolver(calendarEventSchema),
    defaultValues: {
      title: "",
      description: "",
      date: new Date(),
      startTime: "09:00",
      endTime: "10:00",
    },
  });

  // Sensors for drag and drop - stable configuration
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Balanced distance to prevent accidental drags
      },
    })
  );

  // Queries
  const { data: ideas = [] } = useQuery({
    queryKey: ["/api/trips", tripId, "ideas"],
    queryFn: async () => {
      const response = await axios.get(`/api/trips/${tripId}/ideas`);
      return response.data;
    },
  });

  const placesKey = ["/api/trips", tripId, "pinned-places"];
  const { data: pinnedPlacesData } = useQuery({
    queryKey: placesKey,
    queryFn: async () => {
      const response = await axios.get(`/api/trips/${tripId}/pinned-places`, {
        headers: {
          'x-dev-bypass': 'true',
          'Cache-Control': 'no-cache',
        },
        withCredentials: true,
      });
      return response.data;
    },
  });

  const pinnedPlaces = useMemo(() => {
    return pinnedPlacesData?.places || [];
  }, [pinnedPlacesData]);

  // Define columns
  const columns: Column[] = [
    {
      id: "places",
      title: "Places",
      count: pinnedPlaces.filter((place: PinnedPlace) => place.status === "places").length,
      color: "text-blue-800",
      bgColor: "bg-blue-200"
    },
    {
      id: "pending",
      title: "Pending",
      count: pinnedPlaces.filter((place: PinnedPlace) => place.status === "pending").length,
      color: "text-yellow-800",
      bgColor: "bg-yellow-200"
    },
    {
      id: "booked",
      title: "Booked", 
      count: pinnedPlaces.filter((place: PinnedPlace) => place.status === "booked").length,
      color: "text-green-800",
      bgColor: "bg-green-200"
    }
  ];

  // Get items for each column
  const getColumnItems = (columnId: ColumnType) => {
    return pinnedPlaces.filter((place: PinnedPlace) => place.status === columnId);
  };

  // Mutations
  const addIdeaMutation = useMutation({
    mutationFn: async (data: z.infer<typeof tripIdeaSchema>) => {
      const response = await axios.post(`/api/trips/${tripId}/ideas`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId, "ideas"] });
      setIsAddDialogOpen(false);
      ideaForm.reset();
      toast({
        title: "Success",
        description: "Idea added successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add idea. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateIdeaStatusMutation = useMutation({
    mutationFn: async ({ ideaId, status }: { ideaId: number; status: string }) => {
      console.log('Sending PATCH request:', { ideaId, status, url: `/api/trips/${tripId}/ideas/${ideaId}` });
      const response = await axios.patch(`/api/trips/${tripId}/ideas/${ideaId}`, { status }, {
        headers: {
          'x-dev-bypass': 'true'
        }
      });
      console.log('PATCH response:', response.data);
      return response.data;
    },
    onSuccess: (data) => {
      console.log('Update success:', data);
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId, "ideas"] });
      toast({
        title: "Success",
        description: "Idea moved successfully!",
      });
    },
    onError: (error: any) => {
      console.error('Update error:', error);
      console.error('Error response:', error.response?.data);
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to update idea status",
        variant: "destructive",
      });
    },
  });

  const updateIdeaMutation = useMutation({
    mutationFn: async ({ ideaId, data }: { ideaId: number; data: z.infer<typeof tripIdeaSchema> }) => {
      const response = await axios.patch(`/api/trips/${tripId}/ideas/${ideaId}`, data, {
        headers: {
          'x-dev-bypass': 'true'
        }
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId, "ideas"] });
      setIsEditDialogOpen(false);
      setEditingIdea(null);
      editForm.reset();
      toast({
        title: "Success",
        description: "Idea updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to update idea",
        variant: "destructive",
      });
    },
  });

  const updatePlaceMutation = useMutation({
    mutationFn: async ({ placeId, data }: { placeId: number; data: z.infer<typeof pinnedPlaceSchema> }) => {
      const response = await axios.patch(`/api/trips/${tripId}/pinned-places/${placeId}`, data, {
        headers: {
          'x-dev-bypass': 'true'
        }
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: placesKey });
      setIsEditPlaceDialogOpen(false);
      setEditingPlace(null);
      editPlaceForm.reset();
      toast({
        title: "Success",
        description: "Place updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to update place",
        variant: "destructive",
      });
    },
  });

  const addToCalendarMutation = useMutation({
    mutationFn: async (data: z.infer<typeof calendarEventSchema> & { coordinates?: { lat: number; lng: number }; location?: string }) => {
      const { date, startTime, endTime, ...rest } = data;
      
      // Convert date and times to proper ISO strings
      const startDateTime = new Date(`${date.toISOString().split('T')[0]}T${startTime}:00`);
      const endDateTime = new Date(`${date.toISOString().split('T')[0]}T${endTime}:00`);
      
      const activityData = {
        ...rest,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
      };
      
      const response = await axios.post(`/api/trips/${tripId}/activities`, activityData);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId, "activities"] });
      setIsCalendarDialogOpen(false);
      setCalendarPlace(null);
      calendarForm.reset();
      toast({
        title: "Success",
        description: "Event added to calendar successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to add event to calendar",
        variant: "destructive",
      });
    },
  });

  const updatePlaceStatusMutation = useMutation({
    mutationFn: async ({ placeId, status }: { placeId: number; status: "places" | "pending" | "booked" }) => {
      console.log('Updating place status:', { placeId, status });
      const response = await axios.patch(`/api/trips/${tripId}/pinned-places/${placeId}`, { status }, {
        headers: {
          'x-dev-bypass': 'true'
        }
      });
      return response.data;
    },
    onMutate: async ({ placeId, status }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: placesKey });
      
      // Snapshot the previous value
      const previousData = queryClient.getQueryData(placesKey);
      
      // Optimistically update to the new status
      queryClient.setQueryData(placesKey, (old: any) => {
        if (!old || !old.places) return old;
        
        return {
          ...old,
          places: old.places.map((place: PinnedPlace) => 
            place.id === placeId ? { ...place, status } : place
          )
        };
      });
      
      // Return a context object with the snapshotted value
      return { previousData };
    },
    onError: (err, variables, context) => {
      // If the mutation fails, use the context to roll back
      if (context?.previousData) {
        queryClient.setQueryData(placesKey, context.previousData);
      }
      
      console.error('Update place status error:', err);
      toast({
        title: "Error",
        description: (err as any).response?.data?.error || "Failed to update place status",
        variant: "destructive",
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Place moved successfully!",
      });
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: placesKey });
    },
  });

  const deletePlaceMutation = useMutation({
    mutationFn: async (placeId: number) => {
      const response = await axios.delete(`/api/trips/${tripId}/pinned-places/${placeId}`, {
        headers: {
          'x-dev-bypass': 'true'
        }
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: placesKey });
      setIsEditPlaceDialogOpen(false);
      setEditingPlace(null);
      toast({
        title: "Success",
        description: "Place deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to delete place",
        variant: "destructive",
      });
    },
  });

  const deleteIdeaMutation = useMutation({
    mutationFn: async (ideaId: number) => {
      const response = await axios.delete(`/api/trips/${tripId}/ideas/${ideaId}`, {
        headers: {
          'x-dev-bypass': 'true'
        }
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId, "ideas"] });
      setIsEditDialogOpen(false);
      setEditingIdea(null);
      toast({
        title: "Success",
        description: "Idea deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to delete idea",
        variant: "destructive",
      });
    },
  });

  // Create idea from pinned place mutation
  const createIdeaFromPlaceMutation = useMutation({
    mutationFn: async (data: {
      title: string;
      description: string;
      status: "pending" | "booked";
      location: string;
      coordinates: { lat: number; lng: number };
      placeId: number;
    }) => {
      const response = await axios.post(`/api/trips/${tripId}/ideas`, data, {
        headers: {
          'x-dev-bypass': 'true'
        }
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId, "ideas"] });
      toast({
        title: "Success",
        description: "Place added to trip ideas!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to create idea from place",
        variant: "destructive",
      });
    },
  });

  // Calendar handlers
  const handleAddToCalendar = (place: PinnedPlace) => {
    setCalendarPlace(place);
    calendarForm.reset({
      title: place.name,
      description: place.notes || "",
      date: new Date(),
      startTime: "09:00",
      endTime: "10:00",
    });
    setIsCalendarDialogOpen(true);
  };

  const handleCalendarSubmit = (data: z.infer<typeof calendarEventSchema>) => {
    if (calendarPlace) {
      addToCalendarMutation.mutate({
        ...data,
        location: calendarPlace.address,
        coordinates: calendarPlace.coordinates,
      });
    }
  };

  // Drag and drop handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    console.log('Drag started:', event.active.id);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    setOverId(over ? over.id as string : null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);

    console.log('Drag ended:', { active: active.id, over: over?.id });

    if (!over) {
      console.log('No valid drop target');
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    // Parse the active item
    const [activeType, activeItemId] = activeId.split('-');
    
    // Only handle place dragging now
    if (activeType !== 'place') {
      console.log('Only places can be dragged');
      return;
    }

    const placeId = parseInt(activeItemId);
    const place = pinnedPlaces.find((p: PinnedPlace) => p.id === placeId);
    
    if (!place) {
      console.log('Place not found:', placeId);
      return;
    }

    // Determine target column
    let targetColumn: ColumnType;
    
    if (['places', 'pending', 'booked'].includes(overId)) {
      targetColumn = overId as ColumnType;
    } else if (overId.includes('-')) {
      const [overType, overItemId] = overId.split('-');
      if (overType === 'place') {
        // Find the place and get its status
        const overPlace = pinnedPlaces.find((place: PinnedPlace) => place.id.toString() === overItemId);
        targetColumn = overPlace?.status || 'places';
      } else {
        return;
      }
    } else {
      return;
    }

    if (place.status === targetColumn) {
      console.log('Place already in target column');
      return;
    }

    console.log('Updating place status:', { placeId, from: place.status, to: targetColumn });
    
    updatePlaceStatusMutation.mutate({
      placeId,
      status: targetColumn
    });
  };

  const onAddIdeaSubmit = (data: z.infer<typeof tripIdeaSchema>) => {
    addIdeaMutation.mutate(data);
  };

  const onEditIdeaSubmit = (data: z.infer<typeof tripIdeaSchema>) => {
    if (editingIdea) {
      updateIdeaMutation.mutate({ ideaId: editingIdea.id, data });
    }
  };

  const onEditPlaceSubmit = (data: z.infer<typeof pinnedPlaceSchema>) => {
    if (editingPlace) {
      updatePlaceMutation.mutate({ placeId: editingPlace.id, data });
    }
  };

  const onDeletePlace = () => {
    if (editingPlace && window.confirm("Are you sure you want to delete this place?")) {
      deletePlaceMutation.mutate(editingPlace.id);
    }
  };

  const handleEditIdea = (idea: TripIdea) => {
    setEditingIdea(idea);
    editForm.reset({
      title: idea.title,
      description: idea.description || "",
      status: idea.status,
      location: idea.location || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleEditPlace = (place: PinnedPlace) => {
    setEditingPlace(place);
    editPlaceForm.reset({
      name: place.name,
      notes: place.notes || "",
      category: place.category || "",
      icon: place.icon || "📍",
    });
    setIsEditPlaceDialogOpen(true);
  };

  // Get active item for drag overlay
  const activeItem = activeId ? (() => {
    const [type, itemId] = activeId.split('-');
    if (type === 'idea') {
      return ideas.find((idea: TripIdea) => idea.id.toString() === itemId);
    } else {
      return pinnedPlaces.find((place: PinnedPlace) => place.id.toString() === itemId);
    }
  })() : null;

  const activeType = activeId?.split('-')[0] as 'idea' | 'place' | undefined;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-adventure bg-clip-text text-transparent">
            Trip Ideas & Places
          </h2>
          <p className="text-muted-foreground mt-1">
            Organize your ideas with drag-and-drop between categories
          </p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="adventure" className="shadow-soft">
              <Plus className="h-4 w-4 mr-2" />
              Add Idea
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Idea</DialogTitle>
            </DialogHeader>
            <Form {...ideaForm}>
              <form onSubmit={ideaForm.handleSubmit(onAddIdeaSubmit)} className="space-y-4">
                <FormField
                  control={ideaForm.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter idea title..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={ideaForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Describe your idea..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={ideaForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="booked">Booked</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={ideaForm.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <FormControl>
                        <LocationSearchBar
                          placeholder="Search for a location..."
                          value={field.value || ""}
                          onChange={(address, coordinates, name) => {
                            field.onChange(address);
                          }}
                          searchBias={tripCoordinates ? {
                            lat: tripCoordinates.lat,
                            lng: tripCoordinates.lng,
                            radius: 50000 // 50km radius bias
                          } : undefined}
                          className="w-full"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="adventure">
                    Add Idea
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Edit Idea Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Idea</DialogTitle>
            </DialogHeader>
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(onEditIdeaSubmit)} className="space-y-4">
                <FormField
                  control={editForm.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter idea title..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Describe your idea..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="booked">Booked</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <FormControl>
                        <LocationSearchBar
                          placeholder="Search for a location..."
                          value={field.value || ""}
                          onChange={(address, coordinates, name) => {
                            field.onChange(address);
                          }}
                          searchBias={tripCoordinates ? {
                            lat: tripCoordinates.lat,
                            lng: tripCoordinates.lng,
                            radius: 50000 // 50km radius bias
                          } : undefined}
                          className="w-full"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-between space-x-2">
                  <Button 
                    type="button" 
                    variant="destructive" 
                    onClick={() => {
                      if (editingIdea && window.confirm("Are you sure you want to delete this idea?")) {
                        deleteIdeaMutation.mutate(editingIdea.id);
                      }
                    }}
                    disabled={deleteIdeaMutation?.isPending}
                  >
                    {deleteIdeaMutation?.isPending ? "Deleting..." : "Delete Idea"}
                  </Button>
                  <div className="flex space-x-2">
                    <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      variant="adventure"
                      disabled={updateIdeaMutation.isPending}
                    >
                      {updateIdeaMutation.isPending ? "Updating..." : "Update Idea"}
                    </Button>
                  </div>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Edit Place Dialog */}
        <Dialog open={isEditPlaceDialogOpen} onOpenChange={setIsEditPlaceDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Place</DialogTitle>
            </DialogHeader>
            <Form {...editPlaceForm}>
              <form onSubmit={editPlaceForm.handleSubmit(onEditPlaceSubmit)} className="space-y-4">
                <FormField
                  control={editPlaceForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter place name..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editPlaceForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Add notes about this place..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editPlaceForm.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="restaurant">Restaurant</SelectItem>
                          <SelectItem value="attraction">Attraction</SelectItem>
                          <SelectItem value="hotel">Hotel</SelectItem>
                          <SelectItem value="shopping">Shopping</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editPlaceForm.control}
                  name="icon"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Icon</FormLabel>
                      <FormControl>
                        <IconPicker 
                          selectedIcon={field.value} 
                          onIconSelect={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-between space-x-2">
                  <Button 
                    type="button" 
                    variant="destructive" 
                    onClick={onDeletePlace}
                    disabled={deletePlaceMutation.isPending}
                  >
                    {deletePlaceMutation.isPending ? "Deleting..." : "Delete Place"}
                  </Button>
                  <div className="flex space-x-2">
                    <Button type="button" variant="outline" onClick={() => setIsEditPlaceDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      variant="adventure"
                      disabled={updatePlaceMutation.isPending}
                    >
                      {updatePlaceMutation.isPending ? "Updating..." : "Update Place"}
                    </Button>
                  </div>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Add to Calendar Dialog */}
        <Dialog open={isCalendarDialogOpen} onOpenChange={setIsCalendarDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add to Calendar</DialogTitle>
            </DialogHeader>
            <Form {...calendarForm}>
              <form onSubmit={calendarForm.handleSubmit(handleCalendarSubmit)} className="space-y-4">
                <FormField
                  control={calendarForm.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Event Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter event title..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={calendarForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Add event description..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={calendarForm.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={`w-full pl-3 text-left font-normal ${!field.value && "text-muted-foreground"}`}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <Calendar className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarUI
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                              date < new Date() || date < new Date("1900-01-01")
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={calendarForm.control}
                    name="startTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Time</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={calendarForm.control}
                    name="endTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Time</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                {calendarPlace && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Location:</p>
                    <p className="text-sm font-medium">{calendarPlace.address}</p>
                  </div>
                )}
                <div className="flex justify-end space-x-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsCalendarDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    variant="adventure"
                    disabled={addToCalendarMutation.isPending}
                  >
                    {addToCalendarMutation.isPending ? "Adding..." : "Add to Calendar"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Kanban Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {columns.map((column) => (
            <DroppableColumn
              key={column.id}
              column={column}
              items={getColumnItems(column.id)}
              type="place"
              onEditPlace={handleEditPlace}
              onAddToCalendar={handleAddToCalendar}
              onShowPlaceDetails={onShowPlaceDetails}
            />
          ))}
        </div>

        <DragOverlay>
          {activeItem && activeType && (
            <div className="transform rotate-3 scale-105 shadow-2xl">
              <DraggableCard item={activeItem} type={activeType} />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}