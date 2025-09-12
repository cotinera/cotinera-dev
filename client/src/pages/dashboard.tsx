import { useTrips } from "@/hooks/use-trips";
import { useUser } from "@/hooks/use-user";
import { useTutorial } from "@/hooks/use-tutorial";
import { Button } from "@/components/ui/button";
import { TripCard } from "@/components/trip-card";
import { TravelGuide } from "@/components/travel-guide";
import { Plus, LogOut, Trash2, MapPin, Calendar, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { z } from "zod";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { MapPicker } from "@/components/map-picker";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const tripFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  location: z.string().min(1, "Location is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
});

interface TripFormData extends z.infer<typeof tripFormSchema> {}

export default function Dashboard() {
  const { trips, createTrip } = useTrips();
  const { logout } = useUser();
  const { isFirstTime, completeTutorial } = useTutorial();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedCoordinates, setSelectedCoordinates] = useState<{ lat: number; lng: number } | null>(null);
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

  // Calculate trip statistics
  const upcomingTrips = useMemo(() => {
    const now = new Date();
    return trips.filter(trip => {
      const endDate = new Date(trip.endDate);
      return endDate >= now;
    });
  }, [trips]);

  const totalDestinations = useMemo(() => {
    return new Set(trips.map(trip => trip.location)).size;
  }, [trips]);

  const form = useForm<TripFormData>({
    resolver: zodResolver(tripFormSchema),
    defaultValues: {
      title: "",
      location: "",
      startDate: "",
      endDate: "",
    },
  });

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
      
      console.log(`Successfully deleted trip IDs:`, deletedTripIds);
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

  async function onCreateTrip(data: TripFormData) {
    try {
      if (!selectedCoordinates) {
        toast({
          variant: "destructive",
          title: "Location Required",
          description: "Please select a location from the map or search",
        });
        return;
      }

      const startDate = new Date(data.startDate);
      const endDate = new Date(data.endDate);

      if (endDate < startDate) {
        toast({
          variant: "destructive",
          title: "Invalid Dates",
          description: "End date cannot be before start date",
        });
        return;
      }

      const tripData = {
        ...data,
        coordinates: selectedCoordinates,
      };

      const newTrip = await createTrip(tripData);

      if (!newTrip) {
        throw new Error("Failed to create trip. Please try again.");
      }

      setIsCreateOpen(false);
      form.reset();
      setSelectedCoordinates(null);

      toast({
        title: "Success",
        description: "Trip created successfully",
      });
    } catch (error) {
      console.error("Failed to create trip:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create trip. Please try again.",
      });
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <TravelGuide 
        onComplete={completeTutorial}
        isFirstTime={isFirstTime}
      />
      
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold bg-gradient-adventure bg-clip-text text-transparent">
            <span className="font-bold">ATLAS</span>
            <span className="text-lg italic ml-1">by PGC</span>
          </h1>
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="hidden md:flex items-center gap-2">
                  <Avatar className="h-8 w-8 ring-2 ring-primary/20">
                    <AvatarImage src={user.avatar || ""} alt={user.name || user.email} />
                    <AvatarFallback className="bg-gradient-ocean text-white">
                      {user.name ? user.name.charAt(0).toUpperCase() : "U"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{user.name || user.email}</span>
                </div>
                <Button variant="ghost" size="icon" className="hover:bg-destructive/10 hover:text-destructive" title="Logout" onClick={() => logout()}>
                  <LogOut className="h-5 w-5" />
                </Button>
              </div>
            ) : (
              <Link href="/auth">
                <Button className="bg-gradient-adventure hover:shadow-card transition-all duration-300">Login</Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative h-96 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-adventure" />
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative z-10 flex items-center justify-center h-full">
          <div className="text-center text-white px-6">
            <h1 className="text-5xl font-bold mb-4 drop-shadow-lg">
              Your Next Adventure Awaits
            </h1>
            <p className="text-xl mb-8 max-w-2xl mx-auto drop-shadow-md opacity-90">
              Plan, organize, and coordinate unforgettable trips with friends and family.
            </p>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button size="lg" variant="secondary" className="bg-white text-primary hover:bg-white/90 shadow-hero transition-all duration-300 hover:scale-105" data-tutorial="new-trip">
                  <Plus className="h-5 w-5 mr-2" />
                  Start Planning Your Trip
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Create New Trip</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onCreateTrip)}
                    className="space-y-4"
                  >
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Title</FormLabel>
                          <FormControl>
                            <Input placeholder="Summer Vacation" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="location"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Location</FormLabel>
                          <FormControl>
                            <MapPicker
                              value={field.value}
                              onChange={(address, coordinates) => {
                                field.onChange(address);
                                setSelectedCoordinates(coordinates);
                              }}
                              placeholder="Search for a location..."
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="startDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Start Date</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="endDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>End Date</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <Button type="submit" className="w-full bg-gradient-adventure hover:shadow-card transition-all duration-300">
                      Create Trip
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
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
              <CardTitle className="text-sm font-medium">Active Trips</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{upcomingTrips.length}</div>
              <p className="text-xs text-muted-foreground">
                Currently being planned
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
                  className="hover:shadow-soft transition-all duration-300"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Selected ({selectedTrips.length})
                </Button>
              )}
              <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-adventure hover:shadow-card transition-all duration-300">
                    <Plus className="h-4 w-4 mr-2" />
                    New Trip
                  </Button>
                </DialogTrigger>
              </Dialog>
            </div>
          </div>

          {trips.length === 0 ? (
            <Card className="text-center py-12 bg-card border-border/50 shadow-soft">
              <CardContent>
                <MapPin className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  No trips planned yet
                </h3>
                <p className="text-muted-foreground mb-6">
                  Start planning your next adventure by creating your first trip!
                </p>
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-gradient-adventure hover:shadow-card transition-all duration-300">
                      <Plus className="h-4 w-4 mr-2" />
                      Create Your First Trip
                    </Button>
                  </DialogTrigger>
                </Dialog>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedTrips.map((trip) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  selectable={selectedTrips.length > 0}
                  selected={selectedTrips.includes(trip.id)}
                  onSelect={toggleTripSelection}
                  onDelete={handleSingleDelete}
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