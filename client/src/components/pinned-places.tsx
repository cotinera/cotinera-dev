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
import { MapPin, Plus, CheckCircle } from "lucide-react";
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
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

interface PinnedPlace {
  id: number;
  name: string;
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
  name: string;
  notes?: string;
}

interface PinnedPlacesProps {
  tripId: number;
  destinationId?: number;
  defaultLocation?: string;
  onPinPlace?: (place: PinnedPlace) => void;
}

export function PinnedPlaces({ tripId, destinationId, defaultLocation, onPinPlace }: PinnedPlacesProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddPlaceOpen, setIsAddPlaceOpen] = useState(false);
  const [selectedCoordinates, setSelectedCoordinates] = useState<{ lat: number; lng: number } | null>(null);

  const form = useForm<AddPinnedPlaceForm>({
    defaultValues: {
      name: "",
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
      if (!selectedCoordinates) {
        throw new Error("Please select a location on the map");
      }

      const res = await fetch(`/api/trips/${tripId}/pinned-places`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({
          ...data,
          coordinates: selectedCoordinates,
          destinationId,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        try {
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.error || "Failed to add pinned place");
        } catch {
          throw new Error(errorText || "Failed to add pinned place");
        }
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

  const onSubmit = (data: AddPinnedPlaceForm) => {
    addPinnedPlaceMutation.mutate(data);
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
                Search for a location and pin it to your trip. Pinned places will appear on your trip map.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location</FormLabel>
                      <FormControl>
                        <div className="h-[400px] w-full">
                          <MapPicker
                            value={field.value}
                            onChange={(address, coordinates) => {
                              field.onChange(address);
                              setSelectedCoordinates(coordinates);
                            }}
                            placeholder="Search for a place to pin..."
                          />
                        </div>
                      </FormControl>
                      <FormDescription>
                        Search for a location or click on the map to pin a place
                      </FormDescription>
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
                  disabled={!selectedCoordinates || addPinnedPlaceMutation.isPending}
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
                  {place.notes && (
                    <p className="text-xs text-muted-foreground truncate">
                      {place.notes}
                    </p>
                  )}
                </div>
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
    </Card>
  );
}