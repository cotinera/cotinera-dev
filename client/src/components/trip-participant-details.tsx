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
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import { Plus, X, Check, X as XIcon, Clock, Edit2, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

interface TripParticipantDetailsProps {
  tripId: number;
}

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

interface CustomColumn {
  id: string;
  name: string;
  type: 'boolean' | 'text';
}

const customColumnSchema = z.object({
  name: z.string().min(1, "Column name is required"),
  type: z.enum(['boolean', 'text']),
});

export function TripParticipantDetails({ tripId }: TripParticipantDetailsProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isAddParticipantOpen, setIsAddParticipantOpen] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);
  const [updatingParticipants, setUpdatingParticipants] = useState<number[]>([]);
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>([]);
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [customValues, setCustomValues] = useState<Record<string, Record<number, string | boolean>>>({});

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
      const formattedData = {
        name: data.name,
        arrivalDate: data.arrivalDate || null,
        departureDate: data.departureDate || null,
        flightIn: data.flightIn || null,
        flightOut: data.flightOut || null,
        status: 'pending' as Status,
        flightStatus: 'pending',
        hotelStatus: 'pending',
        accommodation: data.accommodation
          ? {
              name: data.accommodation,
              type: 'hotel',
              address: 'TBD',
              checkInDate: data.arrivalDate || '',
              checkOutDate: data.departureDate || '',
              checkInTime: null,
              checkOutTime: null,
              bookingReference: 'TBD',
              bookingStatus: 'pending',
              price: null,
              currency: 'USD',
              roomType: null,
            }
          : null,
      };

      const res = await fetch(`/api/trips/${tripId}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formattedData),
        credentials: "include",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || error.error || "Failed to add participant");
      }

      return res.json();
    },
    onMutate: async (newParticipant) => {
      await queryClient.cancelQueries({ queryKey: [`/api/trips/${tripId}/participants`] });
      const previousParticipants = queryClient.getQueryData<Participant[]>([`/api/trips/${tripId}/participants`]);

      const optimisticParticipant: Participant = {
        id: -Date.now(),
        name: newParticipant.name,
        tripId,
        userId: null,
        status: 'pending',
        arrivalDate: newParticipant.arrivalDate || null,
        departureDate: newParticipant.departureDate || null,
        flightStatus: 'pending',
        hotelStatus: 'pending',
        flightIn: newParticipant.flightIn || null,
        flightOut: newParticipant.flightOut || null,
        accommodation: newParticipant.accommodation ? {
          id: -Date.now(),
          tripId,
          name: newParticipant.accommodation,
          type: 'hotel',
          address: 'TBD',
          checkInDate: newParticipant.arrivalDate || '',
          checkOutDate: newParticipant.departureDate || '',
          checkInTime: null,
          checkOutTime: null,
          bookingReference: 'TBD',
          bookingStatus: 'pending',
          price: null,
          currency: 'USD',
          roomType: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        } : null,
      };

      queryClient.setQueryData<Participant[]>(
        [`/api/trips/${tripId}/participants`],
        (old = []) => [...old, optimisticParticipant].sort(sortParticipants)
      );

      return { previousParticipants };
    },
    onError: (err, newParticipant, context) => {
      queryClient.setQueryData(
        [`/api/trips/${tripId}/participants`],
        context?.previousParticipants
      );

      if (err instanceof Error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: err.message,
        });
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData<Participant[]>(
        [`/api/trips/${tripId}/participants`],
        (old = []) => {
          const withoutOptimistic = old.filter(p => p.id > 0);
          return [...withoutOptimistic, data].sort(sortParticipants);
        }
      );
      addForm.reset();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/participants`] });
    }
  });

  const updateParticipantMutation = useMutation({
    mutationFn: async ({ participantId, data }: { participantId: number; data: Partial<ParticipantForm> }) => {
      const formattedData = {
        name: data.name,
        arrivalDate: data.arrivalDate || null,
        departureDate: data.departureDate || null,
        flightIn: data.flightIn || null,
        flightOut: data.flightOut || null,
        accommodation: data.accommodation?.trim()
          ? {
              name: data.accommodation,
              type: 'hotel',
              address: 'TBD',
              checkInDate: data.arrivalDate || '',
              checkOutDate: data.departureDate || '',
              checkInTime: null,
              checkOutTime: null,
              bookingReference: 'TBD',
              bookingStatus: 'pending',
              price: null,
              currency: 'USD',
              roomType: null,
            }
          : null,
      };

      const res = await fetch(`/api/trips/${tripId}/participants/${participantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formattedData),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update participant");
      }

      return res.json();
    },
    onMutate: async ({ participantId, data }) => {
      await queryClient.cancelQueries({ queryKey: [`/api/trips/${tripId}/participants`] });
      const previousParticipants = queryClient.getQueryData<Participant[]>([`/api/trips/${tripId}/participants`]);

      // Create optimistic update
      queryClient.setQueryData<Participant[]>(
        [`/api/trips/${tripId}/participants`],
        old => old?.map(p => (p.id === participantId
          ? {
              ...p,
              name: data.name || p.name,
              arrivalDate: data.arrivalDate || p.arrivalDate,
              departureDate: data.departureDate || p.departureDate,
              flightIn: data.flightIn || p.flightIn,
              flightOut: data.flightOut || p.flightOut,
              accommodation: data.accommodation?.trim()
                ? {
                    ...(p.accommodation || {}),
                    name: data.accommodation,
                    checkInDate: data.arrivalDate || p.arrivalDate || '',
                    checkOutDate: data.departureDate || p.departureDate || '',
                  }
                : null,
            }
          : p
        )) || []
      );

      return { previousParticipants };
    },
    onError: (err, { participantId }, context) => {
      queryClient.setQueryData(
        [`/api/trips/${tripId}/participants`],
        context?.previousParticipants
      );

      if (err instanceof Error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: err.message,
        });
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData<Participant[]>(
        [`/api/trips/${tripId}/participants`],
        old => old?.map(p => p.id === data.id ? data : p) || []
      );

      setEditingParticipant(null);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/participants`] });
    }

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

  const customColumnForm = useForm({
    defaultValues: {
      name: "",
      type: "text" as const,
    },
  });

  const handleAddCustomColumn = (data: { name: string; type: 'boolean' | 'text' }) => {
    const newColumn: CustomColumn = {
      id: `custom-${Date.now()}`,
      name: data.name,
      type: data.type,
    };
    setCustomColumns(prev => [...prev, newColumn]);
    customColumnForm.reset();
    setCustomValues(prev => ({
      ...prev,
      [newColumn.id]: {},
    }));
  };

  const handleRemoveCustomColumn = (columnId: string) => {
    setCustomColumns(prev => prev.filter(col => col.id !== columnId));
    setCustomValues(prev => {
      const { [columnId]: _, ...rest } = prev;
      return rest;
    });
  };

  const handleCustomValueChange = (participantId: number, columnId: string, value: string | boolean) => {
    setCustomValues(prev => ({
      ...prev,
      [columnId]: {
        ...prev[columnId],
        [participantId]: value,
      },
    }));
  };

  const handleSubmit = async (data: ParticipantForm) => {
    try {
      await addParticipantMutation.mutateAsync(data);
      setIsAddParticipantOpen(false);  // Explicitly close dialog after successful mutation
    } catch (error) {
      // Error will be handled by mutation's onError
      console.error('Failed to add participant:', error);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <CardTitle>People</CardTitle>
          <div className="flex gap-2">
            <Dialog 
              open={isAddParticipantOpen}
              onOpenChange={setIsAddParticipantOpen}
            >
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
                  <form onSubmit={addForm.handleSubmit(handleSubmit)} className="space-y-4">
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
                    <Button 
                      type="submit" 
                      className="w-full"
                      disabled={addParticipantMutation.isPending}
                    >
                      {addParticipantMutation.isPending ? "Adding..." : "Add Person"}
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
            <Dialog 
              open={isCustomizeOpen} 
              onOpenChange={setIsCustomizeOpen}
            >
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Settings2 className="h-4 w-4 mr-2" />
                  Customize Columns
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Customize Table Columns</DialogTitle>
                </DialogHeader>
                <Form {...customColumnForm}>
                  <form
                    onSubmit={customColumnForm.handleSubmit(handleAddCustomColumn)}
                    className="space-y-4"
                  >
                    <FormField
                      control={customColumnForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Column Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter column name" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={customColumnForm.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Column Type</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select column type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="text">Text Input</SelectItem>
                              <SelectItem value="boolean">Yes/No</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Choose how data will be entered in this column
                          </FormDescription>
                        </FormItem>
                      )}
                    />
                    <Button type="submit">Add Column</Button>
                  </form>
                </Form>
                {customColumns.length > 0 && (
                  <div className="mt-6 space-y-2">
                    <h4 className="text-sm font-medium">Custom Columns</h4>
                    <div className="space-y-2">
                      {customColumns.map((column) => (
                        <div
                          key={column.id}
                          className="flex items-center justify-between p-2 border rounded-md"
                        >
                          <div>
                            <span className="font-medium">{column.name}</span>
                            <span className="ml-2 text-sm text-muted-foreground">
                              ({column.type})
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveCustomColumn(column.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>
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
              {customColumns.map((column) => (
                <TableHead key={column.id}>{column.name}</TableHead>
              ))}
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
                  {customColumns.map((column) => (
                    <TableCell key={column.id}>
                      {column.type === 'boolean' ? (
                        <Select
                          value={String(customValues[column.id]?.[participant.id] ?? '')}
                          onValueChange={(value) => handleCustomValueChange(participant.id, column.id, value === 'true')}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="-" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="true">Yes</SelectItem>
                            <SelectItem value="false">No</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          value={String(customValues[column.id]?.[participant.id] ?? '')}
                          onChange={(e) => handleCustomValueChange(participant.id, column.id, e.target.value)}
                          className="h-8"
                        />
                      )}
                    </TableCell>
                  ))}
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
                <TableCell colSpan={8 + customColumns.length} className="text-center py-4 text-muted-foreground">
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