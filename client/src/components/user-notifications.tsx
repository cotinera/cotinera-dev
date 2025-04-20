import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Bell,
  Check,
  X,
  Info,
  AlertCircle,
  UserPlus,
} from "lucide-react";
import axios from "axios";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

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

export function UserNotifications() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  
  // Fetch notifications
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const response = await axios.get<Notification[]>("/api/notifications");
      return response.data;
    },
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchInterval: 1000 * 60 * 2, // 2 minutes
    refetchOnWindowFocus: true,
  });

  // Count unread notifications
  const unreadCount = notifications.filter(n => !n.isRead).length;
  
  // Mark notification as read
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      const response = await axios.patch(`/api/notifications/${notificationId}/read`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Failed to mark notification as read",
        variant: "destructive",
      });
    },
  });
  
  // Accept invitation
  const acceptInvitationMutation = useMutation({
    mutationFn: async (notificationId: number) => {
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
    mutationFn: async (notificationId: number) => {
      const response = await axios.post(`/api/notifications/${notificationId}/decline-invitation`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      
      toast({
        title: "Success",
        description: "Invitation declined",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Failed to decline invitation",
        variant: "destructive",
      });
    },
  });
  
  // Handle notification click based on type
  const handleNotificationClick = (notification: Notification) => {
    // Mark as read first
    markAsReadMutation.mutate(notification.id);
    
    // Then handle based on type
    if (notification.type === "invitation" && notification.tripId) {
      // For invitations, navigate to notification response page
      navigate(`/notifications/${notification.id}/respond`);
    } else if (notification.tripId) {
      // For other trip-related notifications, navigate to the trip
      navigate(`/trips/${notification.tripId}`);
    }
  };
  
  // Handle invitation actions directly from dropdown
  const handleAcceptInvitation = (notification: Notification) => {
    acceptInvitationMutation.mutate(notification.id);
  };
  
  const handleDeclineInvitation = (notification: Notification) => {
    declineInvitationMutation.mutate(notification.id);
  };
  
  // Format the notification date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.round(diffMs / 60000);
    const diffHours = Math.round(diffMs / 3600000);
    const diffDays = Math.round(diffMs / 86400000);
    
    if (diffMins < 60) {
      return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  };
  
  // Get notification icon based on type
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "invitation":
      case "invitation_reminder":
        return <UserPlus className="h-4 w-4 mr-2" />;
      case "alert":
        return <AlertCircle className="h-4 w-4 mr-2" />;
      default:
        return <Info className="h-4 w-4 mr-2" />;
    }
  };
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isLoading ? (
          <div className="px-2 py-4 text-center text-muted-foreground">Loading...</div>
        ) : notifications.length === 0 ? (
          <div className="px-2 py-4 text-center text-muted-foreground">No notifications</div>
        ) : (
          <div className="max-h-[300px] overflow-y-auto">
            {notifications.map((notification) => (
              <div key={notification.id} className="p-0">
                <DropdownMenuItem 
                  className={`px-4 py-2 flex flex-col items-start gap-1 border-b ${!notification.isRead ? 'bg-muted/50' : ''}`}
                >
                  <div className="flex justify-between w-full">
                    <div className="flex items-center font-medium">
                      {getNotificationIcon(notification.type)}
                      {notification.title}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(notification.createdAt)}
                    </div>
                  </div>
                  
                  <div className="text-sm pl-6">{notification.message}</div>
                  
                  {notification.type === 'invitation' && !notification.isRead && (
                    <div className="flex gap-2 pl-6 mt-2">
                      <Button 
                        size="sm" 
                        variant="default" 
                        className="h-7 text-xs px-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAcceptInvitation(notification);
                        }}
                      >
                        <Check className="h-3 w-3 mr-1" /> Accept
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-7 text-xs px-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeclineInvitation(notification);
                        }}
                      >
                        <X className="h-3 w-3 mr-1" /> Decline
                      </Button>
                    </div>
                  )}
                </DropdownMenuItem>
              </div>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}