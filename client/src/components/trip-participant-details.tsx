import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Trip, Participant, Flight, Accommodation } from "@db/schema";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface TripParticipantDetailsProps {
  tripId: number;
}

interface AddParticipantForm {
  name: string;
  arrivalDate?: string;
  departureDate?: string;
  flightNumber?: string;
  airline?: string;
  accommodation?: string;
}

export function TripParticipantDetails({ tripId }: TripParticipantDetailsProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isAddParticipantOpen, setIsAddParticipantOpen] = useState(false);

  const { data: participants = [], refetch } = useQuery({
    queryKey: [`/api/trips/${tripId}/participants`],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripId}/participants`);
      if (!res.ok) throw new Error("Failed to fetch participants");
      return res.json();
    },
  });

  const addParticipantMutation = useMutation({
    mutationFn: async (data: AddParticipantForm) => {
      const res = await fetch(`/api/trips/${tripId}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to add participant");
      }

      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/participants`] });
      await refetch();
      setIsAddParticipantOpen(false);
      form.reset();
      toast({ title: "Success", description: "Participant added successfully" });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to add participant",
      });
    },
  });

  const form = useForm<AddParticipantForm>({
    defaultValues: {
      name: "",
      arrivalDate: "",
      departureDate: "",
      flightNumber: "",
      airline: "",
      accommodation: "",
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <CardTitle>Travellers</CardTitle>
          <Dialog open={isAddParticipantOpen} onOpenChange={setIsAddParticipantOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Traveller
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Traveller</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(data => addParticipantMutation.mutate(data))} 
                      className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter name" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="arrivalDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Arrival</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="departureDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Departure</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="flightNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Flight Number</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter flight number" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full">
                    {addParticipantMutation.isPending ? "Adding..." : "Add Traveller"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Arrival</TableHead>
              <TableHead>Flight in</TableHead>
              <TableHead>Departure</TableHead>
              <TableHead>Flight Out</TableHead>
              <TableHead>Hotel</TableHead>
              <TableHead className="w-[100px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {participants && participants.length > 0 ? (
              participants.map((participant) => (
                <TableRow key={participant.id}>
                  <TableCell>{participant.name}</TableCell>
                  <TableCell>
                    {participant.arrivalDate && format(new Date(participant.arrivalDate), "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell>
                    <Input 
                      className="w-40" 
                      placeholder="Flight number & time"
                      defaultValue={participant.flights?.[0]?.flightNumber || ""}
                    />
                  </TableCell>
                  <TableCell>
                    {participant.departureDate && format(new Date(participant.departureDate), "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell>
                    <Input 
                      className="w-40" 
                      placeholder="Flight number & time"
                      defaultValue={participant.flights?.[1]?.flightNumber || ""}
                    />
                  </TableCell>
                  <TableCell>
                    <Input 
                      className="w-40" 
                      placeholder="Hotel name"
                      defaultValue={participant.accommodation?.name || ""}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Badge variant={participant.flightStatus === "yes" ? "default" : "secondary"}>
                        {participant.flightStatus === "yes" ? "Booked" : "Pending"}
                      </Badge>
                      <Badge variant={participant.hotelStatus === "yes" ? "default" : "secondary"}>
                        {participant.hotelStatus === "yes" ? "Paid" : "Pending"}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteParticipantMutation.mutate(participant.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-4 text-muted-foreground">
                  No travellers added yet
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}