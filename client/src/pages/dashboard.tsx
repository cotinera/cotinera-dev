import { useTrips } from "@/hooks/use-trips";
import { useUser } from "@/hooks/use-user";
import { Button } from "@/components/ui/button";
import { TripCard } from "@/components/trip-card";
import { Plus, LogOut, Trash2 } from "lucide-react";
import { useState, useMemo } from "react";
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
          const res = await fetch(`/api/trips/${id}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
          });

          if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || `Failed to delete trip ${id}`);
          }

          return id;
        })
      );
      return results;
    },
    onSuccess: (deletedTripIds) => {
      queryClient.setQueryData(
        ["/api/trips"],
        (old: any[]) => old.filter(trip => !deletedTripIds.includes(trip.id))
      );

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

      // Validate dates
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
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Personal Group Coordinator</h1>
          <Button variant="ghost" size="icon" onClick={() => logout()}>
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold">Your Trips</h2>
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
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Trip
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
                  <Button type="submit" className="w-full">
                    Create Trip
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

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
          {trips.length === 0 && (
            <div className="col-span-full text-center py-8 text-muted-foreground">
              No trips yet. Create one to get started!
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