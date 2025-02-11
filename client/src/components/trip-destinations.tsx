import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Trip, Destination } from "@db/schema";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
import { Map, Pin, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface TripDestinationsProps {
  tripId: number;
}

interface AddDestinationForm {
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export function TripDestinations({ tripId }: TripDestinationsProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isAddDestinationOpen, setIsAddDestinationOpen] = useState(false);

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
      const res = await fetch(`/api/trips/${tripId}/destinations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
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

  const form = useForm<AddDestinationForm>({
    defaultValues: {
      name: "",
      description: "",
      startDate: "",
      endDate: "",
    },
  });

  const onSubmit = (data: AddDestinationForm) => {
    addDestinationMutation.mutate(data);
  };

  const sortedDestinations = destinations?.sort((a, b) => a.order - b.order) || [];

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Trip Destinations</CardTitle>
            <CardDescription>Manage multiple destinations for this trip</CardDescription>
          </div>
          <Dialog open={isAddDestinationOpen} onOpenChange={setIsAddDestinationOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Destination
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
                        <FormLabel>Location Name*</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter location name" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Enter destination description"
                            {...field}
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
                          <FormLabel>Start Date*</FormLabel>
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
                          <FormLabel>End Date*</FormLabel>
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
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {sortedDestinations.map((destination, index) => (
            <Card key={destination.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">
                      <Pin className="h-4 w-4 inline mr-2" />
                      {destination.name}
                    </CardTitle>
                    <CardDescription>
                      {format(new Date(destination.startDate), "MMM d")} -{" "}
                      {format(new Date(destination.endDate), "MMM d, yyyy")}
                    </CardDescription>
                  </div>
                  <Badge>{`Stop ${index + 1}`}</Badge>
                </div>
              </CardHeader>
              {destination.description && (
                <CardContent>
                  <p className="text-sm text-muted-foreground">{destination.description}</p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
