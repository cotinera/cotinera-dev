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
import { Plus, Clock, MapPin, GripVertical, ExternalLink, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axios from "axios";
import { format, parseISO, isValid } from "date-fns";

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
  status: z.enum(["pending", "booked", "unsure"]).default("pending"),
  location: z.string().optional(),
  ownerId: z.number().optional(),
  plannedDate: z.date().optional(),
  plannedTime: z.string().optional(),
});

// Define the PinnedPlace schema
const pinnedPlaceSchema = z.object({
  address: z.string().min(2, { message: "Address is required" }),
  notes: z.string().optional(),
});

// Define types for our data
interface TripIdea {
  id: number;
  title: string;
  description?: string;
  status: "pending" | "booked" | "unsure";
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
  createdAt?: string;
}

type ColumnType = "pending" | "booked" | "unsure" | "places";

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
}

// Draggable Card Component
function DraggableCard({ 
  item, 
  type,
  onEditIdea
}: { 
  item: TripIdea | PinnedPlace; 
  type: 'idea' | 'place';
  onEditIdea?: (idea: TripIdea) => void;
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

  const handleCardClick = (e: React.MouseEvent) => {
    // Only handle clicks if we're not dragging and it's an idea
    if (!isDragging && isIdea && onEditIdea) {
      e.stopPropagation();
      onEditIdea(idea!);
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
              <MapPin className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{location}</span>
            </div>
          )}

          {/* External Link - for demonstration */}
          {Math.random() > 0.7 && (
            <div className="flex items-center gap-1 text-xs text-primary cursor-pointer hover:underline">
              <ExternalLink className="h-3 w-3" />
              <span>View Link</span>
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
  onEditIdea
}: { 
  column: Column; 
  items: (TripIdea | PinnedPlace)[]; 
  type: 'idea' | 'place';
  onEditIdea?: (idea: TripIdea) => void;
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
  tripCoordinates
}: TripIdeasAndPlacesProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingIdea, setEditingIdea] = useState<TripIdea | null>(null);
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

  const { data: pinnedPlacesData } = useQuery({
    queryKey: [`/api/trips/${tripId}/pinned-places`],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripId}/pinned-places`);
      if (!res.ok) throw new Error('Failed to fetch pinned places');
      return res.json();
    },
  });

  const pinnedPlaces = useMemo(() => {
    return pinnedPlacesData?.places || [];
  }, [pinnedPlacesData]);

  // Define columns
  const columns: Column[] = [
    {
      id: "pending",
      title: "Pending",
      count: ideas.filter((idea: TripIdea) => idea.status === "pending").length,
      color: "text-yellow-800",
      bgColor: "bg-yellow-200"
    },
    {
      id: "booked",
      title: "Booked", 
      count: ideas.filter((idea: TripIdea) => idea.status === "booked").length,
      color: "text-green-800",
      bgColor: "bg-green-200"
    },
    {
      id: "unsure", 
      title: "Unsure",
      count: ideas.filter((idea: TripIdea) => idea.status === "unsure").length,
      color: "text-orange-800", 
      bgColor: "bg-orange-200"
    },
    {
      id: "places",
      title: "Places",
      count: pinnedPlaces.length,
      color: "text-blue-800",
      bgColor: "bg-blue-200"
    }
  ];

  // Get items for each column
  const getColumnItems = (columnId: ColumnType) => {
    if (columnId === "places") {
      return pinnedPlaces;
    }
    return ideas.filter((idea: TripIdea) => idea.status === columnId);
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
    
    // Only handle idea dragging for now
    if (activeType !== 'idea') {
      console.log('Not an idea, skipping');
      return;
    }

    // Determine target column
    let targetColumn: ColumnType;
    
    // Check if dropped directly on a column
    if (['pending', 'booked', 'unsure', 'places'].includes(overId)) {
      targetColumn = overId as ColumnType;
      console.log('Dropped on column:', targetColumn);
    } else if (overId.includes('-')) {
      // Dropped on an item, find its column
      const [overType, overItemId] = overId.split('-');
      if (overType === 'place') {
        console.log('Cannot drop ideas on places column');
        return; // Don't allow dropping ideas in places column
      } else {
        // Find the idea and get its status
        const overIdea = ideas.find((idea: TripIdea) => idea.id.toString() === overItemId);
        targetColumn = overIdea?.status || 'pending';
        console.log('Dropped on item, target column:', targetColumn);
      }
    } else {
      console.log('Invalid drop target:', overId);
      return; // Invalid drop target
    }

    // Don't allow dropping in places column
    if (targetColumn === 'places') {
      console.log('Cannot drop ideas in places column');
      return;
    }

    const ideaId = parseInt(activeItemId);
    const currentIdea = ideas.find((idea: TripIdea) => idea.id === ideaId);
    
    if (!currentIdea) {
      console.log('Current idea not found:', ideaId);
      return;
    }

    if (currentIdea.status === targetColumn) {
      console.log('Idea already in target column');
      return;
    }

    console.log('Updating idea status:', { ideaId, from: currentIdea.status, to: targetColumn });
    
    updateIdeaStatusMutation.mutate({
      ideaId,
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
                          <SelectItem value="unsure">Unsure</SelectItem>
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
                        <Input placeholder="Enter location..." {...field} />
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
                          <SelectItem value="unsure">Unsure</SelectItem>
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
                        <Input placeholder="Enter location..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="adventure">
                    Update Idea
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {columns.map((column) => (
            <DroppableColumn
              key={column.id}
              column={column}
              items={getColumnItems(column.id)}
              type={column.id === 'places' ? 'place' : 'idea'}
              onEditIdea={column.id !== 'places' ? handleEditIdea : undefined}
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