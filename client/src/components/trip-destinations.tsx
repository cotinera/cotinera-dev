import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Trip, Destination } from "@db/schema";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import { Pin, Plus, ChevronDown, Edit2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { MapPicker } from "@/components/map-picker";

interface AddDestinationForm {
  name: string;
  startDate: string;
  endDate: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

interface EditDestinationForm extends AddDestinationForm {
  id: number;
}

export function TripDestinations({ tripId }: { tripId: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isAddDestinationOpen, setIsAddDestinationOpen] = useState(false);
  const [isEditDestinationOpen, setIsEditDestinationOpen] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCoordinates, setSelectedCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [editingDestination, setEditingDestination] = useState<Destination | null>(null);

  const { data: trip } = useQuery<Trip>({
    queryKey: ["/api/trips", tripId],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripId}`);
      if (!res.ok) throw new Error("Failed to fetch trip");
      return res.json();
    },
  });

  const { data: destinations, refetch } = useQuery<Destination[]>({
    queryKey: [`/api/trips/${tripId}/destinations`],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripId}/destinations`);
      if (!res.ok) throw new Error("Failed to fetch destinations");
      return res.json();
    },
  });

  const addDestinationMutation = useMutation({
    mutationFn: async (data: AddDestinationForm) => {
      if (!selectedCoordinates) {
        throw new Error("Please select a location from the map");
      }

      const res = await fetch(`/api/trips/${tripId}/destinations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          coordinates: selectedCoordinates,
          order: destinations?.length || 0
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to add destination");
      }

      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/destinations`] });
      await refetch();
      setIsAddDestinationOpen(false);
      form.reset();
      setSelectedCoordinates(null);
      toast({
        title: "Success",
        description: "Destination added successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to add destination",
      });
    },
  });

  const editDestinationMutation = useMutation({
    mutationFn: async (data: EditDestinationForm) => {
      const res = await fetch(`/api/trips/${tripId}/destinations/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          startDate: data.startDate,
          endDate: data.endDate,
          coordinates: selectedCoordinates || undefined,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to update destination");
      }

      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/destinations`] });
      await refetch();
      setIsEditDestinationOpen(false);
      editForm.reset();
      setSelectedCoordinates(null);
      setEditingDestination(null);
      toast({
        title: "Success",
        description: "Destination updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update destination",
      });
    },
  });

  const form = useForm<AddDestinationForm>({
    defaultValues: {
      name: "",
      startDate: "",
      endDate: "",
    },
  });

  const editForm = useForm<EditDestinationForm>({
    defaultValues: {
      id: 0,
      name: "",
      startDate: "",
      endDate: "",
    },
  });

  const onSubmit = (data: AddDestinationForm) => {
    addDestinationMutation.mutate(data);
  };

  const onEdit = (destination: Destination) => {
    setEditingDestination(destination);
    setSelectedCoordinates(destination.coordinates);
    editForm.reset({
      id: destination.id,
      name: destination.name,
      startDate: format(new Date(destination.startDate), "yyyy-MM-dd"),
      endDate: format(new Date(destination.endDate), "yyyy-MM-dd"),
    });
    setIsEditDestinationOpen(true);
  };

  const onEditSubmit = (data: EditDestinationForm) => {
    editDestinationMutation.mutate(data);
  };

  const sortedDestinations = destinations?.sort((a, b) => a.order - b.order) || [];
  const totalStops = sortedDestinations.length + 1; // Including the initial stop

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="w-[250px]"
    >
      <Card className="border shadow-sm">
        <CollapsibleTrigger asChild>
          <CardHeader className="p-2 cursor-pointer">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Pin className="h-4 w-4" />
                <span className="font-medium text-sm">
                  Destinations ({totalStops})
                </span>
              </div>
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-200 ${
                  isOpen ? "transform rotate-180" : ""
                }`}
              />
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="p-2 pt-0">
            <div className="space-y-1.5 max-h-[250px] overflow-y-auto">
              {/* Initial Stop */}
              <div
                key="main"
                className="flex items-center justify-between p-1.5 rounded-md bg-muted/50 text-sm"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate text-xs">
                    {trip?.location || 'Starting Point'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {trip?.startDate && format(new Date(trip.startDate), "MMM d")}
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">1</Badge>
              </div>

              {/* Additional Destinations */}
              {sortedDestinations.map((destination, index) => (
                <div
                  key={destination.id}
                  className="flex items-center justify-between p-1.5 rounded-md bg-muted/50 text-sm"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-xs">
                      {destination.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(destination.startDate), "MMM d")} -{" "}
                      {format(new Date(destination.endDate), "MMM d")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => onEdit(destination)}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Badge variant="outline" className="text-xs">
                      {index + 2}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>

            <Dialog open={isAddDestinationOpen} onOpenChange={setIsAddDestinationOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Stop
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Destination</DialogTitle>
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
                            <MapPicker
                              value={field.value}
                              onChange={(address, coordinates) => {
                                field.onChange(address);
                                setSelectedCoordinates(coordinates);
                              }}
                              placeholder="Search for a location..."
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="startDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Start Date</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="endDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>End Date</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={addDestinationMutation.isPending}
                    >
                      {addDestinationMutation.isPending ? "Adding..." : "Add Destination"}
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>

            <Dialog open={isEditDestinationOpen} onOpenChange={setIsEditDestinationOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Destination</DialogTitle>
                </DialogHeader>
                <Form {...editForm}>
                  <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
                    <FormField
                      control={editForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Location</FormLabel>
                          <FormControl>
                            <MapPicker
                              value={field.value}
                              onChange={(address, coordinates) => {
                                field.onChange(address);
                                setSelectedCoordinates(coordinates);
                              }}
                              placeholder="Search for a location..."
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={editForm.control}
                        name="startDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Start Date</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="endDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>End Date</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={editDestinationMutation.isPending}
                    >
                      {editDestinationMutation.isPending ? "Updating..." : "Update Destination"}
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}