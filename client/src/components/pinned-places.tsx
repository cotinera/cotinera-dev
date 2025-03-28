import React, { useMemo } from "react";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MapPicker } from "@/components/map-picker";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Plus, Trash2, Pencil, Calendar as CalendarIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { format, addHours } from "date-fns";

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
  phone?: string;
  website?: string;
  rating?: number;
  openingHours?: string[];
}

interface AddPinnedPlaceForm {
  address: string;
  notes?: string;
}

interface EditPinnedPlaceForm {
  address?: string;
  notes?: string;
}

interface PinnedPlacesProps {
  tripId: number;
  destinationId?: number;
  defaultLocation?: string;
  onPinPlace?: (place: PinnedPlace) => void;
  showMap?: boolean;
  tripCoordinates?: { lat: number; lng: number };
  onPinClick?: (place: PinnedPlace) => void;
}

export function PinnedPlaces({
  tripId,
  destinationId,
  defaultLocation,
  onPinPlace,
  showMap = false,
  tripCoordinates,
  onPinClick
}: PinnedPlacesProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddPlaceOpen, setIsAddPlaceOpen] = useState(false);
  const [selectedCoordinates, setSelectedCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [placeToDelete, setPlaceToDelete] = useState<PinnedPlace | null>(null);
  const [placeToEdit, setPlaceToEdit] = useState<PinnedPlace | null>(null);
  const [selectedPlaceName, setSelectedPlaceName] = useState<string>("");
  const [editedPlaceCoordinates, setEditedPlaceCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [editedPlaceName, setEditedPlaceName] = useState<string>("");
  const [searchInputRef, setSearchInputRef] = useState<HTMLInputElement | null>(null);
  const [placeToAddToCalendar, setPlaceToAddToCalendar] = useState<PinnedPlace | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [startTime, setStartTime] = useState("12:00");
  const [endTime, setEndTime] = useState("13:00");

  useEffect(() => {
    console.log('Trip coordinates:', tripCoordinates);
    console.log('Selected coordinates:', selectedCoordinates);
  }, [tripCoordinates, selectedCoordinates]);

  const pinnedPlacesQuery = useQuery<{ tripLocation: { lat: number; lng: number } | null; places: PinnedPlace[] }>({
    queryKey: [`/api/trips/${tripId}/pinned-places`, destinationId],
    queryFn: async () => {
      const url = new URL(`/api/trips/${tripId}/pinned-places`, window.location.origin);
      if (destinationId) {
        url.searchParams.append('destinationId', destinationId.toString());
      }
      const res = await fetch(url, {
        credentials: 'include'
      });
      if (!res.ok) {
        const error = await res.text();
        throw new Error(error);
      }
      const data = await res.json();
      console.log('Pinned places query response:', data);
      return data;
    },
  });

  const existingPins = [...(pinnedPlacesQuery.data?.places || [])]
    .sort((a, b) => a.name.localeCompare(b.name));

  const effectiveLocation = useMemo(() => {
    if (tripCoordinates) {
      console.log('Using trip coordinates:', tripCoordinates);
      return tripCoordinates;
    }
    if (destinationId && pinnedPlacesQuery.data?.tripLocation) {
      console.log('Using destination location:', pinnedPlacesQuery.data.tripLocation);
      return pinnedPlacesQuery.data.tripLocation;
    }
    console.log('No location coordinates available');
    return null;
  }, [tripCoordinates, destinationId, pinnedPlacesQuery.data?.tripLocation]);

  console.log('Effective location being used:', effectiveLocation);

  const form = useForm<AddPinnedPlaceForm>({
    defaultValues: {
      address: "",
      notes: "",
    },
  });

  const editForm = useForm<EditPinnedPlaceForm>({
    defaultValues: {
      address: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (placeToEdit) {
      editForm.reset({
        address: placeToEdit.name,
        notes: placeToEdit.notes || "",
      });
      setEditedPlaceCoordinates(placeToEdit.coordinates);
      setEditedPlaceName(placeToEdit.name);
    }
  }, [placeToEdit, editForm]);

  useEffect(() => {
    if (isAddPlaceOpen) {
      form.reset({
        address: "",
        notes: "",
      });
      setSelectedCoordinates(null);
    }
  }, [isAddPlaceOpen, form]);

  const addPinnedPlaceMutation = useMutation({
    mutationFn: async (data: AddPinnedPlaceForm) => {
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
          destinationId,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Failed to add pinned place");
      }

      const newPlace = await res.json();
      return newPlace;
    },
    onSuccess: (newPlace) => {
      queryClient.setQueryData<{ tripLocation: { lat: number; lng: number } | null; places: PinnedPlace[] }>(
        [`/api/trips/${tripId}/pinned-places`, destinationId],
        (old) => ({
          tripLocation: old?.tripLocation || null,
          places: [...(old?.places || []), newPlace]
        })
      );

      queryClient.invalidateQueries({
        queryKey: [`/api/trips/${tripId}/pinned-places`]
      });

      if (onPinPlace) {
        onPinPlace(newPlace);
      }

      setIsAddPlaceOpen(false);
      form.reset();
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
    mutationFn: async (variables: { placeId: number; data: EditPinnedPlaceForm & { coordinates?: { lat: number; lng: number }, name?: string } }) => {
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
        [`/api/trips/${tripId}/pinned-places`, destinationId],
        (old) => ({
          tripLocation: old?.tripLocation || null,
          places: old?.places?.map(place =>
            place.id === updatedPlace.id ? updatedPlace : place
          ) || []
        })
      );

      setPlaceToEdit(null);
      editForm.reset();
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
      place: PinnedPlace; 
      date: Date; 
      startTime: string; 
      endTime: string; 
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

      const res = await fetch(`/api/trips/${tripId}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({
          title: data.place.name,
          description: data.place.notes || '',
          location: data.place.address,
          coordinates: data.place.coordinates,
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString()
        }),
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
      
      setPlaceToAddToCalendar(null);
      setSelectedDate(undefined);
      
      toast({
        title: "Success",
        description: "Place added to calendar",
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

  const handleAddToCalendar = () => {
    if (!placeToAddToCalendar || !selectedDate) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a date",
      });
      return;
    }

    addToCalendarMutation.mutate({
      place: placeToAddToCalendar,
      date: selectedDate,
      startTime,
      endTime
    });
  };

  const handleDeletePlace = () => {
    if (!placeToDelete) return;
    deletePinnedPlaceMutation.mutate(placeToDelete.id);
  };

  const onSubmit = (data: AddPinnedPlaceForm) => {
    if (!selectedCoordinates || !selectedPlaceName) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a location first",
      });
      return;
    }

    addPinnedPlaceMutation.mutate({
      ...data,
      address: selectedPlaceName,
    });
  };

  const handleUpdatePlace = (data: EditPinnedPlaceForm) => {
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

  const handlePlaceClick = (place: PinnedPlace) => {
    onPinClick?.(place);
  };

  const handleEditClick = (e: React.MouseEvent, place: PinnedPlace) => {
    e.stopPropagation();
    setPlaceToEdit(place);
  };

  const handleDeleteClick = (e: React.MouseEvent, place: PinnedPlace) => {
    e.stopPropagation();
    setPlaceToDelete(place);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Pinned Places
          </div>
        </CardTitle>

        <Dialog open={isAddPlaceOpen} onOpenChange={setIsAddPlaceOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[800px]">
            <DialogHeader>
              <DialogTitle>Pin a New Place</DialogTitle>
              <DialogDescription>
                Search and select a location to pin on your trip map.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
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
                  control={form.control}
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
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[200px] w-full rounded-md">
          <div className="space-y-2">
            {existingPins.map((place) => (
              <div
                key={place.id}
                className="flex items-center justify-between p-2 rounded-md bg-muted/50 hover:bg-muted/70 transition-colors cursor-pointer"
                onClick={() => handlePlaceClick(place)}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <p className="text-sm font-medium truncate">{place.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPlaceToAddToCalendar(place);
                    }}
                    className="p-0 h-8 w-8 text-muted-foreground hover:text-primary"
                    title="Add to Calendar"
                  >
                    <CalendarIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => handleEditClick(e, place)}
                    className="p-0 h-8 w-8 text-muted-foreground hover:text-primary"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => handleDeleteClick(e, place)}
                    className="p-0 h-8 w-8 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {existingPins.length === 0 && (
              <p className="text-center text-muted-foreground py-4">
                No places pinned yet
              </p>
            )}
          </div>
          <ScrollBar orientation="vertical" />
        </ScrollArea>
      </CardContent>

      <Dialog open={!!placeToAddToCalendar} onOpenChange={(open) => !open && setPlaceToAddToCalendar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Calendar</DialogTitle>
            <DialogDescription>
              Select a date and time to add {placeToAddToCalendar?.name} to your trip calendar.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <h4 className="font-medium">Select Date</h4>
              <Calendar
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
      
      <Dialog open={!!placeToEdit} onOpenChange={(open) => !open && setPlaceToEdit(null)}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>Edit {placeToEdit?.name}</DialogTitle>
            <DialogDescription>
              Update the details for this pinned place.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleUpdatePlace)} className="space-y-4">
              <FormField
                control={editForm.control}
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
                control={editForm.control}
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
                  disabled={updatePinnedPlaceMutation.isPending}
                >
                  {updatePinnedPlaceMutation.isPending ? "Updating..." : "Update Place"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!placeToDelete} onOpenChange={() => setPlaceToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Pinned Place</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this pinned place? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePlace}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}