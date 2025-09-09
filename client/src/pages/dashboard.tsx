import { useState, useMemo } from "react";
import { MapPin, Calendar, TrendingUp, Users, Plus, LogOut, Trash2, Settings, UserCircle } from "lucide-react";
import { useTrips } from "@/hooks/use-trips";
import { useUser } from "@/hooks/use-user";
import { useTutorial } from "@/hooks/use-tutorial";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import TripCard from "@/components/TripCard";
import CreateTripDialog from "@/components/CreateTripDialog";
import { TravelGuide } from "@/components/travel-guide";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { TravelPreferencesForm } from "@/components/travel-preferences-form";

export default function Dashboard() {
  const { trips } = useTrips();
  const { logout } = useUser();
  const { isFirstTime, completeTutorial } = useTutorial();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [selectedTrips, setSelectedTrips] = useState<number[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [tripToDelete, setTripToDelete] = useState<number | null>(null);
  const queryClient = useQueryClient();

  // Sort trips by creation date and then alphabetically by title
  const sortedTrips = useMemo(() => {
    return [...trips].sort((a, b) => {
      const idDiff = b.id - a.id; // Newest first
      if (idDiff !== 0) return idDiff;
      return a.title.localeCompare(b.title);
    });
  }, [trips]);

  // Calculate stats
  const upcomingTrips = trips.filter(trip => {
    const startDate = new Date(trip.startDate);
    return startDate > new Date();
  });
  
  const totalDestinations = new Set(trips.map(trip => trip.location).filter(Boolean)).size;
  const totalTravelers = trips.reduce((sum, trip) => {
    // Estimate travelers based on participants or default to 1
    return sum + 1; // Simplified for now
  }, 0);

  const deleteTrips = useMutation({
    mutationFn: async (tripIds: number[]) => {
      const results = await Promise.all(
        tripIds.map(async (id) => {
          try {
            const res = await fetch(`/api/trips/${id}`, {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              credentials: 'include'
            });

            if (!res.ok) {
              let errorMessage = `Failed to delete trip ${id}`;
              try {
                const errorData = await res.json();
                errorMessage = errorData.message || errorData.error || errorMessage;
              } catch {
                const errorText = await res.text();
                errorMessage = errorText || errorMessage;
              }
              throw new Error(errorMessage);
            }

            return id;
          } catch (error) {
            throw error instanceof Error ? error : new Error(`Failed to delete trip ${id}`);
          }
        })
      );
      return results;
    },
    onSuccess: (deletedTripIds) => {
      const isDevelopmentBypass = localStorage.getItem("dev_bypass_auth") === "true";
      const tripsQueryKey = isDevelopmentBypass ? ["/api/trips"] : ["/api/my-trips"];
      
      queryClient.invalidateQueries({ queryKey: tripsQueryKey });

      toast({
        title: "Success",
        description: deletedTripIds.length > 1
          ? "Selected trips deleted successfully"
          : "Trip deleted successfully",
      });

      setSelectedTrips([]);
      setTripToDelete(null);
      setShowDeleteDialog(false);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete trips",
      });
      setShowDeleteDialog(false);
    },
  });

  const handleDeleteConfirm = () => {
    if (tripToDelete) {
      deleteTrips.mutate([tripToDelete]);
    } else if (selectedTrips.length > 0) {
      deleteTrips.mutate(selectedTrips);
    }
  };

  const toggleTripSelection = (tripId: number) => {
    setSelectedTrips(prev =>
      prev.includes(tripId)
        ? prev.filter(id => id !== tripId)
        : [...prev, tripId]
    );
  };

  const handleSingleDelete = (tripId: number) => {
    setTripToDelete(tripId);
    setShowDeleteDialog(true);
  };

  const handleTripCreated = (newTrip: any) => {
    const isDevelopmentBypass = localStorage.getItem("dev_bypass_auth") === "true";
    const tripsQueryKey = isDevelopmentBypass ? ["/api/trips"] : ["/api/my-trips"];
    queryClient.invalidateQueries({ queryKey: tripsQueryKey });
  };

  return (
    <div className="min-h-screen bg-background">
      <TravelGuide 
        onComplete={completeTutorial}
        isFirstTime={isFirstTime}
      />
      
      {/* Hero Section */}
      <section className="relative h-96 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-adventure opacity-90" />
        <div className="absolute inset-0 flex items-center justify-center">
          <MapPin className="w-24 h-24 text-white/30" />
        </div>
        <div className="relative z-10 flex items-center justify-center h-full">
          <div className="text-center text-white px-6">
            <h1 className="text-5xl font-bold mb-4 drop-shadow-lg">
              Your Next Adventure Awaits
            </h1>
            <p className="text-xl mb-8 max-w-2xl mx-auto drop-shadow-md">
              Plan, organize, and coordinate unforgettable trips with our intuitive travel planning platform.
            </p>
            <CreateTripDialog onTripCreated={handleTripCreated} />
          </div>
        </div>

        {/* Header Controls */}
        <div className="absolute top-0 right-0 p-6 flex items-center gap-3 z-20">
          <Dialog open={isPreferencesOpen} onOpenChange={setIsPreferencesOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" title="Travel Preferences" className="text-white hover:bg-white/20">
                <Settings className="h-5 w-5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Travel Preferences</DialogTitle>
              </DialogHeader>
              <TravelPreferencesForm onClose={() => setIsPreferencesOpen(false)} />
            </DialogContent>
          </Dialog>
          
          {user ? (
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.avatar || ""} alt={user.name || user.email} />
                  <AvatarFallback className="bg-white/20 text-white">
                    {user.name ? user.name.charAt(0).toUpperCase() : "U"}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium text-white">{user.name || user.email}</span>
              </div>
              <Button variant="ghost" size="icon" title="Logout" onClick={() => logout()} className="text-white hover:bg-white/20">
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          ) : (
            <Link href="/auth">
              <Button variant="adventure">Login</Button>
            </Link>
          )}
        </div>
      </section>

      {/* Dashboard Content */}
      <main className="container mx-auto px-6 py-12">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Card className="bg-card border-border/50 shadow-soft hover:shadow-card transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Trips</CardTitle>
              <Calendar className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{trips.length}</div>
              <p className="text-xs text-muted-foreground">
                {upcomingTrips.length} upcoming
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border/50 shadow-soft hover:shadow-card transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Destinations</CardTitle>
              <MapPin className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{totalDestinations}</div>
              <p className="text-xs text-muted-foreground">
                Unique locations explored
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border/50 shadow-soft hover:shadow-card transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Travelers</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{totalTravelers}</div>
              <p className="text-xs text-muted-foreground">
                Across all trips
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Trips Section */}
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-foreground">Your Trips</h2>
              <p className="text-muted-foreground mt-1">
                Manage and track all your travel plans in one place
              </p>
            </div>
            <div className="flex items-center gap-4">
              {selectedTrips.length > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Selected ({selectedTrips.length})
                </Button>
              )}
              <CreateTripDialog onTripCreated={handleTripCreated} />
            </div>
          </div>

          {trips.length === 0 ? (
            <Card className="text-center py-12 bg-card border-border/50">
              <CardContent>
                <MapPin className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  No trips planned yet
                </h3>
                <p className="text-muted-foreground mb-6">
                  Start planning your next adventure by creating your first trip!
                </p>
                <CreateTripDialog onTripCreated={handleTripCreated} />
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedTrips.map((trip) => (
                <TripCard
                  key={trip.id}
                  trip={{
                    id: trip.id.toString(),
                    title: trip.title,
                    destination: trip.location || '',
                    startDate: trip.startDate,
                    endDate: trip.endDate,
                    travelers: 1, // Default to 1 for now
                    status: new Date(trip.startDate) > new Date() ? "upcoming" : "completed"
                  }}
                  onClick={() => window.location.href = `/trips/${trip.id}`}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {tripToDelete
                ? "Delete this trip?"
                : `Delete ${selectedTrips.length} selected trips?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              {tripToDelete ? " trip" : " selected trips"} and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowDeleteDialog(false);
              setTripToDelete(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
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