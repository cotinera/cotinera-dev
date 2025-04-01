import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ViewToggle } from "@/components/view-toggle";
import type { Trip } from "@db/schema";
import { TripHeaderEdit } from "@/components/trip-header-edit";
import { TripParticipantDetails } from "@/components/trip-participant-details";
import { TripDestinations } from "@/components/trip-destinations";
import { TripTimeline } from "@/components/trip-timeline";
import { MapRouteView } from "@/components/map-route-view";
import { MapView } from "@/components/map-view";
import { PinnedPlaces } from "@/components/pinned-places";
import { Checklist } from "@/components/checklist";
import { CalendarView } from "@/components/calendar-view";
import { MapView as MapViewComp } from "@/components/map-view";
import { ChatMessages } from "@/components/chat-messages";
import { BudgetTracker } from "@/components/budget-tracker";
import { Loader2, ArrowLeft, Trash2 } from "lucide-react";
import type { Destination } from "@db/schema";
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
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

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

  const { data: destinations } = useQuery<Destination[]>({
    queryKey: [`/api/trips/${tripId}/destinations`],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripId}/destinations`);
      if (!res.ok) throw new Error("Failed to fetch destinations");
      return res.json();
    },
    enabled: !!tripId,
  });

  const { data: pinnedPlaces } = useQuery<PinnedPlace[]>({
    queryKey: [`/api/trips/${tripId}/pinned-places`, currentDestinationId],
    queryFn: async () => {
      const url = new URL(`/api/trips/${tripId}/pinned-places`, window.location.origin);
      if (currentDestinationId) {
        url.searchParams.append('destinationId', currentDestinationId.toString());
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch pinned places");
      return res.json();
    },
    enabled: !!tripId,
  });

  const currentDestination = destinations?.find(d => d.id === currentDestinationId);

  const deleteTrip = useMutation({
    mutationFn: async () => {
      if (!tripId) throw new Error("No trip ID provided");

      const res = await fetch(`/api/trips/${tripId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: "Failed to delete trip" }));
        throw new Error(errorData.message || "Failed to delete trip");
      }

      return res.json().catch(() => ({}));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}`] });

      toast({
        title: "Success",
        description: "Trip deleted successfully",
      });
      setLocation("/");
    },
    onError: (error: Error) => {
      console.error("Delete trip error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete trip",
      });
    },
  });

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

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Error loading trip</h1>
          <p className="text-muted-foreground mb-4">{(error as Error).message}</p>
          <Button onClick={() => setLocation("/")}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Trip not found</h1>
          <Button onClick={() => setLocation("/")}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="relative overflow-hidden py-12">
          {trip.thumbnail && (
            <div 
              className="absolute inset-0 bg-cover bg-center"
              style={{ 
                backgroundImage: `url(${trip.thumbnail})`,
                filter: "blur(20px)",
                transform: "scale(1.2)",
                opacity: "0.9",
              }} 
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-background/30 to-background/70" />
          <div className="container mx-auto px-4 relative z-10">
            <div className="flex justify-between items-center absolute left-4 top-0">
              <Button
                variant="ghost"
                onClick={() => setLocation("/")}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Trip
              </Button>
            </div>

            <div className="absolute right-4 top-0 z-[1000]">
              <TripDestinations tripId={trip.id} />
            </div>

            <TripHeaderEdit 
              trip={trip} 
              onBack={() => setLocation("/")} 
            />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          <section>
            <TripTimeline 
              tripId={trip.id} 
              currentDestinationId={currentDestinationId}
              onDestinationChange={setCurrentDestinationId}
            />
          </section>

          <div className="grid gap-8 md:grid-cols-[2fr,1fr]">
            <div className="space-y-8">
              <section>
                <TripParticipantDetails 
                  tripId={trip.id}
                />
              </section>

              <section>
                {currentDestination ? (
                  <MapViewComp 
                    location={currentDestination.coordinates || { lat: 0, lng: 0 }}
                    tripId={trip.id.toString()}
                    pinnedPlaces={pinnedPlaces || []}
                    hideSearchAndFilters={true}
                  />
                ) : destinations && destinations.length >= 2 ? (
                  <MapRouteView destinations={destinations} />
                ) : (
                  <MapViewComp 
                    location={trip.coordinates || { lat: 0, lng: 0 }}
                    tripId={trip.id.toString()}
                    pinnedPlaces={pinnedPlaces || []}
                    hideSearchAndFilters={true}
                  />
                )}
              </section>

              <section>
                <PinnedPlaces
                  tripId={trip.id}
                  destinationId={currentDestinationId}
                  defaultLocation={currentDestination?.name || trip.location || ""}
                  showMap={true}
                  tripCoordinates={currentDestination?.coordinates || undefined}
                />
              </section>
            </div>

            <div className="space-y-8">
              <section>
                <ChatMessages 
                  tripId={trip.id}
                />
              </section>

              <section>
                <Checklist 
                  tripId={trip.id}
                />
              </section>
              
              <section className="mt-8">
                <BudgetTracker
                  tripId={trip.id}
                />
              </section>
            </div>
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