import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MapPicker } from "@/components/map-picker";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Plus, CheckCircle, Trash2, Coffee, UtensilsCrossed, Wine, Beer, Building2, ShoppingBag, Theater, Palmtree, History, Building } from "lucide-react";
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
  notes?: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  category: PlaceCategory;
  tripId: number;
  destinationId?: number;
  addedToChecklist: boolean;
}

interface AddPinnedPlaceForm {
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
  const [selectedPlaceName, setSelectedPlaceName] = useState<string>("");

  const form = useForm<AddPinnedPlaceForm>({
    defaultValues: {
      notes: "",
      category: PlaceCategory.TOURIST,
    },
  });

  const pinnedPlacesQuery = useQuery<PinnedPlace[]>({
    queryKey: [`/api/trips/${tripId}/pinned-places`, destinationId],
    queryFn: async () => {
      const url = new URL(`/api/trips/${tripId}/pinned-places`, window.location.origin);
      if (destinationId) {
        url.searchParams.append('destinationId', destinationId.toString());
      }
      const res = await fetch(url);
      if (!res.ok) {
        const error = await res.text();
        throw new Error(error);
      }
      return res.json();
    },
  });

  const addPinnedPlaceMutation = useMutation({
    mutationFn: async (data: AddPinnedPlaceForm) => {
      if (!selectedCoordinates || !selectedPlaceName) {
        throw new Error("Please select a location");
      }

      const payload = {
        name: selectedPlaceName,
        notes: data.notes,
        coordinates: selectedCoordinates,
        category: data.category,
        destinationId,
        addedToChecklist: false,
      };

      console.log('Sending payload:', payload);

      const res = await fetch(`/api/trips/${tripId}/pinned-places`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Failed to add pinned place");
      }

      return res.json();
    },
    onSuccess: (newPlace) => {
      queryClient.setQueryData<PinnedPlace[]>(
        [`/api/trips/${tripId}/pinned-places`, destinationId],
        (old) => [...(old || []), newPlace]
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
      console.error('Error adding pinned place:', error);
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

  const addToChecklistMutation = useMutation({
    mutationFn: async (placeId: number) => {
      const res = await fetch(`/api/trips/${tripId}/checklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Visit ${pinnedPlacesQuery.data?.find(p => p.id === placeId)?.name || 'place'}`,
        }),
      });

      if (!res.ok) {
        const error = await res.text();
        throw new Error(error);
      }

      const updateRes = await fetch(`/api/trips/${tripId}/pinned-places/${placeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addedToChecklist: true,
        }),
      });

      if (!updateRes.ok) {
        throw new Error("Failed to update pinned place status");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/trips/${tripId}/pinned-places`]
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/trips/${tripId}/checklist`]
      });
      toast({
        title: "Success",
        description: "Place added to checklist",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to add place to checklist",
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

    addPinnedPlaceMutation.mutate(data);
  };

  const handleAddToChecklist = (place: PinnedPlace) => {
    if (!place.addedToChecklist) {
      addToChecklistMutation.mutate(place.id);
    }
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
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <div className="h-[400px] w-full">
                      <MapPicker
                        value={selectedPlaceName}
                        onChange={(address, coordinates, name) => {
                          setSelectedCoordinates(coordinates);
                          setSelectedPlaceName(name || address);
                        }}
                        placeholder="Search for a place to pin..."
                        existingPins={pinnedPlacesQuery.data || []}
                        initialCenter={tripCoordinates}
                        searchBias={tripCoordinates ? {
                          ...tripCoordinates,
                          radius: 50000
                        } : undefined}
                      />
                    </div>
                  </FormControl>
                </FormItem>

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
                              {categories.map((category) => {
                                const Icon = getIconComponent(category);
                                return (
                                  <SelectItem key={category} value={category}>
                                    <div className="flex items-center gap-2">
                                      <Icon className="h-4 w-4" />
                                      <span>{category.replace(/_/g, ' ').toLowerCase()}</span>
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
            {(pinnedPlacesQuery.data || []).map((place) => {
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
                      onClick={() => handleAddToChecklist(place)}
                      className={cn(
                        "p-0 h-8 w-8",
                        place.addedToChecklist ? "text-green-600" : "text-muted-foreground hover:text-green-600"
                      )}
                      disabled={place.addedToChecklist}
                    >
                      <CheckCircle className="h-4 w-4" />
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
            {(pinnedPlacesQuery.data || []).length === 0 && (
              <p className="text-center text-muted-foreground py-4">
                No places pinned yet
              </p>
            )}
          </div>
          <ScrollBar orientation="vertical" />
        </ScrollArea>
      </CardContent>

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