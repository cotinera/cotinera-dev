import { useState } from "react";
import { useFlights } from "@/hooks/use-flights";
import type { Flight } from "@db/schema";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { format, parse } from "date-fns";
import { Plus, Plane, Clock, Search, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface FlightBookingsProps {
  tripId: number;
}

export function FlightBookings({ tripId }: FlightBookingsProps) {
  const { flights, createFlight, updateFlight, isLoading } = useFlights(tripId);
  const [isAddFlightOpen, setIsAddFlightOpen] = useState(false);
  const [editingFlight, setEditingFlight] = useState<Flight | null>(null);
  const [isLookingUpFlight, setIsLookingUpFlight] = useState(false);
  const { toast } = useToast();

  const form = useForm<Partial<Flight>>({
    defaultValues: editingFlight || {
      airline: "",
      flightNumber: "",
      departureAirport: "",
      arrivalAirport: "",
      departureDate: "",
      departureTime: "",
      arrivalDate: "",
      arrivalTime: "",
      bookingReference: "",
      bookingStatus: "confirmed",
      price: 0,
      currency: "USD",
    },
  });

  // Function to lookup flight details from the API
  const lookupFlightDetails = async () => {
    const flightNumber = form.getValues("flightNumber");
    const departureDate = form.getValues("departureDate");
    
    if (!flightNumber) {
      toast({
        title: "Flight number required",
        description: "Please enter a flight number to lookup flight details",
        variant: "destructive",
      });
      return;
    }

    if (!departureDate) {
      toast({
        title: "Departure date required",
        description: "Please select a departure date to lookup flight details",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLookingUpFlight(true);
      
      // Call the flight lookup API
      const response = await fetch(`/api/flights/lookup?flightNumber=${flightNumber}&date=${departureDate}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to lookup flight details");
      }
      
      const data = await response.json();
      
      if (!data || !data.flight) {
        throw new Error("No flight information found");
      }
      
      // Parse date and time from ISO string
      const departureDateObj = new Date(data.flight.scheduledDeparture);
      const arrivalDateObj = new Date(data.flight.scheduledArrival);
      
      // Update form with flight details
      form.setValue("airline", data.flight.airline);
      form.setValue("departureAirport", data.flight.departureAirport.code);
      form.setValue("arrivalAirport", data.flight.arrivalAirport.code);
      
      // Format dates and times for form fields
      form.setValue("departureDate", format(departureDateObj, "yyyy-MM-dd"));
      form.setValue("departureTime", format(departureDateObj, "HH:mm"));
      form.setValue("arrivalDate", format(arrivalDateObj, "yyyy-MM-dd"));
      form.setValue("arrivalTime", format(arrivalDateObj, "HH:mm"));
      
      // Set booking reference to flight number if not already set
      if (!form.getValues("bookingReference")) {
        form.setValue("bookingReference", flightNumber);
      }
      
      // Set booking status based on API response
      form.setValue("bookingStatus", data.flight.status.toLowerCase() || "confirmed");
      
      toast({
        title: "Flight details found",
        description: `Found details for ${data.flight.airline} flight ${flightNumber}`,
      });
    } catch (error) {
      console.error("Error looking up flight:", error);
      toast({
        title: "Failed to find flight",
        description: error instanceof Error ? error.message : "Could not retrieve flight details",
        variant: "destructive",
      });
    } finally {
      setIsLookingUpFlight(false);
    }
  };

  async function onSubmit(data: Partial<Flight>) {
    try {
      if (editingFlight) {
        await updateFlight({ id: editingFlight.id, ...data });
      } else {
        await createFlight(data);
      }
      setIsAddFlightOpen(false);
      setEditingFlight(null);
      form.reset();
    } catch (error) {
      console.error("Failed to save flight:", error);
      toast({
        title: "Error",
        description: "Failed to save flight details",
        variant: "destructive",
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Flight Bookings</CardTitle>
            <CardDescription>Manage your flight reservations</CardDescription>
          </div>
          <Dialog
            open={isAddFlightOpen}
            onOpenChange={(open) => {
              setIsAddFlightOpen(open);
              if (!open) {
                setEditingFlight(null);
                form.reset();
              }
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Flight
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingFlight ? "Edit Flight" : "Add New Flight"}
                </DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="airline"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Airline</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="flightNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Flight Number</FormLabel>
                        <div className="flex gap-2">
                          <FormControl>
                            <Input 
                              {...field} 
                              placeholder="e.g. BA123" 
                              className="flex-1"
                            />
                          </FormControl>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={lookupFlightDetails}
                            disabled={isLookingUpFlight}
                          >
                            {isLookingUpFlight ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Search className="h-4 w-4 mr-1" />
                            )}
                            {isLookingUpFlight ? "Looking up..." : "Lookup"}
                          </Button>
                        </div>
                        <FormDescription>
                          Enter a flight number and select a departure date, then click "Lookup" to automatically fill flight details.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="departureAirport"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>From</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="arrivalAirport"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>To</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="departureDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Departure Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="departureTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Time</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="arrivalDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Arrival Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="arrivalTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Time</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="bookingReference"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Booking Reference</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Price</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              value={field.value ?? ''}
                              onChange={(e) =>
                                field.onChange(e.target.value ? parseInt(e.target.value) : null)
                              }
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="currency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Currency</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value ?? ''} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <Button type="submit" className="w-full">
                    {editingFlight ? "Update Flight" : "Add Flight"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {flights.map((flight) => (
            <div
              key={flight.id}
              className="flex items-center justify-between p-4 rounded-lg border bg-card"
              onClick={() => {
                setEditingFlight(flight);
                setIsAddFlightOpen(true);
                form.reset(flight);
              }}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Plane className="h-4 w-4" />
                  <span className="font-medium">
                    {flight.airline} {flight.flightNumber}
                  </span>
                  <Badge>{flight.bookingStatus}</Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  {flight.departureAirport} → {flight.arrivalAirport}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>
                    {format(new Date(flight.departureDate), "MMM d, yyyy")} at{" "}
                    {flight.departureTime}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="font-medium">
                  {flight.price} {flight.currency}
                </div>
                <div className="text-sm text-muted-foreground">
                  {flight.bookingReference}
                </div>
              </div>
            </div>
          ))}
          {flights.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No flights booked yet
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}