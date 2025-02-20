import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Trip } from "@db/schema";
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
import { Plus, X, Check, X as XIcon, Clock, Edit2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface Accommodation {
  id: number;
  tripId: number;
  name: string;
  type: string;
  address: string;
  checkInDate: string;
  checkOutDate: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  bookingReference: string;
  bookingStatus: string;
  price: number | null;
  currency: string;
  roomType: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface Participant {
  id: number;
  name: string | null;
  tripId: number;
  userId: number | null;
  status: string;
  arrivalDate: string | null;
  departureDate: string | null;
  flightStatus: string;
  hotelStatus: string;
  flightIn: string | null;
  flightOut: string | null;
  accommodation: Accommodation | null;
}

interface ParticipantForm {
  name: string;
  arrivalDate?: string;
  departureDate?: string;
  flightIn?: string;
  flightOut?: string;
  accommodation?: string;
}

const STATUS_CYCLE = ['pending', 'yes', 'no'] as const;
type Status = (typeof STATUS_CYCLE)[number];

const sortParticipants = (a: Participant, b: Participant) => {
  const statusOrder = {
    yes: 0,
    pending: 1,
    no: 2
  };
  return statusOrder[a.status as Status] - statusOrder[b.status as Status];
};

export function TripParticipantDetails({ tripId }: TripParticipantDetailsProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isAddParticipantOpen, setIsAddParticipantOpen] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);
  const [updatingParticipants, setUpdatingParticipants] = useState<number[]>([]);

  // Fetch trip details to get dates
  const { data: trip } = useQuery<Trip>({
    queryKey: ["/api/trips", tripId],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripId}`);
      if (!res.ok) throw new Error("Failed to fetch trip");
      return res.json();
    },
  });

  const { data: participants = [] } = useQuery<Participant[]>({
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

  // Initialize form with trip dates
  const addForm = useForm<ParticipantForm>({
    defaultValues: {
      name: "",
      arrivalDate: trip?.startDate ? format(new Date(trip.startDate), "yyyy-MM-dd") : "",
      departureDate: trip?.endDate ? format(new Date(trip.endDate), "yyyy-MM-dd") : "",
      flightIn: "",
      flightOut: "",
      accommodation: "",
    },
  });

  const editForm = useForm<ParticipantForm>({
    defaultValues: {
      name: editingParticipant?.name || "",
      arrivalDate: editingParticipant?.arrivalDate || "",
      departureDate: editingParticipant?.departureDate || "",
      flightIn: editingParticipant?.flightIn || "",
      flightOut: editingParticipant?.flightOut || "",
      accommodation: editingParticipant?.accommodation?.name || "",
    },
  });

  const addParticipantMutation = useMutation({
    mutationFn: async (data: ParticipantForm) => {
      const res = await fetch(`/api/trips/${tripId}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          status: 'pending' as Status,
          flightStatus: 'pending',
          hotelStatus: 'pending'
        }),
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
      addForm.reset();
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

  const updateParticipantMutation = useMutation({
    mutationFn: async ({ participantId, data }: { participantId: number; data: Partial<ParticipantForm> }) => {
      const res = await fetch(`/api/trips/${tripId}/participants/${participantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update participant");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/participants`] });
      setEditingParticipant(null);
      toast({
        title: "Success",
        description: "Participant updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update participant",
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ participantId, status }: { participantId: number; status: Status }) => {
      setUpdatingParticipants(prev => [...prev, participantId]);
      try {
        const res = await fetch(`/api/trips/${tripId}/participants/${participantId}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });

        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.message || "Failed to update status");
        }

        const updatedParticipant = await res.json();
        return { participantId, status: updatedParticipant.status };
      } finally {
        setUpdatingParticipants(prev => prev.filter(id => id !== participantId));
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData<Participant[]>(
        [`/api/trips/${tripId}/participants`],
        (old) => old?.map(p => (p.id === data.participantId ? { ...p, status: data.status } : p)) ?? []
      );
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
              <Form {...addForm}>
                <form onSubmit={addForm.handleSubmit(data => addParticipantMutation.mutate(data))}
                      className="space-y-4">
                  <FormField
                    control={addForm.control}
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

                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={addForm.control}
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
                        control={addForm.control}
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
                        control={addForm.control}
                        name="flightIn"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Flight In</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter arrival flight" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={addForm.control}
                        name="flightOut"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Flight Out</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter departure flight" {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <FormField
                    control={addForm.control}
                    name="accommodation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Accommodation</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter hotel or accommodation" {...field} />
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
              <TableHead>Flight In</TableHead>
              <TableHead>Departure</TableHead>
              <TableHead>Flight Out</TableHead>
              <TableHead>Hotel</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {participants && participants.length > 0 ? (
              [...participants].sort(sortParticipants).map((participant) => (
                <TableRow key={participant.id}>
                  <TableCell>{participant.name}</TableCell>
                  <TableCell>
                    {participant.arrivalDate && format(new Date(participant.arrivalDate), "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell>{participant.flightIn || "-"}</TableCell>
                  <TableCell>
                    {participant.departureDate && format(new Date(participant.departureDate), "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell>{participant.flightOut || "-"}</TableCell>
                  <TableCell>{participant.accommodation?.name || "-"}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          className="flex items-center gap-2 px-2 py-1 h-8"
                          disabled={updatingParticipants.includes(participant.id)}
                        >
                          <Badge
                            variant={getStatusBadgeVariant(participant.status as Status)}
                            className="gap-1"
                          >
                            {updatingParticipants.includes(participant.id) ? (
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
                          disabled={updatingParticipants.includes(participant.id)}
                        >
                          <Check className="h-4 w-4" /> Confirm
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleStatusChange(participant.id, 'no')}
                          className="gap-2"
                          disabled={updatingParticipants.includes(participant.id)}
                        >
                          <XIcon className="h-4 w-4" /> Decline
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleStatusChange(participant.id, 'pending')}
                          className="gap-2"
                          disabled={updatingParticipants.includes(participant.id)}
                        >
                          <Clock className="h-4 w-4" /> Reset to Pending
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Dialog
                        open={editingParticipant?.id === participant.id}
                        onOpenChange={(open) => {
                          if (!open) setEditingParticipant(null);
                          if (open) {
                            setEditingParticipant(participant);
                            editForm.reset({
                              name: participant.name || "",
                              arrivalDate: participant.arrivalDate || "",
                              departureDate: participant.departureDate || "",
                              flightIn: participant.flightIn || "",
                              flightOut: participant.flightOut || "",
                              accommodation: participant.accommodation?.name || "",
                            });
                          }
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Edit Participant</DialogTitle>
                          </DialogHeader>
                          <Form {...editForm}>
                            <form
                              onSubmit={editForm.handleSubmit((data) =>
                                updateParticipantMutation.mutate({
                                  participantId: participant.id,
                                  data,
                                })
                              )}
                              className="space-y-4"
                            >
                              <FormField
                                control={editForm.control}
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
                                  control={editForm.control}
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
                                  control={editForm.control}
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
                              <div className="grid grid-cols-2 gap-4">
                                <FormField
                                  control={editForm.control}
                                  name="flightIn"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Flight In</FormLabel>
                                      <FormControl>
                                        <Input placeholder="Enter arrival flight" {...field} />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={editForm.control}
                                  name="flightOut"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Flight Out</FormLabel>
                                      <FormControl>
                                        <Input placeholder="Enter departure flight" {...field} />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                              </div>
                              <FormField
                                control={editForm.control}
                                name="accommodation"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Accommodation</FormLabel>
                                    <FormControl>
                                      <Input placeholder="Enter hotel or accommodation" {...field} />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              <Button type="submit" className="w-full">
                                {updateParticipantMutation.isPending ? "Updating..." : "Update Person"}
                              </Button>
                            </form>
                          </Form>
                        </DialogContent>
                      </Dialog>
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
                    </div>
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