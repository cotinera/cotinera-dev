import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusCircle, ThumbsUp, Edit, Trash2, MapPin, Calendar as CalendarIcon, Map, Compass, Plus } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axios from "axios";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format, isValid, parseISO } from "date-fns";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ExpandableTripIdeaForm } from "./expandable-trip-idea-form";
import { cn } from "@/lib/utils";
import { MapPicker } from "@/components/map-picker";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

// Define the TripIdea schema for form validation
const tripIdeaSchema = z.object({
  title: z.string().min(2, { message: "Title is required" }),
  description: z.string().optional(),
  status: z.enum(["pending", "booked", "unsure"]).default("pending"),
  location: z.string().optional(),
  ownerId: z.number().optional(),
  plannedDate: z.date().optional(),
  plannedTime: z.string().optional(), // Store time as HH:MM format
});

// Define forms for pinned place
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
}

type TabViews = "all" | "pending" | "booked" | "unsure" | "places";

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

export function TripIdeasAndPlaces({ 
  tripId, 
  participants,
  tripCoordinates
}: TripIdeasAndPlacesProps) {
  // State
  const [activeTab, setActiveTab] = useState<TabViews>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingIdea, setEditingIdea] = useState<TripIdea | null>(null);
  const [isAddPlaceOpen, setIsAddPlaceOpen] = useState(false);
  const [selectedCoordinates, setSelectedCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedPlaceName, setSelectedPlaceName] = useState<string>("");
  const [placeToDelete, setPlaceToDelete] = useState<PinnedPlace | null>(null);
  const [ideaToDelete, setIdeaToDelete] = useState<number | null>(null);
  const [placeToEdit, setPlaceToEdit] = useState<PinnedPlace | null>(null);
  const [editedPlaceCoordinates, setEditedPlaceCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [editedPlaceName, setEditedPlaceName] = useState<string>("");
  const [searchInputRef, setSearchInputRef] = useState<HTMLInputElement | null>(null);
  const [itemToAddToCalendar, setItemToAddToCalendar] = useState<TripIdea | PinnedPlace | null>(null);
  const [isItemToAddIdeaNotPlace, setIsItemToAddIdeaNotPlace] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [startTime, setStartTime] = useState("12:00");
  const [endTime, setEndTime] = useState("13:00");
  const [selectedMapPlace, setSelectedMapPlace] = useState<PinnedPlace | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Forms
  const ideaForm = useForm<z.infer<typeof tripIdeaSchema>>({
    resolver: zodResolver(tripIdeaSchema),
    defaultValues: {
      title: "",
      description: "",
      status: "pending",
      location: "",
    },
  });

  const editForm = useForm<z.infer<typeof tripIdeaSchema>>({
    resolver: zodResolver(tripIdeaSchema),
    defaultValues: {
      title: "",
      description: "",
      status: "pending",
      location: "",
    },
  });

  const placeForm = useForm<z.infer<typeof pinnedPlaceSchema>>({
    resolver: zodResolver(pinnedPlaceSchema),
    defaultValues: {
      address: "",
      notes: "",
    },
  });

  const editPlaceForm = useForm<z.infer<typeof pinnedPlaceSchema>>({
    resolver: zodResolver(pinnedPlaceSchema),
    defaultValues: {
      address: "",
      notes: "",
    },
  });

  // Queries
  const { 
    data: ideas = [], 
    isLoading: isIdeasLoading 
  } = useQuery({
    queryKey: ["/api/trips", tripId, "ideas"],
    queryFn: async () => {
      const response = await axios.get(`/api/trips/${tripId}/ideas`);
      return response.data;
    },
  });

  const {
    data: pinnedPlacesData,
    isLoading: isPlacesLoading
  } = useQuery({
    queryKey: [`/api/trips/${tripId}/pinned-places`],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripId}/pinned-places`, {
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('Failed to fetch pinned places');
      }

      return res.json();
    },
  });

  const existingPins = useMemo(() => {
    return pinnedPlacesData?.places || [];
  }, [pinnedPlacesData]);

  const effectiveLocation = useMemo(() => {
    if (tripCoordinates) {
      console.log('Using trip coordinates:', tripCoordinates);
      return tripCoordinates;
    }
    if (pinnedPlacesData?.tripLocation) {
      console.log('Using destination location:', pinnedPlacesData.tripLocation);
      return pinnedPlacesData.tripLocation;
    }
    console.log('No location coordinates available');
    return null;
  }, [tripCoordinates, pinnedPlacesData?.tripLocation]);

  // Mutations for Ideas
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
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "Failed to add idea. Please try again.",
        variant: "destructive",
      });
      console.error("Error adding trip idea:", error);
    },
  });

  const editIdeaMutation = useMutation({
    mutationFn: async (data: z.infer<typeof tripIdeaSchema> & { id: number }) => {
      const response = await axios.patch(`/api/trips/${tripId}/ideas/${data.id}`, data);
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
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "Failed to update idea. Please try again.",
        variant: "destructive",
      });
      console.error("Error updating trip idea:", error);
    },
  });

  const deleteIdeaMutation = useMutation({
    mutationFn: async (ideaId: number) => {
      const response = await axios.delete(`/api/trips/${tripId}/ideas/${ideaId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId, "ideas"] });
      setIdeaToDelete(null);
      toast({
        title: "Success",
        description: "Idea deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "Failed to delete idea. Please try again.",
        variant: "destructive",
      });
      console.error("Error deleting trip idea:", error);
    },
  });

  const voteIdeaMutation = useMutation({
    mutationFn: async (ideaId: number) => {
      const response = await axios.post(`/api/trips/${tripId}/ideas/${ideaId}/vote`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId, "ideas"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "Failed to vote for idea. Please try again.",
        variant: "destructive",
      });
      console.error("Error voting for idea:", error);
    },
  });

  // Mutations for Places
  const addPinnedPlaceMutation = useMutation({
    mutationFn: async (data: z.infer<typeof pinnedPlaceSchema>) => {
      if (!selectedCoordinates || !selectedPlaceName) {
        throw new Error("Please select a location");
      }

      const res = await fetch(`/api/trips/${tripId}/pinned-places`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({
          name: selectedPlaceName,
          address: data.address,
          notes: data.notes,
          coordinates: selectedCoordinates,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Failed to add pinned place");
      }

      return res.json();
    },
    onSuccess: (newPlace) => {
      queryClient.setQueryData<{ tripLocation: { lat: number; lng: number } | null; places: PinnedPlace[] }>(
        [`/api/trips/${tripId}/pinned-places`],
        (old) => ({
          tripLocation: old?.tripLocation || null,
          places: [...(old?.places || []), newPlace]
        })
      );

      setIsAddPlaceOpen(false);
      placeForm.reset();
      setSelectedCoordinates(null);
      setSelectedPlaceName("");

      toast({
        title: "Success",
        description: "Place pinned successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to pin place",
      });
    },
  });

  const deletePinnedPlaceMutation = useMutation({
    mutationFn: async (placeId: number) => {
      const res = await fetch(`/api/trips/${tripId}/pinned-places/${placeId}`, {
        method: "DELETE",
        credentials: 'include',
      });

      if (!res.ok) {
        const error = await res.text();
        throw new Error(error);
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/trips/${tripId}/pinned-places`]
      });
      setPlaceToDelete(null);
      toast({
        title: "Success",
        description: "Place deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete place",
      });
    },
  });

  const updatePinnedPlaceMutation = useMutation({
    mutationFn: async (variables: { placeId: number; data: z.infer<typeof pinnedPlaceSchema> & { coordinates?: { lat: number; lng: number }, name?: string } }) => {
      const res = await fetch(`/api/trips/${tripId}/pinned-places/${variables.placeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({
          ...variables.data,
          name: variables.data.name || editedPlaceName,
          coordinates: variables.data.coordinates || editedPlaceCoordinates,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Failed to update pinned place");
      }

      return res.json();
    },
    onSuccess: (updatedPlace) => {
      queryClient.setQueryData<{ tripLocation: { lat: number; lng: number } | null; places: PinnedPlace[] }>(
        [`/api/trips/${tripId}/pinned-places`],
        (old) => ({
          tripLocation: old?.tripLocation || null,
          places: old?.places?.map(place =>
            place.id === updatedPlace.id ? updatedPlace : place
          ) || []
        })
      );

      setPlaceToEdit(null);
      editPlaceForm.reset();
      setEditedPlaceCoordinates(null);
      setEditedPlaceName("");

      toast({
        title: "Success",
        description: "Place updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update place",
      });
    },
  });

  const addToCalendarMutation = useMutation({
    mutationFn: async (data: { 
      item: TripIdea | PinnedPlace; 
      date: Date; 
      startTime: string; 
      endTime: string;
      isIdea: boolean;
      navigateToCalendar?: boolean;
    }) => {
      if (!data.date) {
        throw new Error("Please select a date");
      }

      // Create start and end date objects from the selected date and times
      const [startHours, startMinutes] = data.startTime.split(':').map(Number);
      const [endHours, endMinutes] = data.endTime.split(':').map(Number);
      
      const startDate = new Date(data.date);
      startDate.setHours(startHours, startMinutes, 0);
      
      const endDate = new Date(data.date);
      endDate.setHours(endHours, endMinutes, 0);

      // Type guard functions
      const isIdea = (item: TripIdea | PinnedPlace): item is TripIdea => {
        return 'title' in item && 'status' in item;
      };
      
      const isPlace = (item: TripIdea | PinnedPlace): item is PinnedPlace => {
        return 'name' in item && 'address' in item;
      };
      
      // Prepare payload based on whether it's an idea or a place
      const payload = data.isIdea && isIdea(data.item)
        ? {
            title: data.item.title,
            description: data.item.description || '',
            location: data.item.location || '',
            coordinates: data.item.coordinates || null,
            startTime: startDate.toISOString(),
            endTime: endDate.toISOString()
          }
        : !data.isIdea && isPlace(data.item)
          ? {
              title: data.item.name,
              description: data.item.notes || '',
              location: data.item.address,
              coordinates: data.item.coordinates,
              startTime: startDate.toISOString(),
              endTime: endDate.toISOString()
            }
          : {
              title: 'Event',
              description: '',
              location: '',
              coordinates: null,
              startTime: startDate.toISOString(),
              endTime: endDate.toISOString()
            };

      const res = await fetch(`/api/trips/${tripId}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Failed to add to calendar");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/trips/${tripId}/activities`]
      });
      
      setItemToAddToCalendar(null);
      setSelectedDate(undefined);
      
      toast({
        title: "Success",
        description: "Added to calendar",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to add to calendar",
      });
    },
  });

  // Convert idea to pinned place
  const ideaToPlaceMutation = useMutation({
    mutationFn: async (idea: TripIdea) => {
      if (!idea.coordinates) {
        throw new Error("This idea doesn't have location coordinates");
      }

      const res = await fetch(`/api/trips/${tripId}/pinned-places`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({
          name: idea.title,
          address: idea.location || idea.title,
          notes: idea.description || '',
          coordinates: idea.coordinates,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Failed to convert idea to place");
      }

      return res.json();
    },
    onSuccess: (newPlace) => {
      queryClient.setQueryData<{ tripLocation: { lat: number; lng: number } | null; places: PinnedPlace[] }>(
        [`/api/trips/${tripId}/pinned-places`],
        (old) => ({
          tripLocation: old?.tripLocation || null,
          places: [...(old?.places || []), newPlace]
        })
      );

      toast({
        title: "Success",
        description: "Idea added as pinned place",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to add as pinned place",
      });
    },
  });

  // Create idea from place
  const placeToIdeaMutation = useMutation({
    mutationFn: async (place: PinnedPlace) => {
      const response = await axios.post(`/api/trips/${tripId}/ideas`, {
        title: place.name,
        description: place.notes || '',
        location: place.address,
        status: "pending",
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId, "ideas"] });

      toast({
        title: "Success",
        description: "Place added as trip idea",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "Failed to add as idea. Please try again.",
        variant: "destructive",
      });
      console.error("Error converting place to idea:", error);
    },
  });

  // Event handlers
  const handleAddToCalendar = () => {
    if (!itemToAddToCalendar || !selectedDate) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a date",
      });
      return;
    }

    addToCalendarMutation.mutate({
      item: itemToAddToCalendar,
      date: selectedDate,
      startTime,
      endTime,
      isIdea: isItemToAddIdeaNotPlace
    });
  };

  const handleDeletePlace = () => {
    if (!placeToDelete) return;
    deletePinnedPlaceMutation.mutate(placeToDelete.id);
  };

  const handleDeleteIdea = () => {
    if (!ideaToDelete) return;
    deleteIdeaMutation.mutate(ideaToDelete);
  };

  const onAddIdeaSubmit = (data: z.infer<typeof tripIdeaSchema>) => {
    addIdeaMutation.mutate(data);
  };

  const onEditIdeaSubmit = (data: z.infer<typeof tripIdeaSchema>) => {
    if (editingIdea) {
      editIdeaMutation.mutate({ ...data, id: editingIdea.id });
    }
  };

  const onAddPlaceSubmit = (data: z.infer<typeof pinnedPlaceSchema>) => {
    if (!selectedCoordinates || !selectedPlaceName) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a location first",
      });
      return;
    }

    addPinnedPlaceMutation.mutate(data);
  };

  const handleUpdatePlace = (data: z.infer<typeof pinnedPlaceSchema>) => {
    if (!placeToEdit) return;

    if (!editedPlaceCoordinates) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a location",
      });
      return;
    }

    updatePinnedPlaceMutation.mutate({
      placeId: placeToEdit.id,
      data: {
        ...data,
        name: editedPlaceName,
        coordinates: editedPlaceCoordinates,
      },
    });
  };

  const handleEditIdeaClick = (idea: TripIdea) => {
    setEditingIdea(idea);
    editForm.reset({
      title: idea.title,
      description: idea.description || "",
      status: idea.status,
      location: idea.location || "",
      ownerId: idea.ownerId,
      plannedDate: idea.plannedDate ? new Date(idea.plannedDate) : undefined,
      plannedTime: idea.plannedTime || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleEditPlaceClick = (e: React.MouseEvent, place: PinnedPlace) => {
    e.stopPropagation();
    setPlaceToEdit(place);
    editPlaceForm.reset({
      address: place.address || "",
      notes: place.notes || "",
    });
    setEditedPlaceCoordinates(place.coordinates);
    setEditedPlaceName(place.name);
  };

  const handleIdeaAddToCalendarClick = (idea: TripIdea) => {
    // If the idea has a planned date and time, use them directly
    if (idea.plannedDate) {
      const date = new Date(idea.plannedDate);
      const startTimeValue = idea.plannedTime || "09:00"; // Default to 9 AM if no time specified
      
      // Set end time one hour after start time
      const [hours, minutes] = startTimeValue.split(':').map(Number);
      const endHour = (hours + 1) % 24;
      const endTimeValue = `${endHour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      
      // Add to calendar directly without showing dialog
      addToCalendarMutation.mutate({
        item: idea,
        date: date,
        startTime: startTimeValue,
        endTime: endTimeValue,
        isIdea: true,
        navigateToCalendar: true // Add flag to navigate to calendar on success
      });
    } else {
      // Fall back to dialog for ideas without planned date
      setItemToAddToCalendar(idea);
      setIsItemToAddIdeaNotPlace(true);
      setStartTime("09:00"); // Default to 9 AM
      setEndTime("10:00");   // Default to 10 AM
      setSelectedDate(new Date()); // Default to today
    }
  };

  const handlePlaceAddToCalendarClick = (e: React.MouseEvent, place: PinnedPlace) => {
    e.stopPropagation();
    setItemToAddToCalendar(place);
    setIsItemToAddIdeaNotPlace(false);
  };

  const handleConvertIdeaToPlace = (idea: TripIdea) => {
    if (!idea.coordinates) {
      toast({
        variant: "destructive",
        title: "No location coordinates",
        description: "This idea needs location coordinates to be added as a place. Edit it first to add a location.",
      });
      return;
    }
    
    ideaToPlaceMutation.mutate(idea);
  };

  const handleConvertPlaceToIdea = (place: PinnedPlace) => {
    placeToIdeaMutation.mutate(place);
  };

  const handlePlaceClick = (place: PinnedPlace) => {
    setSelectedMapPlace(place);
  };

  // Reset forms when dialogs are closed
  useEffect(() => {
    if (isAddPlaceOpen) {
      placeForm.reset({
        address: "",
        notes: "",
      });
      setSelectedCoordinates(null);
      setSelectedPlaceName("");
    }
  }, [isAddPlaceOpen, placeForm]);

  // Helper functions
  const filteredIdeas = useMemo(() => {
    if (!Array.isArray(ideas)) return [];
    
    if (activeTab === "all") return ideas;
    if (activeTab === "places") return [];
    
    return ideas.filter((idea: TripIdea) => idea.status === activeTab);
  }, [ideas, activeTab]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="text-xs font-normal px-2 py-0">Pending</Badge>;
      case "booked":
        return <Badge className="bg-primary/80 text-primary-foreground hover:bg-primary/70 text-xs font-normal px-2 py-0">Booked</Badge>;
      case "unsure":
        return <Badge variant="secondary" className="text-xs font-normal px-2 py-0">Unsure</Badge>;
      default:
        return <Badge variant="outline" className="text-xs font-normal px-2 py-0">{status}</Badge>;
    }
  };

  if (isIdeasLoading || isPlacesLoading) {
    return <div className="flex justify-center p-8">Loading...</div>;
  }

  return (
    <Card className="overflow-hidden border-none shadow-sm bg-background">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            <span className="text-primary/80 rounded-full bg-primary/10 p-1">
              <ThumbsUp className="h-4 w-4" />
            </span>
            Trip Ideas & Places
          </CardTitle>
        </div>
        <CardDescription>
          Collaborate on ideas and pinned places for your trip with other participants
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabViews)} className="w-full">
          <TabsList className="mb-2 h-8 w-fit">
            <TabsTrigger value="all" className="text-xs px-3 h-7">All Ideas</TabsTrigger>
            <TabsTrigger value="pending" className="text-xs px-3 h-7">Pending</TabsTrigger>
            <TabsTrigger value="booked" className="text-xs px-3 h-7">Booked</TabsTrigger>
            <TabsTrigger value="unsure" className="text-xs px-3 h-7">Unsure</TabsTrigger>
            <TabsTrigger value="places" className="text-xs px-3 h-7">Places</TabsTrigger>
          </TabsList>

          {/* Ideas content */}
          <TabsContent value={activeTab} className="mt-2" hidden={activeTab === "places"}>
            {filteredIdeas.length === 0 ? (
              <div className="text-center py-6 px-4 border rounded-md bg-muted/20">
                <p className="text-muted-foreground text-sm mb-4">No ideas found for this filter.</p>
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      className="w-full sm:w-auto sm:min-w-[200px] gap-2"
                    >
                      <PlusCircle className="h-4 w-4" />
                      Add New Idea
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[600px] p-0 border-none shadow-lg">
                    <DialogHeader className="sr-only">
                      <DialogTitle>Add Trip Idea</DialogTitle>
                      <DialogDescription>Form to add a new trip idea</DialogDescription>
                    </DialogHeader>
                    <ExpandableTripIdeaForm
                      tripId={tripId}
                      participants={participants}
                      onSubmit={onAddIdeaSubmit}
                      onCancel={() => setIsAddDialogOpen(false)}
                      isPending={addIdeaMutation.isPending}
                      defaultMapLocation={tripCoordinates}
                    />
                  </DialogContent>
                </Dialog>
              </div>
            ) : (
              <div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
                  {filteredIdeas.map((idea: TripIdea) => (
                    <Card key={idea.id} className="overflow-hidden border shadow-sm">
                      <CardHeader className="pb-2 space-y-1">
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-base font-medium">{idea.title}</CardTitle>
                          {getStatusBadge(idea.status)}
                        </div>
                        {idea.ownerName && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Avatar className="h-5 w-5">
                              {idea.ownerAvatar ? (
                                <AvatarImage src={idea.ownerAvatar} alt={idea.ownerName} />
                              ) : (
                                <AvatarFallback className="text-xs">{idea.ownerName.charAt(0)}</AvatarFallback>
                              )}
                            </Avatar>
                            <span>Owned by {idea.ownerName}</span>
                          </div>
                        )}
                      </CardHeader>
                      <CardContent className="pb-2 pt-0">
                        {idea.description && <p className="text-sm text-muted-foreground">{idea.description}</p>}
                        <div className="mt-2 space-y-1">
                          {idea.location && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3 text-primary/70" />
                              <span>{idea.location}</span>
                            </div>
                          )}
                          {idea.plannedDate && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <CalendarIcon className="h-3 w-3 text-primary/70" />
                              <span>
                                {format(new Date(idea.plannedDate), "PPP")}
                                {idea.plannedTime && ` at ${idea.plannedTime}`}
                              </span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                      <CardFooter className="border-t bg-muted/30 py-2 px-4 flex flex-wrap justify-between gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="gap-1 h-7 px-2 text-xs"
                          onClick={() => voteIdeaMutation.mutate(idea.id)}
                          disabled={voteIdeaMutation.isPending}
                        >
                          <ThumbsUp className="h-3 w-3" />
                          <span className="font-normal">{idea.votes || 0}</span>
                        </Button>
                        <div className="flex flex-wrap gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-7 px-2 text-xs flex items-center gap-1"
                            onClick={() => handleIdeaAddToCalendarClick(idea)}
                          >
                            <CalendarIcon className="h-3 w-3" />
                            <span className="font-normal">Calendar</span>
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-7 px-2 text-xs flex items-center gap-1"
                            onClick={() => handleConvertIdeaToPlace(idea)}
                            disabled={!idea.coordinates}
                            title={!idea.coordinates ? "This idea needs location coordinates" : "Add as pinned place"}
                          >
                            <MapPin className="h-3 w-3" />
                            <span className="font-normal">Pin</span>
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => handleEditIdeaClick(idea)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => setIdeaToDelete(idea.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
                <div className="flex justify-center">
                  <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                    <DialogTrigger asChild>
                      <Button 
                        size="lg" 
                        className="gap-2 bg-primary/90 hover:bg-primary text-primary-foreground px-6"
                      >
                        <PlusCircle className="h-5 w-5" />
                        Add New Idea
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[600px] p-0 border-none shadow-lg">
                      <DialogHeader className="sr-only">
                        <DialogTitle>Add Trip Idea</DialogTitle>
                        <DialogDescription>Form to add a new trip idea</DialogDescription>
                      </DialogHeader>
                      <ExpandableTripIdeaForm
                        tripId={tripId}
                        participants={participants}
                        onSubmit={onAddIdeaSubmit}
                        onCancel={() => setIsAddDialogOpen(false)}
                        isPending={addIdeaMutation.isPending}
                      />
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Places content */}
          <TabsContent value="places" className="mt-2">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Map view */}
              <div className="w-full md:w-1/2 md:h-[400px] h-[300px] rounded-md overflow-hidden border">
                <MapPicker
                  value=""
                  onChange={() => {}}
                  placeholder="Search for a place..."
                  existingPins={existingPins}
                  readOnly={true}
                  initialCenter={effectiveLocation}
                />
              </div>
              
              {/* Places list */}
              <div className="w-full md:w-1/2 border rounded-md">
                <div className="p-3 border-b flex justify-between items-center">
                  <h3 className="font-medium text-sm">Pinned Places</h3>
                  <Dialog open={isAddPlaceOpen} onOpenChange={setIsAddPlaceOpen}>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1"
                      >
                        <Plus className="h-4 w-4" />
                        Add Place
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[800px]">
                      <DialogHeader>
                        <DialogTitle>Pin a New Place</DialogTitle>
                        <DialogDescription>
                          Search and select a location to pin on your trip map.
                        </DialogDescription>
                      </DialogHeader>
                      <Form {...placeForm}>
                        <form onSubmit={placeForm.handleSubmit(onAddPlaceSubmit)} className="space-y-4">
                          <FormField
                            control={placeForm.control}
                            name="address"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Location</FormLabel>
                                <FormControl>
                                  <div className="h-[400px] w-full">
                                    <MapPicker
                                      value={field.value}
                                      onChange={(address, coordinates, name) => {
                                        field.onChange(address);
                                        setSelectedCoordinates(coordinates);
                                        setSelectedPlaceName(name || address);
                                      }}
                                      placeholder="Search for a place to pin..."
                                      existingPins={existingPins}
                                      initialCenter={effectiveLocation}
                                      searchBias={effectiveLocation ? {
                                        ...effectiveLocation,
                                        radius: 50000
                                      } : undefined}
                                      onSearchInputRef={setSearchInputRef}
                                    />
                                  </div>
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={placeForm.control}
                            name="notes"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Notes</FormLabel>
                                <FormControl>
                                  <Textarea {...field} placeholder="Add any notes about this place..." />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <DialogFooter>
                            <Button
                              type="submit"
                              variant="default"
                              disabled={!selectedCoordinates || addPinnedPlaceMutation.isPending}
                            >
                              {addPinnedPlaceMutation.isPending ? "Pinning..." : "Pin Place"}
                            </Button>
                          </DialogFooter>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                </div>
                <ScrollArea className="h-[300px] md:h-[350px]">
                  <div className="space-y-2 p-3">
                    {existingPins.length === 0 ? (
                      <p className="text-center text-muted-foreground py-4">
                        No places pinned yet
                      </p>
                    ) : (
                      existingPins.map((place) => (
                        <div
                          key={place.id}
                          className={cn(
                            "flex items-center justify-between p-2 rounded-md hover:bg-muted/70 transition-colors cursor-pointer",
                            selectedMapPlace?.id === place.id ? "bg-muted" : "bg-muted/50" 
                          )}
                          onClick={() => handlePlaceClick(place)}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-primary/70" />
                              <p className="text-sm font-medium truncate">{place.name}</p>
                            </div>
                            {place.notes && (
                              <p className="text-xs text-muted-foreground ml-6 mt-1 line-clamp-1">{place.notes}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={(e) => handlePlaceAddToCalendarClick(e, place)}
                            >
                              <CalendarIcon className="h-3 w-3 mr-1" />
                              <span className="font-normal">Calendar</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleConvertPlaceToIdea(place);
                              }}
                            >
                              <ThumbsUp className="h-3 w-3 mr-1" />
                              <span className="font-normal">Idea</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => handleEditPlaceClick(e, place)}
                              className="p-0 h-7 w-7 text-muted-foreground hover:text-primary"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPlaceToDelete(place);
                              }}
                              className="p-0 h-7 w-7 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <ScrollBar orientation="vertical" />
                </ScrollArea>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Edit Idea Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[600px] p-0 border-none shadow-lg">
            <DialogHeader className="sr-only">
              <DialogTitle>Edit Trip Idea</DialogTitle>
              <DialogDescription>Form to edit an existing trip idea</DialogDescription>
            </DialogHeader>
            <ExpandableTripIdeaForm
              tripId={tripId}
              participants={participants}
              onSubmit={onEditIdeaSubmit}
              onCancel={() => setIsEditDialogOpen(false)}
              isPending={editIdeaMutation.isPending}
              initialValues={editingIdea ? {
                title: editingIdea.title,
                description: editingIdea.description || "",
                status: editingIdea.status,
                location: editingIdea.location || "",
                ownerId: editingIdea.ownerId,
                plannedDate: editingIdea.plannedDate ? new Date(editingIdea.plannedDate) : undefined,
                plannedTime: editingIdea.plannedTime || "",
                coordinates: editingIdea.coordinates
              } : undefined}
              defaultMapLocation={tripCoordinates}
            />
          </DialogContent>
        </Dialog>

        {/* Edit Place Dialog */}
        <Dialog open={!!placeToEdit} onOpenChange={(open) => !open && setPlaceToEdit(null)}>
          <DialogContent className="sm:max-w-[800px]">
            <DialogHeader>
              <DialogTitle>Edit {placeToEdit?.name}</DialogTitle>
              <DialogDescription>
                Update the details for this pinned place.
              </DialogDescription>
            </DialogHeader>
            <Form {...editPlaceForm}>
              <form onSubmit={editPlaceForm.handleSubmit(handleUpdatePlace)} className="space-y-4">
                <FormField
                  control={editPlaceForm.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <FormControl>
                        <div className="h-[400px] w-full">
                          <MapPicker
                            value={field.value || ""}
                            onChange={(address, coordinates, name) => {
                              field.onChange(address);
                              setEditedPlaceCoordinates(coordinates);
                              setEditedPlaceName(name || address);
                            }}
                            placeholder="Search for a place to pin..."
                            existingPins={existingPins.filter(p => p.id !== placeToEdit?.id)}
                            initialCenter={placeToEdit?.coordinates || effectiveLocation}
                            searchBias={effectiveLocation ? {
                              ...effectiveLocation,
                              radius: 50000
                            } : undefined}
                            onSearchInputRef={setSearchInputRef}
                          />
                        </div>
                      </FormControl>
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
                        <Textarea {...field} placeholder="Add any notes about this place..." />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button
                    type="submit"
                    variant="default"
                    disabled={!editedPlaceCoordinates || updatePinnedPlaceMutation.isPending}
                  >
                    {updatePinnedPlaceMutation.isPending ? "Updating..." : "Update Place"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        
        {/* Add to Calendar Dialog */}
        <Dialog open={!!itemToAddToCalendar} onOpenChange={(open) => !open && setItemToAddToCalendar(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add to Calendar</DialogTitle>
              <DialogDescription>
                Select a date and time to add {isItemToAddIdeaNotPlace 
                  ? (itemToAddToCalendar as TripIdea)?.title 
                  : (itemToAddToCalendar as PinnedPlace)?.name} to your trip calendar.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <h4 className="font-medium">Select Date</h4>
                <CalendarComponent
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  className="border rounded-md mx-auto"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium">Start Time</h4>
                  <Input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">End Time</h4>
                  <Input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button 
                onClick={handleAddToCalendar}
                disabled={!selectedDate || addToCalendarMutation.isPending}
              >
                {addToCalendarMutation.isPending ? "Adding..." : "Add to Calendar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Delete Place Alert Dialog */}
        <AlertDialog open={!!placeToDelete} onOpenChange={(open) => !open && setPlaceToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the pinned place "{placeToDelete?.name}".
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeletePlace} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        
        {/* Delete Idea Alert Dialog */}
        <AlertDialog open={!!ideaToDelete} onOpenChange={(open) => !open && setIdeaToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this trip idea.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteIdea} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}