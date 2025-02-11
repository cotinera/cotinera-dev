import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Trip, Participant, Flight, Accommodation, User } from "@db/schema";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import { CalendarDays, Hotel, Plane, Users, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface TripParticipantDetailsProps {
  tripId: number;
}

type BookingStatus = "yes" | "no" | "pending";

interface ParticipantDetails extends Participant {
  user: User | null;
  flights?: Flight[];
  accommodation?: Accommodation;
}

interface AddParticipantForm {
  name: string;
  email?: string;
  passportNumber?: string;
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

  // Fetch trip and participants with their travel details
  const { data: tripDetails, refetch } = useQuery<{
    participants: ParticipantDetails[];
    owner: User;
  }>({
    queryKey: [`/api/trips/${tripId}/participants`],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripId}/participants`);
      if (!res.ok) throw new Error("Failed to fetch participants");
      return res.json();
    },
  });

  const addParticipantMutation = useMutation({
    mutationFn: async (data: AddParticipantForm) => {
      try {
        const res = await fetch(`/api/trips/${tripId}/participants`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...data,
            arrivalDate: data.arrivalDate || null,
            departureDate: data.departureDate || null,
          }),
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || "Failed to add participant");
        }

        return res.json();
      } catch (error) {
        console.error("Error adding participant:", error);
        throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/participants`] });
      await refetch();
      setIsAddParticipantOpen(false);
      form.reset();
      toast({
        title: "Success",
        description: "Participant added successfully",
      });
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
      email: "",
      passportNumber: "",
      arrivalDate: "",
      departureDate: "",
      flightNumber: "",
      airline: "",
      accommodation: "",
    },
  });

  const onSubmit = (data: AddParticipantForm) => {
    addParticipantMutation.mutate(data);
  };

  const updateBookingStatus = async (
    participantId: number,
    type: "flight" | "hotel",
    status: BookingStatus
  ) => {
    try {
      const res = await fetch(`/api/trips/${tripId}/participants/${participantId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, status }),
      });

      if (!res.ok) throw new Error(`Failed to update ${type} status`);

      await queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/participants`] });
      await refetch(); // Force a refresh after status update
      toast({
        title: "Success",
        description: `${type.charAt(0).toUpperCase() + type.slice(1)} status updated`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : `Failed to update ${type} status`,
      });
    }
  };

  const participants = tripDetails?.participants || [];
  const owner = tripDetails?.owner;

  // Sort participants to show owner first
  const sortedParticipants = [...participants].sort((a, b) => {
    if (a.user?.id === owner?.id) return -1;
    if (b.user?.id === owner?.id) return 1;
    return 0;
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Trip Details</CardTitle>
            <CardDescription>Manage participant travel arrangements</CardDescription>
          </div>
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
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name*</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter name" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email (Optional)</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="Enter email" {...field} />
                        </FormControl>
                        <FormDescription>
                          Only required if the participant needs access to the trip details
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="passportNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Passport Number (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter passport number" {...field} />
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
                          <FormLabel>Arrival Date</FormLabel>
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
                          <FormLabel>Departure Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="airline"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Airline (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter airline" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="flightNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Flight # (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter flight number" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="accommodation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Accommodation (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter accommodation details" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={addParticipantMutation.isPending}
                  >
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
              <TableHead><Users className="h-4 w-4" /> Participant</TableHead>
              <TableHead><CalendarDays className="h-4 w-4" /> Dates</TableHead>
              <TableHead><Hotel className="h-4 w-4" /> Accommodation</TableHead>
              <TableHead><Plane className="h-4 w-4" /> Flight</TableHead>
              <TableHead>Booking Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedParticipants.map((participant) => (
              <TableRow key={participant.id}>
                <TableCell className="font-medium">
                  {participant.user ? participant.user.name : participant.name}
                  {participant.user?.id === owner?.id && (
                    <Badge variant="secondary" className="ml-2">Owner</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {participant.arrivalDate && participant.departureDate ? (
                    <span>
                      {format(new Date(participant.arrivalDate), "MMM d")} -{" "}
                      {format(new Date(participant.departureDate), "MMM d, yyyy")}
                    </span>
                  ) : (
                    <Badge variant="outline">Dates not set</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {participant.accommodation ? (
                    <span>{participant.accommodation.name}</span>
                  ) : (
                    <Badge variant="outline">Not booked</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {participant.flights?.length ? (
                    <div className="flex flex-col gap-1">
                      {participant.flights.map((flight) => (
                        <div key={flight.id} className="text-sm">
                          {flight.airline} {flight.flightNumber}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Badge variant="outline">Not booked</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Select
                      value={participant.flightStatus}
                      onValueChange={(value: BookingStatus) =>
                        updateBookingStatus(participant.id, "flight", value)
                      }
                    >
                      <SelectTrigger className="w-[100px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Flight ✓</SelectItem>
                        <SelectItem value="no">Flight ✗</SelectItem>
                        <SelectItem value="pending">Flight ?</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={participant.hotelStatus}
                      onValueChange={(value: BookingStatus) =>
                        updateBookingStatus(participant.id, "hotel", value)
                      }
                    >
                      <SelectTrigger className="w-[100px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Hotel ✓</SelectItem>
                        <SelectItem value="no">Hotel ✗</SelectItem>
                        <SelectItem value="pending">Hotel ?</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}