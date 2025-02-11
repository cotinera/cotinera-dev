import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Participant } from "@db/schema";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardContent,
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
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import { Users, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TripParticipantDetailsProps {
  tripId: number;
}

interface AddParticipantForm {
  name: string;
  email?: string;
  passportNumber?: string;
  arrivalDate?: string;
  departureDate?: string;
}

export function TripParticipantDetails({ tripId }: TripParticipantDetailsProps) {
  const { toast } = useToast();
  const [isAddParticipantOpen, setIsAddParticipantOpen] = useState(false);

  const { data: tripParticipants, refetch } = useQuery<Participant[]>({
    queryKey: [`/api/trips/${tripId}/participants`],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripId}/participants`);
      if (!res.ok) throw new Error("Failed to fetch participants");
      const data = await res.json();
      return data.participants;
    },
  });

  const addParticipantMutation = async (data: AddParticipantForm) => {
    try {
      const res = await fetch(`/api/trips/${tripId}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to add participant");
      }

      await refetch();
      setIsAddParticipantOpen(false);
      form.reset();
      toast({
        title: "Success",
        description: "Participant added successfully",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add participant",
      });
    }
  };

  const form = useForm<AddParticipantForm>({
    defaultValues: {
      name: "",
      email: "",
      passportNumber: "",
      arrivalDate: "",
      departureDate: "",
    },
  });

  const onSubmit = (data: AddParticipantForm) => {
    addParticipantMutation(data);
  };

  const updateBookingStatus = async (participantId: number, status: string) => {
    try {
      const res = await fetch(`/api/trips/${tripId}/participants/${participantId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) throw new Error("Failed to update status");
      await refetch();
      toast({
        title: "Success",
        description: "Status updated successfully",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update status",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="font-semibold">Participants</span>
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
                  <Button
                    type="submit"
                    className="w-full"
                  >
                    Add Traveller
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
              <TableHead>Participant</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tripParticipants?.map((participant) => (
              <TableRow key={participant.id}>
                <TableCell className="font-medium">
                  {participant.name}
                </TableCell>
                <TableCell>
                  {participant.arrivalDate && participant.departureDate ? (
                    <span>
                      {format(new Date(participant.arrivalDate), "MMM d")} -{" "}
                      {format(new Date(participant.departureDate), "MMM d, yyyy")}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">No dates set</span>
                  )}
                </TableCell>
                <TableCell>
                  <Button
                    variant={participant.status === "confirmed" ? "default" : "outline"}
                    size="sm"
                    onClick={() => updateBookingStatus(
                      participant.id,
                      participant.status === "confirmed" ? "pending" : "confirmed"
                    )}
                  >
                    {participant.status === "confirmed" ? "Confirmed" : "Pending"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}