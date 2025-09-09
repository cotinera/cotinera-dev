import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft, MapPin, Calendar, Users, Share2, Edit, Camera, Star, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import type { Trip, Destination } from "@db/schema";
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
import { TripHeaderEdit } from "@/components/trip-header-edit";
import { IntegratedTripParticipants } from "@/components/integrated-trip-participants";
import { TripTimeline } from "@/components/trip-timeline";
import { Checklist } from "@/components/checklist";
import { CalendarView } from "@/components/calendar-view";
import { MapView } from "@/components/map-view";
import { BudgetTracker } from "@/components/budget-tracker";
import { TripIdeasAndPlaces } from "@/components/trip-ideas-and-places";

interface PinnedPlace {
  id: number;
  name: string;
  coordinates: {
    lat: number;
    lng: number;
  };
}

export default function TripDetail() {
  const [, params] = useRoute("/trips/:id");
  const tripId = params ? parseInt(params.id) : null;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [currentDestinationId, setCurrentDestinationId] = useState<number | undefined>();
  const queryClient = useQueryClient();

  const { data: trip, isLoading, error } = useQuery<Trip>({
    queryKey: ["/api/trips", tripId],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripId}`);
      if (!res.ok) {
        throw new Error("Failed to fetch trip");
      }
      return res.json();
    },
    enabled: !!tripId,
  });

  const { data: destinations = [] } = useQuery<Destination[]>({
    queryKey: [`/api/trips/${tripId}/destinations`],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripId}/destinations`);
      if (!res.ok) throw new Error("Failed to fetch destinations");
      return res.json();
    },
    enabled: !!tripId,
  });

  const { data: participants = [] } = useQuery({
    queryKey: [`/api/trips/${tripId}/participants`],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripId}/participants`);
      if (!res.ok) throw new Error("Failed to fetch participants");
      return res.json();
    },
    enabled: !!tripId,
  });

  const deleteTrip = useMutation({
    mutationFn: async () => {
      if (!tripId) throw new Error("No trip ID provided");
      const res = await fetch(`/api/trips/${tripId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: "Failed to delete trip" }));
        throw new Error(errorData.message || "Failed to delete trip");
      }
      return res.json().catch(() => ({}));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      toast({
        title: "Success",
        description: "Trip deleted successfully",
      });
      setLocation("/");
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete trip",
      });
    },
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getDaysDifference = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({
      title: "Link copied!",
      description: "Trip link has been copied to clipboard.",
    });
  };

  const handleDelete = async () => {
    try {
      await deleteTrip.mutateAsync();
    } catch (error) {
      console.error("Error in handleDelete:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">
            {error ? "Error loading trip" : "Trip not found"}
          </h1>
          <p className="text-muted-foreground mb-4">
            {error ? (error as Error).message : "The trip you're looking for doesn't exist."}
          </p>
          <Button onClick={() => setLocation("/")}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => setLocation("/")}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Trips
              </Button>
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleShare}>
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
              <Button variant="outline" size="sm">
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative h-64 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-adventure opacity-90" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Camera className="w-16 h-16 text-white/50" />
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
          <div className="container mx-auto">
            <div className="flex items-end justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">{trip.title}</h1>
                <p className="text-white/90 mb-4">{trip.description || "An amazing adventure awaits!"}</p>
                
                <div className="flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    <span>{formatDate(trip.startDate)} - {formatDate(trip.endDate)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    <span>{destinations.length} destinations</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    <span>{participants.length + 1} travelers</span>
                  </div>
                </div>
              </div>
              
              <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                {getDaysDifference(trip.startDate, trip.endDate)} days
              </Badge>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="overview" className="space-y-6">
              <TabsList className="grid grid-cols-5 w-full">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="itinerary">Itinerary</TabsTrigger>
                <TabsTrigger value="places">Places</TabsTrigger>
                <TabsTrigger value="checklist">Checklist</TabsTrigger>
                <TabsTrigger value="calendar">Calendar</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                {/* Destinations */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="w-5 h-5" />
                      Destinations
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {destinations.length > 0 ? (
                      destinations.map((destination, index) => (
                        <div key={destination.id} className="flex items-start gap-4 p-4 rounded-lg border border-border/50 hover:shadow-soft transition-all">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-foreground">{destination.name}</h3>
                            <p className="text-sm text-muted-foreground mb-2">{destination.description || "Explore this amazing destination"}</p>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span>{formatDate(destination.startDate)} - {formatDate(destination.endDate)}</span>
                              <span>{getDaysDifference(destination.startDate, destination.endDate)} days</span>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground text-center py-4">No destinations added yet. Start planning your itinerary!</p>
                    )}
                  </CardContent>
                </Card>

                {/* Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button 
                    variant="outline" 
                    className="h-16 flex-col gap-2"
                    onClick={() => setLocation(`/trips/${trip.id}/map`)}
                  >
                    <MapPin className="w-5 h-5" />
                    View Map
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-16 flex-col gap-2"
                    onClick={() => setLocation(`/trips/${trip.id}/calendar`)}
                  >
                    <Calendar className="w-5 h-5" />
                    Calendar
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-16 flex-col gap-2"
                    onClick={() => setLocation(`/trips/${trip.id}/spending`)}
                  >
                    <Star className="w-5 h-5" />
                    Expenses
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="itinerary">
                <TripTimeline 
                  tripId={trip.id} 
                  currentDestinationId={currentDestinationId}
                  onDestinationChange={setCurrentDestinationId}
                />
              </TabsContent>

              <TabsContent value="places">
                <TripIdeasAndPlaces
                  tripId={trip.id}
                  participants={participants}
                  tripCoordinates={destinations[0]?.coordinates || trip.coordinates || undefined}
                />
              </TabsContent>

              <TabsContent value="checklist">
                <Checklist tripId={trip.id} />
              </TabsContent>

              <TabsContent value="calendar">
                <CalendarView tripId={trip.id} />
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Participants */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Travelers ({participants.length + 1})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Trip owner */}
                <div className="flex items-center gap-3">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={user?.avatar} />
                    <AvatarFallback>
                      {user?.name?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{user?.name || user?.email}</p>
                    <p className="text-xs text-muted-foreground">Owner</p>
                  </div>
                </div>
                
                {/* Other participants */}
                {participants.map((participant: any) => (
                  <div key={participant.id} className="flex items-center gap-3">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback>
                        {participant.name?.charAt(0) || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{participant.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{participant.status || "participant"}</p>
                    </div>
                  </div>
                ))}
                
                <IntegratedTripParticipants 
                  tripId={trip.id}
                  isOwner={user?.id === trip.ownerId}
                />
              </CardContent>
            </Card>

            {/* Budget Overview */}
            <Card>
              <CardHeader>
                <CardTitle>Budget Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <BudgetTracker tripId={trip.id} />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this trip?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the trip
              and all its associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}