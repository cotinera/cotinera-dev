import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Trip, Participant } from "@db/schema";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import { Plus, X, Check, X as XIcon, Clock } from "lucide-react";
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

const STATUS_CYCLE = ['pending', 'yes', 'no'] as const;
type Status = (typeof STATUS_CYCLE)[number];

export function TripParticipantDetails({ tripId }: TripParticipantDetailsProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isAddParticipantOpen, setIsAddParticipantOpen] = useState(false);

  const { data: participants = [], refetch } = useQuery<Participant[]>({
    queryKey: [`/api/trips/${tripId}/participants`],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripId}/participants`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to fetch participants");
      }
      return res.json();
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ participantId, status }: { participantId: number; status: Status }) => {
      const res = await fetch(`/api/trips/${tripId}/participants/${participantId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update status");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/participants`] });
      toast({
        title: "Success",
        description: "Status updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update status",
      });
    },
  });

  const deleteParticipantMutation = useMutation({
    mutationFn: async (participantId: number) => {
      const res = await fetch(`/api/trips/${tripId}/participants/${participantId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete participant");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/participants`] });
      toast({
        title: "Success",
        description: "Participant removed successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to remove participant",
      });
    },
  });

  const addParticipantMutation = useMutation({
    mutationFn: async (data: AddParticipantForm) => {
      const res = await fetch(`/api/trips/${tripId}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, status: 'pending' as Status }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to add participant");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/participants`] });
      setIsAddParticipantOpen(false);
      form.reset();
      toast({ title: "Success", description: "Person added successfully" });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to add person",
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

  const getStatusBadgeVariant = (status: Status) => {
    switch (status) {
      case 'yes':
        return 'default';
      case 'no':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'yes':
        return <Check className="h-4 w-4" />;
      case 'no':
        return <XIcon className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'yes':
        return 'Confirmed';
      case 'no':
        return 'Declined';
      default:
        return 'Pending';
    }
  };

  const handleStatusChange = (participantId: number, newStatus: Status) => {
    updateStatusMutation.mutate({ participantId, status: newStatus });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <CardTitle>People</CardTitle>
          <Dialog open={isAddParticipantOpen} onOpenChange={setIsAddParticipantOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Person
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Person</DialogTitle>
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
                    {addParticipantMutation.isPending ? "Adding..." : "Add Person"}
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
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="w-[50px]" />
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
                  <TableCell>{participant.flightNumber || "-"}</TableCell>
                  <TableCell>
                    {participant.departureDate && format(new Date(participant.departureDate), "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell>{participant.flightNumber || "-"}</TableCell>
                  <TableCell>{participant.hotelBooking || "-"}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          className="flex items-center gap-2 px-2 py-1 h-8"
                          disabled={updateStatusMutation.isPending}
                        >
                          <Badge
                            variant={getStatusBadgeVariant(participant.status as Status)}
                            className="gap-1"
                          >
                            {updateStatusMutation.isPending ? (
                              <span className="animate-spin">⟳</span>
                            ) : (
                              getStatusIcon(participant.status)
                            )}
                            {getStatusDisplay(participant.status)}
                          </Badge>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => handleStatusChange(participant.id, 'yes')}
                          className="gap-2"
                          disabled={updateStatusMutation.isPending}
                        >
                          <Check className="h-4 w-4" /> Confirm
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleStatusChange(participant.id, 'no')}
                          className="gap-2"
                          disabled={updateStatusMutation.isPending}
                        >
                          <XIcon className="h-4 w-4" /> Decline
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleStatusChange(participant.id, 'pending')}
                          className="gap-2"
                          disabled={updateStatusMutation.isPending}
                        >
                          <Clock className="h-4 w-4" /> Reset to Pending
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        if (window.confirm('Are you sure you want to remove this person?')) {
                          deleteParticipantMutation.mutate(participant.id);
                        }
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-4 text-muted-foreground">
                  No people added yet
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}