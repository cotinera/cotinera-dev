import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MapPicker } from "@/components/map-picker";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Plus, CheckCircle, Trash2, Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
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

interface PinnedPlace {
  id: number;
  name: string;
  address: string;
  notes?: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  tripId: number;
  destinationId?: number;
  addedToChecklist: boolean;
}

interface AddPinnedPlaceForm {
  address: string;
  notes?: string;
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
  const [detailedPlace, setDetailedPlace] = useState<PinnedPlace | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedPlaceName, setSelectedPlaceName] = useState<string>("");

  const form = useForm<AddPinnedPlaceForm>({
    defaultValues: {
      address: "",
      notes: "",
    },
  });


  const { data: pinnedPlaces = [] } = useQuery<PinnedPlace[]>({
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
      return res.json();
    },
  });

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
      if (onPinPlace) {
        onPinPlace(newPlace);
      }
      return newPlace;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/trips/${tripId}/pinned-places`]
      });
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

  const onSubmit = (data: AddPinnedPlaceForm) => {
    addPinnedPlaceMutation.mutate(data);
  };

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

  const addToChecklistMutation = useMutation({
    mutationFn: async (placeId: number) => {
      const res = await fetch(`/api/trips/${tripId}/pinned-places/${placeId}/checklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
      });

      if (!res.ok) {
        const errorText = await res.text();
        try {
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.error || "Failed to add to checklist");
        } catch {
          throw new Error(errorText || "Failed to add to checklist");
        }
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
        description: "Added to checklist successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to add to checklist",
      });
    },
  });

  const handleDeletePlace = () => {
    if (!placeToDelete) return;
    deletePinnedPlaceMutation.mutate(placeToDelete.id);
  };

  return (
    <Card>
      {showMap && (
        <div className="mb-4">
          <MapPicker
            value=""
            onChange={() => {}}
            existingPins={pinnedPlaces}
            readOnly
            initialCenter={tripCoordinates}
          />
        </div>
      )}
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
                Pinned places will appear on your trip map.
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
                              if (name) {
                                setSelectedPlaceName(name);
                              }
                            }}
                            placeholder="Search for a place to pin..."
                            existingPins={pinnedPlaces}
                            initialCenter={tripCoordinates}
                            searchBias={tripCoordinates ? {
                              ...tripCoordinates,
                              radius: 50000
                            } : undefined}
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
                <Button
                  type="submit"
                  className="w-full"
                  disabled={!selectedCoordinates || !selectedPlaceName || addPinnedPlaceMutation.isPending}
                >
                  {addPinnedPlaceMutation.isPending ? "Pinning..." : "Pin Place"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[200px] w-full rounded-md">
          <div className="space-y-2">
            {pinnedPlaces.map((place) => (
              <div
                key={place.id}
                className="flex items-center justify-between p-2 rounded-md bg-muted/50 hover:bg-muted/70 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{place.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDetailedPlace(place)}
                    className="p-0 h-8 w-8"
                  >
                    <Info className="h-4 w-4" />
                  </Button>
                  {!place.addedToChecklist && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => addToChecklistMutation.mutate(place.id)}
                      className="flex items-center gap-1"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Add to Checklist
                    </Button>
                  )}
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
            ))}
            {pinnedPlaces.length === 0 && (
              <p className="text-center text-muted-foreground py-4">
                No places pinned yet
              </p>
            )}
          </div>
          <ScrollBar orientation="vertical" />
        </ScrollArea>
      </CardContent>
      <AlertDialog open={placeToDelete !== null} onOpenChange={setPlaceToDelete}>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete Pinned Place
          </AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this pinned place? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleDeletePlace}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialog>
    </Card>
  );
}