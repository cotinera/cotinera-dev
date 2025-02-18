import React from "react";
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
import { MapPin, Plus, Trash2, Coffee, UtensilsCrossed, Wine, Beer, Building2, ShoppingBag, Theater, Palmtree, History, Building, Pencil } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export enum PlaceCategory {
  FOOD = "food",
  BAR = "bar",
  CAFE = "cafe",
  WINE = "wine",
  SHOPPING = "shopping",
  GROCERY = "grocery",
  ARTS = "arts",
  LIGHTHOUSE = "lighthouse",
  THEATRE = "theatre",
  TOURIST = "tourist",
  CASINO = "casino",
  AQUARIUM = "aquarium",
  EVENT_VENUE = "event_venue",
  AMUSEMENT_PARK = "amusement_park",
  HISTORIC = "historic",
  MUSEUM = "museum",
  MOVIE_THEATRE = "movie_theatre",
  MONUMENT = "monument",
  MUSIC = "music",
  RELIC = "relic"
}

const CATEGORY_ICONS: Record<PlaceCategory, typeof MapPin> = {
  [PlaceCategory.FOOD]: UtensilsCrossed,
  [PlaceCategory.BAR]: Beer,
  [PlaceCategory.CAFE]: Coffee,
  [PlaceCategory.WINE]: Wine,
  [PlaceCategory.SHOPPING]: ShoppingBag,
  [PlaceCategory.GROCERY]: ShoppingBag,
  [PlaceCategory.ARTS]: Theater,
  [PlaceCategory.LIGHTHOUSE]: Building2,
  [PlaceCategory.THEATRE]: Theater,
  [PlaceCategory.TOURIST]: Palmtree,
  [PlaceCategory.CASINO]: Building2,
  [PlaceCategory.AQUARIUM]: Building2,
  [PlaceCategory.EVENT_VENUE]: Building2,
  [PlaceCategory.AMUSEMENT_PARK]: Palmtree,
  [PlaceCategory.HISTORIC]: History,
  [PlaceCategory.MUSEUM]: Building,
  [PlaceCategory.MOVIE_THEATRE]: Theater,
  [PlaceCategory.MONUMENT]: Building2,
  [PlaceCategory.MUSIC]: Theater,
  [PlaceCategory.RELIC]: History,
};

const CATEGORY_GROUPS = {
  "Food & Drink": [PlaceCategory.FOOD, PlaceCategory.BAR, PlaceCategory.CAFE, PlaceCategory.WINE],
  "Shopping": [PlaceCategory.SHOPPING, PlaceCategory.GROCERY],
  "Entertainment / Leisure": [
    PlaceCategory.ARTS,
    PlaceCategory.LIGHTHOUSE,
    PlaceCategory.THEATRE,
    PlaceCategory.TOURIST,
    PlaceCategory.CASINO,
    PlaceCategory.AQUARIUM,
    PlaceCategory.EVENT_VENUE,
    PlaceCategory.AMUSEMENT_PARK,
    PlaceCategory.HISTORIC,
    PlaceCategory.MUSEUM,
    PlaceCategory.MOVIE_THEATRE,
    PlaceCategory.MONUMENT,
    PlaceCategory.MUSIC,
    PlaceCategory.RELIC
  ]
};

interface PinnedPlace {
  id: number;
  name: string;
  address: string;
  notes?: string;
  category: PlaceCategory;
  coordinates: {
    lat: number;
    lng: number;
  };
  tripId: number;
  destinationId?: number;
}

interface AddPinnedPlaceForm {
  address: string;
  notes?: string;
  category: PlaceCategory;
}

interface EditPinnedPlaceForm {
  address?: string;
  notes?: string;
  category: PlaceCategory;
}

interface PinnedPlacesProps {
  tripId: number;
  destinationId?: number;
  defaultLocation?: string;
  onPinPlace?: (place: PinnedPlace) => void;
  showMap?: boolean;
  tripCoordinates?: { lat: number; lng: number };
}

// Add helper function for formatting category names
const formatCategoryName = (category: string): string => {
  return category
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

export function PinnedPlaces({
  tripId,
  destinationId,
  defaultLocation,
  onPinPlace,
  showMap = false,
  tripCoordinates
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

  // Add effect to focus search input when dialog opens
  useEffect(() => {
    if (isAddPlaceOpen && searchInputRef) {
      // Small delay to ensure dialog is fully rendered
      const timeoutId = setTimeout(() => {
        searchInputRef.focus();
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [isAddPlaceOpen, searchInputRef]);

  const form = useForm<AddPinnedPlaceForm>({
    defaultValues: {
      address: "",
      notes: "",
      category: PlaceCategory.TOURIST,
    },
  });

  const editForm = useForm<EditPinnedPlaceForm>({
    defaultValues: {
      address: "",
      notes: "",
      category: PlaceCategory.TOURIST,
    },
  });

  useEffect(() => {
    if (placeToEdit) {
      editForm.reset({
        address: placeToEdit.name,
        notes: placeToEdit.notes || "",
        category: placeToEdit.category,
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
        category: PlaceCategory.TOURIST,
      });
      setSelectedCoordinates(null);
    }
  }, [isAddPlaceOpen, form]);

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
  const tripLocation = tripCoordinates ||
    (pinnedPlacesQuery.data?.tripLocation && {
      lat: pinnedPlacesQuery.data.tripLocation.lat,
      lng: pinnedPlacesQuery.data.tripLocation.lng
    });
  console.log('Trip location being used:', tripLocation);

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
          category: data.category,
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

  const getIconComponent = (category: PlaceCategory) => {
    return CATEGORY_ICONS[category] || MapPin;
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
                            initialCenter={tripLocation || tripCoordinates || undefined}
                            searchBias={tripLocation || tripCoordinates ? {
                              ...((tripLocation || tripCoordinates) as { lat: number; lng: number }),
                              radius: 50000 // 50km radius around trip location
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
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(CATEGORY_GROUPS).map(([groupName, categories]) => (
                            <SelectGroup key={groupName}>
                              <SelectLabel>{groupName}</SelectLabel>
                              {[...categories].sort((a, b) => formatCategoryName(a).localeCompare(formatCategoryName(b))).map((category) => {
                                const Icon = getIconComponent(category);
                                return (
                                  <SelectItem key={category} value={category}>
                                    <div className="flex items-center gap-2">
                                      <Icon className="h-4 w-4" />
                                      <span>{formatCategoryName(category)}</span>
                                    </div>
                                  </SelectItem>
                                );
                              })}
                            </SelectGroup>
                          ))}
                        </SelectContent>
                      </Select>
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
            {existingPins.map((place) => {
              const Icon = getIconComponent(place.category);
              return (
                <div
                  key={place.id}
                  className="flex items-center justify-between p-2 rounded-md bg-muted/50 hover:bg-muted/70 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <p className="text-sm font-medium truncate">{place.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPlaceToEdit(place)}
                      className="p-0 h-8 w-8 text-muted-foreground hover:text-primary"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPlaceToDelete(place)}
                      className="p-0 h-8 w-8 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
            {existingPins.length === 0 && (
              <p className="text-center text-muted-foreground py-4">
                No places pinned yet
              </p>
            )}
          </div>
          <ScrollBar orientation="vertical" />
        </ScrollArea>
      </CardContent>

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
                          initialCenter={placeToEdit?.coordinates || tripLocation || tripCoordinates || undefined}
                          searchBias={tripLocation || tripCoordinates ? {
                            ...((tripLocation || tripCoordinates) as { lat: number; lng: number }),
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
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(CATEGORY_GROUPS).map(([groupName, categories]) => (
                          <SelectGroup key={groupName}>
                            <SelectLabel>{groupName}</SelectLabel>
                            {[...categories].sort((a, b) => formatCategoryName(a).localeCompare(formatCategoryName(b))).map((category) => {
                              const Icon = getIconComponent(category);
                              return (
                                <SelectItem key={category} value={category}>
                                  <div className="flex items-center gap-2">
                                    <Icon className="h-4 w-4" />
                                    <span>{formatCategoryName(category)}</span>
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectGroup>
                        ))}
                      </SelectContent>
                    </Select>
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