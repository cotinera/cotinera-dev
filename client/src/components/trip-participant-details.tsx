import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Trip, Flight } from "@db/schema";
import { format, parse } from "date-fns";
import { useForm } from "react-hook-form";
import { useFlights } from "@/hooks/use-flights";
import { useFlightLookup } from "@/hooks/use-flight-lookup";
import { z } from "zod";
import { FlightInDialog, FlightOutDialog } from "./trip-participant-details-updated";
import { Button } from "@/components/ui/button";
import { 
  Plus, 
  X, 
  Check, 
  X as XIcon, 
  Clock, 
  Edit2, 
  Settings2, 
  Search, 
  Loader2, 
  Eye,
  EyeOff,
  Plane 
} from "lucide-react";
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
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormDescription,
  FormMessage,
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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface TripParticipantDetailsProps {
  tripId: number;
}

interface Accommodation {
  name: string;
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

const STATUS_LABELS = {
  'pending': 'Pending',
  'yes': 'Confirmed',
  'no': 'Declined'
};

const sortParticipants = (a: Participant, b: Participant) => {
  const statusOrder = {
    yes: 0,
    pending: 1,
    no: 2
  };
  // First sort by status
  const statusDiff = statusOrder[a.status as Status] - statusOrder[b.status as Status];

  // If status is the same, sort alphabetically by name
  if (statusDiff === 0) {
    return (a.name || '').localeCompare(b.name || '');
  }
  return statusDiff;
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
  const { createFlight, updateFlight } = useFlights(tripId);
  const [isAddParticipantOpen, setIsAddParticipantOpen] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);
  const [updatingParticipants, setUpdatingParticipants] = useState<number[]>([]);
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>([]);
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [customValues, setCustomValues] = useState<Record<string, Record<number, string | boolean>>>({});
  const [hiddenDefaultColumns, setHiddenDefaultColumns] = useState<string[]>([]);
  
  // Define the list of default columns that can be hidden
  const defaultColumns = [
    { id: 'arrival', name: 'Arrival', type: 'text' as const },
    { id: 'departure', name: 'Departure', type: 'text' as const },
    { id: 'flightIn', name: 'Flight In', type: 'text' as const },
    { id: 'flightOut', name: 'Flight Out', type: 'text' as const },
    { id: 'accommodation', name: 'Accommodation', type: 'text' as const },
  ];
  
  // Fetch custom columns and values
  const { data: customColumnsData } = useQuery({
    queryKey: [`/api/trips/${tripId}/custom-columns`],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripId}/custom-columns`);
      if (!res.ok) {
        throw new Error("Failed to fetch custom columns");
      }
      return res.json();
    },
  });
  
  const { data: customValuesData } = useQuery({
    queryKey: [`/api/trips/${tripId}/custom-values`],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripId}/custom-values`);
      if (!res.ok) {
        throw new Error("Failed to fetch custom values");
      }
      return res.json();
    },
    enabled: !!customColumnsData?.length,
  });
  
  // Flight management states
  const [isAddFlightInOpen, setIsAddFlightInOpen] = useState(false);
  const [isAddFlightOutOpen, setIsAddFlightOutOpen] = useState(false);
  const [currentParticipantId, setCurrentParticipantId] = useState<number | null>(null);
  
  // Flight form
  const flightForm = useForm<Partial<Flight>>({
    defaultValues: {
      airline: "",
      flightNumber: "",
      departureAirport: "",
      arrivalAirport: "",
      departureDate: "",
      departureTime: "",
      arrivalDate: "",
      arrivalTime: "",
      bookingReference: "",
      bookingStatus: "confirmed",
    },
  });
  
  // Use our custom hook for flight lookup
  const { 
    isLookingUpFlight, 
    flightDetails, 
    setFlightDetails, 
    lookupFlightDetails 
  } = useFlightLookup(flightForm);

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
        accommodation: data.accommodation?.trim()
          ? { name: data.accommodation }
          : null,
      };

      const res = await fetch(`/api/trips/${tripId}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formattedData),
        credentials: "include",
      });

      const responseData = await res.json();

      if (!res.ok) {
        throw new Error(responseData.message || responseData.error || "Unable to add participant");
      }

      return responseData;
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
        accommodation: newParticipant.accommodation?.trim()
          ? { name: newParticipant.accommodation }
          : null
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

      // Only show error toast if there's an actual error message
      const errorMessage = err instanceof Error && err.message
        ? err.message
        : null;

      if (errorMessage) {
        toast({
          variant: "destructive",
          title: "Could not add participant",
          description: errorMessage
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
      // Dialog is already closed in the submit handler
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
          ? { name: data.accommodation }
          : null
      };

      const res = await fetch(`/api/trips/${tripId}/participants/${participantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formattedData),
        credentials: "include"
      });

      const responseData = await res.json();

      if (!res.ok) {
        throw new Error(responseData.message || responseData.error || "Failed to update participant");
      }

      // Normalize the accommodation data to ensure we only have the name
      let accommodationData = null;
      if (responseData.accommodation) {
        const accData = typeof responseData.accommodation === 'string'
          ? JSON.parse(responseData.accommodation)
          : responseData.accommodation;

        accommodationData = accData.name ? { name: accData.name } : null;
      }

      return {
        ...responseData,
        accommodation: accommodationData
      };
    },
    onMutate: async ({ participantId, data }) => {
      await queryClient.cancelQueries({ queryKey: [`/api/trips/${tripId}/participants`] });
      const previousParticipants = queryClient.getQueryData<Participant[]>([`/api/trips/${tripId}/participants`]);

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
                ? { name: data.accommodation }
                : null
            }
          : p
        )) || []
      );

      return { previousParticipants };
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(
        [`/api/trips/${tripId}/participants`],
        context?.previousParticipants
      );
      setEditingParticipant(null);
    },
    onSuccess: (data) => {
      queryClient.setQueryData<Participant[]>(
        [`/api/trips/${tripId}/participants`],
        old => old?.map(p => p.id === data.id ? data : p) || []
      );
      setEditingParticipant(null);
      editForm.reset();
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

  // Get the appropriate badge variant based on participant status
  const getStatusBadgeVariant = (status: Status) => {
    switch (status) {
      case 'yes':
        return 'default'; // Use 'default' instead of 'success' for compatibility with Badge variant type
      case 'no':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  // Get the appropriate icon for each status
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

  const getNextStatus = (currentStatus: Status): Status => {
    const currentIndex = STATUS_CYCLE.indexOf(currentStatus);
    return STATUS_CYCLE[(currentIndex + 1) % STATUS_CYCLE.length];
  };

  const handleStatusChange = (participantId: number, newStatus: Status) => {
    updateStatusMutation.mutate({ participantId, status: newStatus });
  };

  // Load hidden columns from localStorage
  useEffect(() => {
    const savedHiddenColumns = localStorage.getItem(`tripParticipants_${tripId}_hiddenColumns`);
    if (savedHiddenColumns) {
      try {
        const parsed = JSON.parse(savedHiddenColumns);
        setHiddenDefaultColumns(parsed);
      } catch (error) {
        console.error('Failed to parse hidden columns from localStorage', error);
      }
    }
  }, [tripId]);

  // Sync data from API to local state
  useEffect(() => {
    if (customColumnsData) {
      setCustomColumns(customColumnsData);
      
      // Initialize custom values structure
      const initialValuesByColumn: Record<string, Record<number, string | boolean>> = {};
      customColumnsData.forEach((column: CustomColumn) => {
        initialValuesByColumn[column.id] = {};
      });
      
      setCustomValues(initialValuesByColumn);
    }
  }, [customColumnsData]);
  
  // Sync custom values data
  useEffect(() => {
    if (customValuesData && customValuesData.length > 0) {
      const valuesByColumn: Record<string, Record<number, string | boolean>> = {};
      
      // First initialize empty structure
      customColumns.forEach((column: CustomColumn) => {
        valuesByColumn[column.id] = {};
      });
      
      // Then populate with values from API
      customValuesData.forEach((value: any) => {
        const { columnId, participantId, value: rawValue } = value;
        
        if (!valuesByColumn[columnId]) {
          valuesByColumn[columnId] = {};
        }
        
        // Convert value based on column type
        const column = customColumns.find(c => c.id === columnId);
        if (column && column.type === 'boolean') {
          valuesByColumn[columnId][participantId] = rawValue === 'true' || rawValue === true;
        } else {
          valuesByColumn[columnId][participantId] = rawValue;
        }
      });
      
      setCustomValues(valuesByColumn);
    }
  }, [customValuesData, customColumns]);

  const handleAddCustomColumn = (newColumn: z.infer<typeof customColumnSchema>) => {
    // Save to server first, which will return the column with a proper ID
    saveCustomColumnMutation.mutate({
      ...newColumn,
      id: `temp-${Date.now()}` // Temporary ID, will be replaced by server response
    });
    
    // Form reset is handled in the form submit handler
  };

  // Delete custom column mutation
  const deleteCustomColumnMutation = useMutation({
    mutationFn: async (columnId: string) => {
      const res = await fetch(`/api/trips/${tripId}/custom-columns/${columnId}`, {
        method: "DELETE",
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to delete custom column");
      }
      
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/custom-columns`] });
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/custom-values`] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete custom column",
      });
    },
  });

  const handleDeleteCustomColumn = (columnId: string) => {
    // Delete from server
    deleteCustomColumnMutation.mutate(columnId);
    
    // Update local state immediately for better UX
    setCustomColumns(prev => prev.filter(c => c.id !== columnId));
    
    // Remove values for this column
    setCustomValues(prev => {
      const newValues = { ...prev };
      delete newValues[columnId];
      return newValues;
    });
  };
  
  // Function to toggle visibility of default columns
  const toggleDefaultColumn = (columnId: string) => {
    setHiddenDefaultColumns(prevHidden => {
      if (prevHidden.includes(columnId)) {
        // Remove from hidden list (show column)
        return prevHidden.filter(id => id !== columnId);
      } else {
        // Add to hidden list (hide column)
        return [...prevHidden, columnId];
      }
    });
    
    // Save to localStorage for persistence
    localStorage.setItem(
      `tripParticipants_${tripId}_hiddenColumns`, 
      JSON.stringify(hiddenDefaultColumns.includes(columnId) 
        ? hiddenDefaultColumns.filter(id => id !== columnId)
        : [...hiddenDefaultColumns, columnId]
      )
    );
  };

  // Mutation for saving custom column values
  const saveCustomValueMutation = useMutation({
    mutationFn: async ({ columnId, participantId, value }: { columnId: string, participantId: number, value: string | boolean }) => {
      const res = await fetch(`/api/trips/${tripId}/custom-values`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columnId, participantId, value }),
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to save custom value");
      }
      
      return res.json();
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save custom value",
      });
    },
  });

  const handleCustomValueChange = (columnId: string, participantId: number, value: string | boolean) => {
    // Update local state immediately for better UX
    setCustomValues(prev => ({
      ...prev,
      [columnId]: {
        ...prev[columnId],
        [participantId]: value
      }
    }));
    
    // Save to server
    saveCustomValueMutation.mutate({ columnId, participantId, value });
  };
  
  // Save custom column to server
  const saveCustomColumnMutation = useMutation({
    mutationFn: async (column: CustomColumn) => {
      const res = await fetch(`/api/trips/${tripId}/custom-columns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: column.name, type: column.type }),
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to save custom column");
      }
      
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/custom-columns`] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save custom column",
      });
    },
  });

  // Submit flight information for inbound flight
  const handleFlightInSubmit = async () => {
    if (!currentParticipantId) {
      console.warn("Cannot add flight: No participant selected");
      return;
    }
    
    const values = flightForm.getValues();
    console.log("Flight form values:", values);
    
    const selectedParticipant = participants.find(p => p.id === currentParticipantId);
    
    if (!selectedParticipant) {
      console.warn("Cannot add flight: Selected participant not found", { currentParticipantId });
      return;
    }
    
    try {
      // Format the flight description
      const flightDescription = `${values.airline} ${values.flightNumber} (${values.departureAirport} → ${values.arrivalAirport})`;
      console.log("Adding inbound flight for participant:", selectedParticipant.name, "Flight:", flightDescription);
      
      // Update the participant with the new flight information
      await updateParticipantMutation.mutateAsync({
        participantId: currentParticipantId,
        data: { flightIn: flightDescription }
      });
      
      // Create actual flight record in database
      const flightData = {
        ...values,
        tripId,
        departureDate: values.departureDate || '',
        departureTime: values.departureTime || '',
        arrivalDate: values.arrivalDate || '',
        arrivalTime: values.arrivalTime || '',
        participantId: currentParticipantId,
        direction: 'inbound'
      };
      
      console.log("Creating flight record with data:", flightData);
      
      await createFlight(flightData);
      
      // Close dialog and reset form
      setIsAddFlightInOpen(false);
      
      toast({
        title: "Success",
        description: "Inbound flight information added successfully",
      });
    } catch (error) {
      console.error("Error adding inbound flight:", error);
      
      // More detailed error logging
      if (error instanceof Error) {
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
      } else {
        console.error("Non-error object thrown:", error);
      }
      
      toast({
        variant: "destructive",
        title: "Error adding flight",
        description: error instanceof Error ? error.message : "Failed to add inbound flight. Please try again.",
      });
    }
  };
  
  // Submit flight information for outbound flight
  const handleFlightOutSubmit = async () => {
    if (!currentParticipantId) {
      console.warn("Cannot add flight: No participant selected");
      return;
    }
    
    const values = flightForm.getValues();
    console.log("Flight form values (outbound):", values);
    
    const selectedParticipant = participants.find(p => p.id === currentParticipantId);
    
    if (!selectedParticipant) {
      console.warn("Cannot add flight: Selected participant not found", { currentParticipantId });
      return;
    }
    
    try {
      // Format the flight description
      const flightDescription = `${values.airline} ${values.flightNumber} (${values.departureAirport} → ${values.arrivalAirport})`;
      console.log("Adding outbound flight for participant:", selectedParticipant.name, "Flight:", flightDescription);
      
      // Update the participant with the new flight information
      await updateParticipantMutation.mutateAsync({
        participantId: currentParticipantId,
        data: { flightOut: flightDescription }
      });
      
      // Create actual flight record in database
      const flightData = {
        ...values,
        tripId,
        departureDate: values.departureDate || '',
        departureTime: values.departureTime || '',
        arrivalDate: values.arrivalDate || '',
        arrivalTime: values.arrivalTime || '',
        participantId: currentParticipantId,
        direction: 'outbound'
      };
      
      console.log("Creating flight record with data:", flightData);
      
      await createFlight(flightData);
      
      // Close dialog and reset form
      setIsAddFlightOutOpen(false);
      
      toast({
        title: "Success",
        description: "Outbound flight information added successfully",
      });
    } catch (error) {
      console.error("Error adding outbound flight:", error);
      
      // More detailed error logging
      if (error instanceof Error) {
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
      } else {
        console.error("Non-error object thrown:", error);
      }
      
      toast({
        variant: "destructive",
        title: "Error adding flight",
        description: error instanceof Error ? error.message : "Failed to add outbound flight. Please try again.",
      });
    }
  };

  const customColumnForm = useForm({
    defaultValues: {
      name: "",
      type: "text" as const,
    },
  });

  const handleSubmit = async (data: ParticipantForm) => {
    await addParticipantMutation.mutateAsync(data);
    setIsAddParticipantOpen(false);
  };

  const handleEditSubmit = async (data: ParticipantForm) => {
    if (!editingParticipant) return;
    await updateParticipantMutation.mutateAsync({
      participantId: editingParticipant.id,
      data
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xl font-bold">Participants</CardTitle>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1"
            onClick={() => setIsCustomizeOpen(true)}
          >
            <Settings2 className="h-4 w-4" />
            Customize
          </Button>
          <Button
            size="sm"
            className="h-8 gap-1"
            onClick={() => setIsAddParticipantOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Add Participant
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[150px]">Name</TableHead>
                <TableHead className="w-[100px] text-center">Status</TableHead>
                <TableHead className="w-[120px]">Arrival</TableHead>
                <TableHead className="w-[120px]">Departure</TableHead>
                <TableHead className="w-[180px]">
                  <div className="flex items-center">
                    <span>Flight In</span>
                  </div>
                </TableHead>
                <TableHead className="w-[180px]">
                  <div className="flex items-center">
                    <span>Flight Out</span>
                  </div>
                </TableHead>
                <TableHead className="w-[180px]">Accommodation</TableHead>
                {customColumns.map(column => (
                  <TableHead key={column.id} className="w-[120px]">
                    {column.name}
                  </TableHead>
                ))}
                <TableHead className="w-[80px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {participants.sort(sortParticipants).map((participant) => (
                <TableRow key={participant.id}>
                  <TableCell className="font-medium">
                    {participant.name}
                  </TableCell>
                  <TableCell className="text-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger>
                        <div className="inline-flex cursor-pointer">
                          <Badge 
                            variant={getStatusBadgeVariant(participant.status as Status)}
                            className="cursor-pointer"
                          >
                            {updatingParticipants.includes(participant.id) ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                              getStatusIcon(participant.status)
                            )}
                            {STATUS_LABELS[participant.status as Status]}
                          </Badge>
                        </div>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        {STATUS_CYCLE.map((status) => (
                          <DropdownMenuItem 
                            key={status}
                            onClick={() => handleStatusChange(participant.id, status)}
                          >
                            {getStatusIcon(status)}
                            <span className="ml-2">{STATUS_LABELS[status]}</span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                  <TableCell>
                    {participant.arrivalDate && format(new Date(participant.arrivalDate), "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell>
                    {participant.departureDate && format(new Date(participant.departureDate), "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <span>{participant.flightIn || ""}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => {
                          setCurrentParticipantId(participant.id);
                          
                          // Pre-populate the flight date with the participant's arrival date if available
                          const arrivalDate = participant.arrivalDate || format(new Date(), "yyyy-MM-dd");
                          
                          flightForm.reset({
                            flightNumber: "",
                            airline: "",
                            departureAirport: "",
                            arrivalAirport: "",
                            departureDate: arrivalDate,
                            departureTime: "",
                            arrivalDate: "",
                            arrivalTime: "",
                            bookingReference: "",
                            bookingStatus: "confirmed",
                          });
                          
                          setFlightDetails(null);
                          setIsAddFlightInOpen(true);
                        }}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <span>{participant.flightOut || ""}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => {
                          setCurrentParticipantId(participant.id);
                          
                          // Pre-populate the flight date with the participant's departure date if available
                          const departureDate = participant.departureDate || format(new Date(), "yyyy-MM-dd");
                          
                          flightForm.reset({
                            flightNumber: "",
                            airline: "",
                            departureAirport: "",
                            arrivalAirport: "",
                            departureDate: departureDate,
                            departureTime: "",
                            arrivalDate: "",
                            arrivalTime: "",
                            bookingReference: "",
                            bookingStatus: "confirmed",
                          });
                          
                          setFlightDetails(null);
                          setIsAddFlightOutOpen(true);
                        }}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    {participant.accommodation?.name || ""}
                  </TableCell>
                  {customColumns.map(column => (
                    <TableCell key={column.id}>
                      {column.type === 'boolean' ? (
                        <input
                          type="checkbox"
                          checked={!!customValues[column.id]?.[participant.id]}
                          onChange={(e) => handleCustomValueChange(
                            column.id,
                            participant.id,
                            e.target.checked
                          )}
                          className="h-4 w-4"
                        />
                      ) : (
                        <input
                          type="text"
                          value={customValues[column.id]?.[participant.id] as string || ""}
                          onChange={(e) => handleCustomValueChange(
                            column.id,
                            participant.id,
                            e.target.value
                          )}
                          className="w-full p-1 text-sm border rounded"
                        />
                      )}
                    </TableCell>
                  ))}
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <Settings2 className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingParticipant(participant);
                            editForm.reset({
                              name: participant.name || "",
                              arrivalDate: participant.arrivalDate || "",
                              departureDate: participant.departureDate || "",
                              flightIn: participant.flightIn || "",
                              flightOut: participant.flightOut || "",
                              accommodation: participant.accommodation?.name || "",
                            });
                          }}
                        >
                          <Edit2 className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:bg-destructive focus:text-destructive-foreground"
                          onClick={() => deleteParticipantMutation.mutate(participant.id)}
                        >
                          <X className="mr-2 h-4 w-4" />
                          Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* Add participant dialog */}
      <Dialog open={isAddParticipantOpen} onOpenChange={setIsAddParticipantOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Participant</DialogTitle>
            <DialogDescription>
              Enter participant details. Click save when you're done.
            </DialogDescription>
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
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={addForm.control}
                name="arrivalDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Arrival Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
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
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={addForm.control}
                name="flightIn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Flight In</FormLabel>
                    <FormControl>
                      <Input placeholder="Optional" {...field} />
                    </FormControl>
                    <FormDescription>
                      Or add flight details later after creating.
                    </FormDescription>
                    <FormMessage />
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
                      <Input placeholder="Optional" {...field} />
                    </FormControl>
                    <FormDescription>
                      Or add flight details later after creating.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={addForm.control}
                name="accommodation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Accommodation</FormLabel>
                    <FormControl>
                      <Input placeholder="Optional" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end">
                <Button type="submit">Save</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit participant dialog */}
      <Dialog open={!!editingParticipant} onOpenChange={(open) => !open && setEditingParticipant(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Participant</DialogTitle>
            <DialogDescription>
              Update the participant details.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="arrivalDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Arrival Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="departureDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Departure Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="flightIn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Flight In</FormLabel>
                    <FormControl>
                      <Input placeholder="Optional" {...field} />
                    </FormControl>
                    <FormMessage />
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
                      <Input placeholder="Optional" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="accommodation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Accommodation</FormLabel>
                    <FormControl>
                      <Input placeholder="Optional" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="mr-2"
                  onClick={() => setEditingParticipant(null)}
                >
                  Cancel
                </Button>
                <Button type="submit">Save</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Customize dialog */}
      <Dialog open={isCustomizeOpen} onOpenChange={setIsCustomizeOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Customize Participant Table</DialogTitle>
            <DialogDescription>
              Add custom columns to track additional participant information.
            </DialogDescription>
          </DialogHeader>
          <Form {...customColumnForm}>
            <form
              onSubmit={customColumnForm.handleSubmit((data) => {
                handleAddCustomColumn(data);
                customColumnForm.reset();
              })}
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
                    <FormMessage />
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
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select column type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="text">Text</SelectItem>
                        <SelectItem value="boolean">Checkbox</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit">Add Column</Button>
            </form>
          </Form>

          <div className="mt-4">
            <h4 className="text-sm font-medium mb-2">Original Columns</h4>
            <ul className="space-y-2">
              {defaultColumns.map(column => (
                <li key={column.id} className="flex items-center justify-between">
                  <span>
                    {column.name}
                  </span>
                  <Button
                    variant={hiddenDefaultColumns.includes(column.id) ? "destructive" : "ghost"}
                    size="sm"
                    onClick={() => toggleDefaultColumn(column.id)}
                  >
                    {hiddenDefaultColumns.includes(column.id) ? (
                      <Eye className="h-4 w-4" />
                    ) : (
                      <EyeOff className="h-4 w-4" />
                    )}
                  </Button>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4">
            <h4 className="text-sm font-medium mb-2">Current Custom Columns</h4>
            {customColumns.length === 0 ? (
              <p className="text-sm text-muted-foreground">No custom columns yet</p>
            ) : (
              <ul className="space-y-2">
                {customColumns.map(column => (
                  <li key={column.id} className="flex items-center justify-between">
                    <span>
                      {column.name} ({column.type})
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteCustomColumn(column.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Add Flight In Dialog */}
      <FlightInDialog
        isAddFlightInOpen={isAddFlightInOpen}
        setIsAddFlightInOpen={setIsAddFlightInOpen}
        flightForm={flightForm}
        flightDetails={flightDetails}
        setFlightDetails={setFlightDetails}
        isLookingUpFlight={isLookingUpFlight}
        lookupFlightDetails={lookupFlightDetails}
        handleFlightInSubmit={handleFlightInSubmit}
      />
      
      {/* Add Flight Out Dialog */}
      <FlightOutDialog
        isAddFlightOutOpen={isAddFlightOutOpen}
        setIsAddFlightOutOpen={setIsAddFlightOutOpen}
        flightForm={flightForm}
        flightDetails={flightDetails}
        setFlightDetails={setFlightDetails}
        isLookingUpFlight={isLookingUpFlight}
        lookupFlightDetails={lookupFlightDetails}
        handleFlightOutSubmit={handleFlightOutSubmit}
      />
    </Card>
  );
}