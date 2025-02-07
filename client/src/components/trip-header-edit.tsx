import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { format } from "date-fns";
import { Calendar, MapPin, Loader2 } from "lucide-react";
import { ViewToggle } from "@/components/view-toggle";
import type { Trip } from "@db/schema";
import { insertTripSchema } from "@db/schema";
import { useToast } from "@/hooks/use-toast";
import * as z from "zod";

const editTripSchema = insertTripSchema.pick({
  title: true,
  location: true,
  startDate: true,
  endDate: true,
});

type EditTripData = z.infer<typeof editTripSchema>;

interface TripHeaderEditProps {
  trip: Trip;
  onBack: () => void;
}

export function TripHeaderEdit({ trip, onBack }: TripHeaderEditProps) {
  const [isEditing, setIsEditing] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<EditTripData>({
    resolver: zodResolver(editTripSchema),
    defaultValues: {
      title: trip.title,
      location: trip.location,
      startDate: trip.startDate,
      endDate: trip.endDate,
    },
  });

  const updateTripMutation = useMutation({
    mutationFn: async (data: EditTripData) => {
      const res = await fetch(`/api/trips/${trip.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
        credentials: 'include'
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      return res.json();
    },
    onSuccess: (updatedTrip) => {
      // Update both the detailed trip view and the trips list cache
      queryClient.setQueryData(["/api/trips", trip.id], updatedTrip);

      // Update the trip in the trips list cache
      queryClient.setQueryData(["/api/trips"], (oldData: Trip[] | undefined) => {
        if (!oldData) return oldData;
        return oldData.map(t => t.id === trip.id ? updatedTrip : t);
      });

      setIsEditing(false);
      toast({
        title: "Success",
        description: "Trip details updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update trip details",
      });
    },
  });

  const onSubmit = (data: EditTripData) => {
    updateTripMutation.mutate(data);
  };

  if (!isEditing) {
    return (
      <div className="text-center cursor-pointer" onClick={() => setIsEditing(true)}>
        <h1 className="text-3xl font-bold mb-2 hover:text-primary/80 transition-colors">
          {trip.title}
        </h1>
        <div className="flex items-center justify-center gap-2 text-muted-foreground mt-2 hover:text-primary/80 transition-colors">
          <MapPin className="h-4 w-4" />
          <span>{trip.location}</span>
        </div>
        <div className="flex items-center justify-center gap-2 text-muted-foreground mt-1 hover:text-primary/80 transition-colors">
          <Calendar className="h-4 w-4" />
          <span>
            {format(new Date(trip.startDate), "MMM d, yyyy")} -{" "}
            {format(new Date(trip.endDate), "MMM d, yyyy")}
          </span>
        </div>
        <div className="mt-4">
          <ViewToggle tripId={trip.id} />
        </div>
      </div>
    );
  }

  return (
    <div className="text-center">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    {...field}
                    className="text-2xl font-bold text-center"
                    placeholder="Trip Title"
                  />
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
                <FormControl>
                  <Input
                    {...field}
                    className="text-center"
                    placeholder="Location"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      {...field}
                      type="date"
                      className="text-center"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="endDate"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      {...field}
                      type="date"
                      className="text-center"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="flex justify-center gap-2">
            <Button 
              type="submit" 
              disabled={updateTripMutation.isPending}
            >
              {updateTripMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Changes
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditing(false)}
              disabled={updateTripMutation.isPending}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Form>
      <div className="mt-4">
        <ViewToggle tripId={trip.id} />
      </div>
    </div>
  );
}