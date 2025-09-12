import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Trip } from "@db/schema";
import { useFlights } from "@/hooks/use-flights";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Plus,
  X,
  UserPlus,
  Settings2,
  Loader2,
  Eye,
  EyeOff,
  MoreHorizontal,
  PlusIcon,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { InviteUserDialog } from "./invite-user-dialog";
import { useAuth } from "@/hooks/use-auth";

interface IntegratedTripParticipantsProps {
  tripId: number;
  isOwner?: boolean;
}

interface Participant {
  id: number;
  tripId: number;
  userId?: number | null;
  name: string;
  role: string;
  status: string;
  email?: string;
  arrivalDate?: string;
  departureDate?: string;
  flightIn?: string;
  flightOut?: string;
  accommodation?: any;
  user?: {
    id: number;
    name: string;
    email: string;
    avatar?: string;
  };
}

interface CustomColumn {
  id: number;
  columnId: string;
  name: string;
  type: 'boolean' | 'text';
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

const customColumnSchema = z.object({
  name: z.string().min(1, "Column name is required"),
  type: z.enum(['boolean', 'text']),
});

export function IntegratedTripParticipants({ tripId, isOwner = false }: IntegratedTripParticipantsProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const { createFlight } = useFlights(tripId);
  
  // State for participant management
  const [updatingParticipants, setUpdatingParticipants] = useState<number[]>([]);
  
  // State for custom columns
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>([]);
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  
  // State for invite functionality
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [participantToRemove, setParticipantToRemove] = useState<Participant | null>(null);

  // Fetch participants
  const { data: participants = [], isLoading: isLoadingParticipants } = useQuery<Participant[]>({
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

  // Fetch custom columns
  const { data: fetchedCustomColumns = [], isLoading: isLoadingColumns } = useQuery<CustomColumn[]>({
    queryKey: [`/api/trips/${tripId}/custom-columns`],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripId}/custom-columns`);
      if (!res.ok) {
        throw new Error("Failed to fetch custom columns");
      }
      return res.json();
    },
  });

  // Fetch custom values
  const { data: customValues = {}, isLoading: isLoadingValues } = useQuery<Record<string, any>>({
    queryKey: [`/api/trips/${tripId}/custom-values`],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripId}/custom-values`);
      if (!res.ok) {
        throw new Error("Failed to fetch custom values");
      }
      return res.json();
    },
    // Add a refetch interval to ensure we get fresh data
    refetchInterval: 5000,
  });

  // Update state when fetched columns change
  useEffect(() => {
    if (fetchedCustomColumns?.length) {
      setCustomColumns(fetchedCustomColumns);
    }
  }, [fetchedCustomColumns]);

  // Mutations
  const createColumnMutation = useMutation({
    mutationFn: async (data: z.infer<typeof customColumnSchema>) => {
      console.log("Creating new custom column:", data);
      
      const res = await fetch(`/api/trips/${tripId}/custom-columns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create column");
      }

      return res.json();
    },
    onSuccess: (newColumn) => {
      console.log("New column created successfully:", newColumn);
      
      // Immediately invalidate columns query
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/custom-columns`] });
      
      // Also invalidate custom values to refresh the whole table
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/custom-values`] });
      
      // Clear any custom form values and close the dialog
      setIsCustomizeOpen(false);
      
      toast({
        title: "Custom column added",
        description: "The custom column has been added successfully.",
      });
    },
    onError: (error: Error) => {
      console.error("Failed to create column:", error);
      toast({
        title: "Failed to add custom column",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteColumnMutation = useMutation({
    mutationFn: async (columnId: string) => {
      console.log("Deleting custom column:", columnId);
      
      const res = await fetch(`/api/trips/${tripId}/custom-columns/${columnId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to delete column");
      }

      return res.json();
    },
    onSuccess: (_, columnId) => {
      console.log("Successfully deleted column:", columnId);
      
      // Immediately update the local state to remove the deleted column
      setCustomColumns(prev => prev.filter(column => column.columnId !== columnId));
      
      // Update the UI to remove any hidden column references
      setHiddenColumns(prev => prev.filter(id => id !== columnId));
      
      // Clean up any cached values related to this column
      const customValuesCache = queryClient.getQueryData<Record<string, any>>([`/api/trips/${tripId}/custom-values`]);
      if (customValuesCache) {
        const updatedValues = { ...customValuesCache };
        // Remove all entries for this column
        Object.keys(updatedValues).forEach(key => {
          if (key.includes(`-${columnId}`)) {
            delete updatedValues[key];
          }
        });
        queryClient.setQueryData([`/api/trips/${tripId}/custom-values`], updatedValues);
      }
      
      // Refresh data from the server
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/custom-columns`] });
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/custom-values`] });
      
      // Close the customize dialog
      setIsCustomizeOpen(false);
      
      toast({
        title: "Custom column deleted",
        description: "The custom column has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      console.error("Failed to delete column:", error);
      toast({
        title: "Failed to delete custom column",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const saveCustomValueMutation = useMutation({
    mutationFn: async ({
      participantId,
      columnId,
      value,
    }: {
      participantId: number;
      columnId: string;
      value: any;
    }) => {
      console.log(`Sending API request to save value:`, { participantId, columnId, value });
      
      try {
        const res = await fetch(`/api/trips/${tripId}/custom-values`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ participantId, columnId, value }),
        });

        const responseData = await res.json();
        console.log(`API response for saving value:`, responseData);
        
        if (!res.ok) {
          throw new Error(responseData.error || "Failed to save value");
        }

        return responseData;
      } catch (err) {
        console.error("Error saving custom value:", err);
        throw err;
      }
    },
    onSuccess: (data) => {
      console.log("Custom value saved successfully:", data);
      // Force refresh values
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/custom-values`] });
    },
    onError: (error: Error) => {
      console.error("Mutation error saving value:", error);
      toast({
        title: "Failed to save value",
        description: error.message,
        variant: "destructive",
      });
      // Force refresh to ensure we're in sync with the server
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/custom-values`] });
    },
  });

  const updateParticipantMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status?: string }) => {
      console.log(`Updating participant ${id} status to ${status}`);
      
      // Use the dedicated status update endpoint instead of the general update endpoint
      const res = await fetch(`/api/trips/${tripId}/participants/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: 'include', // Include cookies with the request
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error('Update participant status error:', errorText);
        let errorMessage;
        try {
          // Try to parse as JSON
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || "Failed to update participant status";
        } catch {
          // If it's not valid JSON, use the raw text
          errorMessage = errorText || "Failed to update participant status";
        }
        throw new Error(errorMessage);
      }

      return res.json();
    },
    // We're handling onSuccess, onError and other callbacks in the updateParticipantStatus function
    // to properly manage optimistic updates
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: number; role: string }) => {
      // Check if development bypass is enabled
      const isDevelopmentBypass = localStorage.getItem("dev_bypass_auth") === "true";
      
      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      
      // Add development bypass header if in dev mode
      if (isDevelopmentBypass) {
        headers['x-dev-bypass'] = 'true';
      }
      
      const res = await fetch(`/api/trips/${tripId}/participants/${id}/role`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ role }),
      });

      if (!res.ok) {
        throw new Error("Failed to update participant role");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/participants`] });
      toast({
        title: "Role updated",
        description: "Participant role has been updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update role",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resendInviteMutation = useMutation({
    mutationFn: async (participantId: number) => {
      // Check if development bypass is enabled
      const isDevelopmentBypass = localStorage.getItem("dev_bypass_auth") === "true";
      
      const headers: HeadersInit = {};
      
      // Add development bypass header if in dev mode
      if (isDevelopmentBypass) {
        headers['x-dev-bypass'] = 'true';
      }
      
      const res = await fetch(`/api/trips/${tripId}/participants/${participantId}/resend-invite`, {
        method: "POST",
        headers,
      });

      if (!res.ok) {
        throw new Error("Failed to resend invitation");
      }

      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Invitation resent",
        description: "The invitation has been sent again.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to resend invitation",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const removeParticipantMutation = useMutation({
    mutationFn: async (participantId: number) => {
      // Check if development bypass is enabled
      const isDevelopmentBypass = localStorage.getItem("dev_bypass_auth") === "true";
      
      const headers: HeadersInit = {};
      
      // Add development bypass header if in dev mode
      if (isDevelopmentBypass) {
        headers['x-dev-bypass'] = 'true';
      }
      
      const res = await fetch(`/api/trips/${tripId}/participants/${participantId}`, {
        method: "DELETE",
        headers,
      });

      if (!res.ok) {
        throw new Error("Failed to remove participant");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/participants`] });
      setParticipantToRemove(null);
      toast({
        title: "Participant removed",
        description: "The participant has been removed from the trip.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to remove participant",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Event handlers
  const onToggleColumnVisibility = (columnId: string) => {
    setHiddenColumns(prev => {
      if (prev.includes(columnId)) {
        return prev.filter(id => id !== columnId);
      } else {
        return [...prev, columnId];
      }
    });
  };

  // Define the type for our mutation context
  type MutationContext = {
    previousParticipants: Participant[] | undefined;
  };

  const updateParticipantStatus = (participantId: number, status: Status) => {
    console.log(`updateParticipantStatus called for participant ${participantId} with status ${status}`);
    setUpdatingParticipants(prev => [...prev, participantId]);
    
    // Update the status directly in the UI first for immediate feedback
    const previousParticipants = queryClient.getQueryData<Participant[]>([`/api/trips/${tripId}/participants`]);
    
    if (previousParticipants) {
      // Create a copy for the optimistic update
      const updatedParticipants = previousParticipants.map(p => 
        p.id === participantId ? { ...p, status } : p
      );
      
      console.log('Applying optimistic update for status change', { 
        participantId, 
        status, 
        updatedCount: updatedParticipants.length 
      });
      
      // Set the updated data in the cache
      queryClient.setQueryData([`/api/trips/${tripId}/participants`], updatedParticipants);
    }
    
    // Then make the API call
    updateParticipantMutation.mutate(
      { id: participantId, status },
      {
        onError: (error) => {
          console.error('Status update error:', error);
          
          // If there was an error, revert back to previous data
          if (previousParticipants) {
            queryClient.setQueryData(
              [`/api/trips/${tripId}/participants`], 
              previousParticipants
            );
          }
          
          toast({
            title: "Status update failed",
            description: error.message || "Failed to update participant status",
            variant: "destructive"
          });
        },
        onSettled: () => {
          // Always clear the updating state
          setUpdatingParticipants(prev => prev.filter(id => id !== participantId));
        },
        onSuccess: (data) => {
          console.log('Status update success:', data);
          // Update the cache directly with the server response
          queryClient.setQueryData<Participant[]>(
            [`/api/trips/${tripId}/participants`],
            (old) => {
              if (!old) return old;
              return old.map(p => p.id === participantId ? { ...p, status: data.status } : p);
            }
          );
          
          toast({
            title: "Status updated",
            description: `Participant status changed to ${STATUS_LABELS[status as Status]}`,
          });
        }
      }
    );
  };
  
  // This function is kept for backward compatibility but can be removed later
  const handleStatusChange = (participant: Participant) => {
    const currentIndex = STATUS_CYCLE.indexOf(participant.status as Status);
    const nextIndex = (currentIndex + 1) % STATUS_CYCLE.length;
    const nextStatus = STATUS_CYCLE[nextIndex];
    
    updateParticipantStatus(participant.id, nextStatus);
  };

  const handleRoleChange = (participantId: number, newRole: string) => {
    updateRoleMutation.mutate({ id: participantId, role: newRole });
  };

  const handleResendInvite = (participantId: number) => {
    resendInviteMutation.mutate(participantId);
  };

  const handleRemoveParticipant = () => {
    if (participantToRemove) {
      removeParticipantMutation.mutate(participantToRemove.id);
    }
  };

  // Helper functions
  const handleColumnCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const data = {
      name: formData.get("name") as string,
      type: formData.get("type") as "text" | "boolean",
    };
    
    const result = customColumnSchema.safeParse(data);
    if (result.success) {
      createColumnMutation.mutate(result.data);
      form.reset();
    } else {
      toast({
        title: "Validation error",
        description: "Please check the form fields and try again.",
        variant: "destructive",
      });
    }
  };

  const getValue = (participantId: number, columnId: string) => {
    return customValues?.[`${participantId}-${columnId}`] || "";
  };

  const handleCustomValueChange = (
    participantId: number,
    columnId: string,
    value: any
  ) => {
    // Get the current value
    const key = `${participantId}-${columnId}`;
    const currentValue = customValues?.[key] || "";
    
    // Only update if the value actually changed
    if (value !== currentValue) {
      console.log(`Updating value for ${key} from "${currentValue}" to "${value}"`);
      
      // First update the local state for immediate feedback
      const updatedValues = { ...customValues, [key]: value };
      
      // Update the cache optimistically
      queryClient.setQueryData([`/api/trips/${tripId}/custom-values`], updatedValues);
      
      // Then send to the server with retry
      saveCustomValueMutation.mutate(
        { participantId, columnId, value },
        { 
          onSuccess: () => {
            // Force another refresh to ensure latest data
            queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/custom-values`] });
            
            console.log(`Successfully saved value for ${key}`);
          },
          onError: (error) => {
            console.error(`Failed to save value for ${key}:`, error);
            
            // Revert optimistic update if failed
            queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/custom-values`] });
            
            toast({
              title: "Failed to save value",
              description: "There was a problem saving your data. Please try again.",
              variant: "destructive",
            });
          }
        }
      );
    }
  };

  const getInitials = (name: string): string => {
    if (!name) return "";
    return name
      .split(" ")
      .map(part => part.charAt(0))
      .join("")
      .toUpperCase();
  };

  const getRoleBadgeColor = (role: string): string => {
    switch (role) {
      case "admin":
        return "bg-purple-100 text-purple-700";
      case "editor":
        return "bg-blue-100 text-blue-700";
      case "viewer":
        return "bg-gray-100 text-gray-700";
      default:
        return "";
    }
  };

  const getRoleDisplay = (role: string): string => {
    switch (role) {
      case "admin":
        return "Admin";
      case "editor":
        return "Editor";
      case "viewer":
        return "Viewer";
      default:
        return "Participant";
    }
  };

  // Define standard columns that might be hidden
  const standardColumns = [
    { id: "status", name: "Status" },
    { id: "arrivalDate", name: "Arrival" },
    { id: "departureDate", name: "Departure" },
    { id: "flightIn", name: "Flight In" },
    { id: "flightOut", name: "Flight Out" },
    { id: "accommodation", name: "Accommodation" },
  ];

  // Render
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <div>
          <CardTitle>Trip Participants</CardTitle>
          <CardDescription>
            Manage trip participants and their details
          </CardDescription>
        </div>
        <div className="flex space-x-2">
          {isOwner && (
            <Button
              onClick={() => setInviteDialogOpen(true)}
              size="sm"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Invite
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsCustomizeOpen(true)}
          >
            <Settings2 className="mr-2 h-4 w-4" />
            Customize
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {isLoadingParticipants || isLoadingColumns || isLoadingValues ? (
          <div className="text-center p-4">Loading participant details...</div>
        ) : participants.length === 0 ? (
          <div className="text-center p-4 text-muted-foreground">
            <p>No participants yet</p>
            {isOwner && (
              <Button 
                variant="outline" 
                className="mt-2"
                onClick={() => setInviteDialogOpen(true)}
              >
                <PlusIcon className="mr-2 h-4 w-4" />
                Add Participants
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  {!hiddenColumns.includes("status") && (<TableHead>Status</TableHead>)}
                  {!hiddenColumns.includes("arrivalDate") && (<TableHead>Arrival</TableHead>)}
                  {!hiddenColumns.includes("departureDate") && (<TableHead>Departure</TableHead>)}
                  {!hiddenColumns.includes("flightIn") && (<TableHead>Flight In</TableHead>)}
                  {!hiddenColumns.includes("flightOut") && (<TableHead>Flight Out</TableHead>)}
                  {!hiddenColumns.includes("accommodation") && (<TableHead>Accommodation</TableHead>)}
                  {customColumns
                    .filter(column => !hiddenColumns.includes(column.columnId))
                    .map((column) => (
                      <TableHead key={column.id}>{column.name}</TableHead>
                  ))}
                  {isOwner && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...participants].sort(sortParticipants).map((participant) => (
                  <TableRow key={participant.id}>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Avatar className="h-8 w-8">
                          {participant.user?.avatar ? (
                            <AvatarImage src={participant.user.avatar} alt={participant.name} />
                          ) : null}
                          <AvatarFallback>{getInitials(participant.name)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{participant.name}</div>
                          <Badge variant="secondary" className={`text-xs ${getRoleBadgeColor(participant.role)}`}>
                            {getRoleDisplay(participant.role)}
                          </Badge>
                          {participant.user?.email && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {participant.user.email}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    
                    {!hiddenColumns.includes("status") && (
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              className={`h-8 px-3 ${participant.status === 'yes' ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' : 
                                             participant.status === 'no' ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' : 
                                                                      'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100'}`}
                              disabled={updatingParticipants.includes(participant.id)}
                            >
                              {updatingParticipants.includes(participant.id) ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                STATUS_LABELS[participant.status as Status] || "Set status"
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuItem 
                              className="text-yellow-700"
                              onClick={() => updateParticipantStatus(participant.id, "pending")}
                            >
                              Pending
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-green-700"
                              onClick={() => updateParticipantStatus(participant.id, "yes")}
                            >
                              Confirmed
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-red-700"
                              onClick={() => updateParticipantStatus(participant.id, "no")}
                            >
                              Declined
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                    
                    {!hiddenColumns.includes("arrivalDate") && (
                      <TableCell>
                        {participant.arrivalDate || "-"}
                      </TableCell>
                    )}
                    
                    {!hiddenColumns.includes("departureDate") && (
                      <TableCell>
                        {participant.departureDate || "-"}
                      </TableCell>
                    )}
                    
                    {!hiddenColumns.includes("flightIn") && (
                      <TableCell>
                        {participant.flightIn || "-"}
                      </TableCell>
                    )}
                    
                    {!hiddenColumns.includes("flightOut") && (
                      <TableCell>
                        {participant.flightOut || "-"}
                      </TableCell>
                    )}
                    
                    {!hiddenColumns.includes("accommodation") && (
                      <TableCell>
                        {typeof participant.accommodation === 'object' && participant.accommodation !== null
                          ? participant.accommodation.name || "-"
                          : participant.accommodation || "-"}
                      </TableCell>
                    )}
                    
                    {customColumns
                      .filter(column => !hiddenColumns.includes(column.columnId))
                      .map((column) => (
                        <TableCell key={column.id}>
                          {column.type === "boolean" ? (
                            <Checkbox
                              checked={getValue(participant.id, column.columnId) === true}
                              onCheckedChange={(checked) =>
                                handleCustomValueChange(
                                  participant.id,
                                  column.columnId,
                                  checked
                                )
                              }
                            />
                          ) : (
                            <Input
                              value={getValue(participant.id, column.columnId) || ""}
                              onChange={(e) =>
                                handleCustomValueChange(
                                  participant.id,
                                  column.columnId,
                                  e.target.value
                                )
                              }
                              onBlur={(e) =>
                                handleCustomValueChange(
                                  participant.id,
                                  column.columnId,
                                  e.target.value
                                )
                              }
                              className="h-8"
                            />
                          )}
                        </TableCell>
                      )
                    )}

                    {isOwner && (
                      <TableCell>
                        {participant.userId !== user?.id && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleRoleChange(participant.id, "viewer")}>
                                Make Viewer
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleRoleChange(participant.id, "editor")}>
                                Make Editor
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleRoleChange(participant.id, "admin")}>
                                Make Admin
                              </DropdownMenuItem>
                              
                              {participant.status === "pending" && (
                                <DropdownMenuItem onClick={() => handleResendInvite(participant.id)}>
                                  Resend Invitation
                                </DropdownMenuItem>
                              )}
                              
                              <DropdownMenuItem 
                                className="text-red-500"
                                onClick={() => setParticipantToRemove(participant)}
                              >
                                Remove
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Dialogs */}
      <Dialog open={isCustomizeOpen} onOpenChange={setIsCustomizeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Customize Columns</DialogTitle>
            <DialogDescription>
              Choose which columns to display or hide and add custom data fields
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium mb-2">Original Columns</h3>
              <div className="space-y-2">
                {standardColumns.map((column) => (
                  <div key={column.id} className="flex items-center justify-between">
                    <span>{column.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onToggleColumnVisibility(column.id)}
                    >
                      {hiddenColumns.includes(column.id) ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            
            <Separator />
            
            <div>
              <h3 className="text-sm font-medium mb-2">Custom Columns</h3>
              <div className="space-y-2">
                {customColumns.length === 0 && (
                  <p className="text-sm text-muted-foreground">No custom columns yet</p>
                )}
                
                {customColumns.map((column) => (
                  <div key={column.id} className="flex items-center justify-between">
                    <div>
                      <span>{column.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {column.type === "boolean" ? "Checkbox" : "Text"}
                      </span>
                    </div>
                    <div className="flex">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onToggleColumnVisibility(column.columnId)}
                      >
                        {hiddenColumns.includes(column.columnId) ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteColumnMutation.mutate(column.columnId)}
                      >
                        <X className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              
              <form onSubmit={handleColumnCreate} className="mt-4">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      name="name"
                      placeholder="Column name"
                      required
                    />
                  </div>
                  <div className="w-32">
                    <Label htmlFor="type">Type</Label>
                    <Select name="type" defaultValue="text">
                      <SelectTrigger id="type">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">Text</SelectItem>
                        <SelectItem value="boolean">Checkbox</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            </div>
          </div>
          
          <DialogFooter className="sm:justify-start">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsCustomizeOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite dialog */}
      <InviteUserDialog 
        isOpen={inviteDialogOpen}
        onClose={() => setInviteDialogOpen(false)}
        tripId={tripId}
      />

      {/* Remove confirmation dialog */}
      <AlertDialog 
        open={!!participantToRemove} 
        onOpenChange={(open) => !open && setParticipantToRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Participant</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {participantToRemove?.name} from this trip?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRemoveParticipant}
              className="bg-red-500 hover:bg-red-600"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}