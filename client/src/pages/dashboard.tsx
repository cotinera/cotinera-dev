import { useTrips } from "@/hooks/use-trips";
import { useUser } from "@/hooks/use-user";
import { Button } from "@/components/ui/button";
import { TripCard } from "@/components/trip-card";
import { Plus, LogOut } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { LocationAutocomplete } from "@/components/location-autocomplete";
import { useForm } from "react-hook-form";

interface TripFormData {
  title: string;
  location: string;
  startDate: string;
  endDate: string;
}

export default function Dashboard() {
  const { trips, createTrip } = useTrips();
  const { logout } = useUser();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedCoordinates, setSelectedCoordinates] = useState<{ lat: number; lng: number } | null>(null);

  const form = useForm<TripFormData>({
    defaultValues: {
      title: "",
      location: "",
      startDate: "",
      endDate: "",
    },
  });

  async function onCreateTrip(data: TripFormData) {
    try {
      if (!selectedCoordinates) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Please select a location from the suggestions",
        });
        return;
      }

      const tripData = {
        ...data,
        coordinates: selectedCoordinates,
      };

      await createTrip(tripData);
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
        description: "Failed to create trip",
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
          <h2 className="text-xl font-semibold">Your Trips</h2>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Trip
              </Button>
            </DialogTrigger>
            <DialogContent>
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
                          <LocationAutocomplete
                            value={field.value}
                            onChange={(address, coordinates) => {
                              field.onChange(address);
                              setSelectedCoordinates(coordinates || null);
                            }}
                            placeholder="Search for a location..."
                          />
                        </FormControl>
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
          {trips.map((trip) => (
            <TripCard key={trip.id} trip={trip} />
          ))}
          {trips.length === 0 && (
            <div className="col-span-full text-center py-8 text-muted-foreground">
              No trips yet. Create one to get started!
            </div>
          )}
        </div>
      </main>
    </div>
  );
}