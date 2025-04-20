import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import axios from "axios";
import { Check, X, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { AppHeader } from "@/components/app-header";
import { useAuth } from "@/hooks/use-auth";

interface Notification {
  id: number;
  userId: number;
  tripId: number;
  participantId: number | null;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

interface Trip {
  id: number;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  ownerId: number;
  owner?: {
    name: string;
    email: string;
  };
}

export function NotificationRespondPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [, params] = useRoute("/notifications/:notificationId/respond");
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const notificationId = params?.notificationId ? parseInt(params.notificationId) : 0;
  
  // Fetch notification details
  const { data: notification, isLoading: isLoadingNotification } = useQuery({
    queryKey: ["notifications", notificationId],
    queryFn: async () => {
      const response = await axios.get<Notification[]>("/api/notifications");
      const notificationData = response.data.find(n => n.id === notificationId);
      
      if (!notificationData) {
        throw new Error("Notification not found");
      }
      
      return notificationData;
    },
    enabled: !!notificationId && !!user,
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to load invitation details",
        variant: "destructive",
      });
      navigate("/");
    },
  });
  
  // Fetch trip details if notification is related to a trip
  const { data: trip, isLoading: isLoadingTrip } = useQuery({
    queryKey: ["trips", notification?.tripId],
    queryFn: async () => {
      const response = await axios.get<Trip>(`/api/trips/${notification?.tripId}`);
      return response.data;
    },
    enabled: !!notification?.tripId,
  });
  
  // Accept invitation
  const acceptInvitationMutation = useMutation({
    mutationFn: async () => {
      const response = await axios.post(`/api/notifications/${notificationId}/accept-invitation`);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      
      toast({
        title: "Success",
        description: "You've successfully joined the trip!",
      });
      
      // Navigate to the trip page
      if (data.participant && data.participant.tripId) {
        navigate(`/trips/${data.participant.tripId}`);
      } else {
        navigate("/my-trips");
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Failed to accept invitation",
        variant: "destructive",
      });
    },
  });
  
  // Decline invitation
  const declineInvitationMutation = useMutation({
    mutationFn: async () => {
      const response = await axios.post(`/api/notifications/${notificationId}/decline-invitation`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      
      toast({
        title: "Success",
        description: "Invitation declined",
      });
      
      navigate("/my-trips");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Failed to decline invitation",
        variant: "destructive",
      });
    },
  });
  
  const handleAccept = () => {
    acceptInvitationMutation.mutate();
  };
  
  const handleDecline = () => {
    declineInvitationMutation.mutate();
  };
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };
  
  const isLoading = isLoadingNotification || isLoadingTrip;
  const isPending = acceptInvitationMutation.isPending || declineInvitationMutation.isPending;
  
  // Check if the notification is of type invitation
  const isInvitation = notification?.type === "invitation" || notification?.type === "invitation_reminder";
  
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      
      <main className="container max-w-3xl py-10">
        <Button
          variant="ghost"
          onClick={() => navigate("/my-trips")}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to My Trips
        </Button>
        
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !notification || !isInvitation ? (
          <Card>
            <CardHeader>
              <CardTitle>Notification not found</CardTitle>
              <CardDescription>
                This notification doesn't exist or isn't an invitation.
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Button onClick={() => navigate("/my-trips")}>
                Go to My Trips
              </Button>
            </CardFooter>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>{notification.title}</CardTitle>
              <CardDescription>
                {notification.message}
              </CardDescription>
            </CardHeader>
            
            {trip && (
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium">Trip Details</h3>
                    <p className="text-lg font-semibold">{trip.title}</p>
                    {trip.description && (
                      <p className="text-muted-foreground mt-1">{trip.description}</p>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                    {trip.startDate && trip.endDate && (
                      <div>
                        <span className="font-medium">When: </span>
                        <span>
                          {formatDate(trip.startDate)} - {formatDate(trip.endDate)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            )}
            
            <CardFooter className="flex justify-end gap-2">
              <Button
                variant="outline" 
                onClick={handleDecline}
                disabled={isPending}
              >
                {declineInvitationMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <X className="h-4 w-4 mr-2" />
                )}
                Decline
              </Button>
              
              <Button
                onClick={handleAccept}
                disabled={isPending}
              >
                {acceptInvitationMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Accept
              </Button>
            </CardFooter>
          </Card>
        )}
      </main>
    </div>
  );
}