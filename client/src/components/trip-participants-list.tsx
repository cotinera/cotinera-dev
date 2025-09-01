import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
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
import { InviteUserDialog } from "./invite-user-dialog";
import { PlusIcon, MoreHorizontal, UserPlusIcon } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface Participant {
  id: number;
  userId: number | null;
  tripId: number;
  name: string;
  status: string;
  role: string;
  joinedAt: string;
  user?: {
    id: number;
    email: string;
    name: string;
    avatar?: string;
  };
}

interface TripParticipantsListProps {
  tripId: number;
  isOwner: boolean;
}

export function TripParticipantsList({ tripId, isOwner }: TripParticipantsListProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [participantToRemove, setParticipantToRemove] = useState<Participant | null>(null);
  
  const { data: participants = [], isLoading } = useQuery({
    queryKey: [`/api/trips/${tripId}/participants`],
    queryFn: async () => {
      const response = await fetch(`/api/trips/${tripId}/participants`);
      if (!response.ok) {
        throw new Error("Failed to fetch participants");
      }
      return response.json();
    }
  });

  const removeMutation = useMutation({
    mutationFn: async (participantId: number) => {
      const response = await fetch(`/api/trips/${tripId}/participants/${participantId}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Failed to remove participant");
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Participant removed",
        description: "The participant has been removed from the trip",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/participants`] });
      setParticipantToRemove(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ participantId, role }: { participantId: number; role: string }) => {
      const response = await fetch(`/api/trips/${tripId}/participants/${participantId}/role`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role }),
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Failed to update participant role");
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Role updated",
        description: "The participant's role has been updated",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/participants`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resendInviteMutation = useMutation({
    mutationFn: async (participantId: number) => {
      const response = await fetch(`/api/trips/${tripId}/participants/${participantId}/resend-invite`, {
        method: "POST",
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Failed to resend invitation");
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Invitation resent",
        description: "The invitation has been resent to the participant",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleRemoveParticipant = () => {
    if (participantToRemove) {
      removeMutation.mutate(participantToRemove.id);
    }
  };

  const handleRoleChange = (participantId: number, role: string) => {
    updateRoleMutation.mutate({ participantId, role });
  };

  const handleResendInvite = (participantId: number) => {
    resendInviteMutation.mutate(participantId);
  };

  const getInitials = (name: string): string => {
    return name
      .split(" ")
      .map(part => part.charAt(0))
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-red-500";
      case "editor":
        return "bg-blue-500";
      case "viewer":
      default:
        return "bg-green-500";
    }
  };

  const getRoleDisplay = (role: string) => {
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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle>Trip Participants</CardTitle>
          <CardDescription>
            Manage who has access to this trip
          </CardDescription>
        </div>
        {isOwner && (
          <Button
            onClick={() => setInviteDialogOpen(true)}
            size="sm"
            className="ml-auto"
          >
            <UserPlusIcon className="mr-2 h-4 w-4" />
            Add Participants
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center p-4">Loading participants...</div>
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
          <div className="space-y-3">
            {participants.map((participant: Participant) => (
              <div 
                key={participant.id} 
                className="flex items-center justify-between p-2 rounded-md hover:bg-muted"
              >
                <div className="flex items-center">
                  <Avatar className="h-10 w-10 mr-3">
                    {participant.user?.avatar ? (
                      <AvatarImage src={participant.user.avatar} alt={participant.name} />
                    ) : null}
                    <AvatarFallback>{getInitials(participant.name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{participant.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {participant.user?.email || "Invited participant"}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center">
                  <Badge variant="secondary" className={`mr-2 ${getRoleBadgeColor(participant.role)}`}>
                    {getRoleDisplay(participant.role)}
                  </Badge>
                  
                  {participant.status === "pending" && (
                    <Badge variant="outline" className="mr-2">
                      Pending
                    </Badge>
                  )}

                  {isOwner && participant.userId !== user?.id && (
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
                </div>
              </div>
            ))}
            
            {isOwner && (
              <div className="pt-3 border-t">
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => setInviteDialogOpen(true)}
                >
                  <PlusIcon className="mr-2 h-4 w-4" />
                  Add More Participants
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>

      <InviteUserDialog 
        isOpen={inviteDialogOpen}
        onClose={() => setInviteDialogOpen(false)}
        tripId={tripId}
      />

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