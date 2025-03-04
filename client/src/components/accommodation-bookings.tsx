import { useState } from "react";
import { useAccommodations } from "@/hooks/use-accommodations";
import type { Accommodation } from "@db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MapPicker } from "@/components/map-picker";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import { Plus, Building2, Clock, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface AccommodationBookingsProps {
  tripId: number;
}

export function AccommodationBookings({ tripId }: AccommodationBookingsProps) {
  const { accommodations, createAccommodation, updateAccommodation, isLoading } = useAccommodations(tripId);
  const [editingAccommodation, setEditingAccommodation] = useState<Accommodation | null>(null);
  const [isAddAccommodationOpen, setIsAddAccommodationOpen] = useState(false);

  const form = useForm<Partial<Accommodation>>({
    defaultValues: editingAccommodation || {
      name: "",
      type: "hotel",
      address: "",
      coordinates: { lat: 0, lng: 0 },
      checkInDate: "",
      checkOutDate: "",
      checkInTime: "",
      checkOutTime: "",
      bookingReference: "",
      bookingStatus: "confirmed",
      price: 0,
      currency: "USD",
      roomType: "",
    },
  });

  async function onSubmit(data: Partial<Accommodation>) {
    try {
      if (editingAccommodation) {
        await updateAccommodation({ id: editingAccommodation.id, ...data });
      } else {
        await createAccommodation(data);
      }
      setIsAddAccommodationOpen(false);
      setEditingAccommodation(null);
      form.reset();
    } catch (error) {
      console.error("Failed to save accommodation:", error);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Accommodation Bookings</CardTitle>
            <CardDescription>Track your hotel and accommodation reservations</CardDescription>
          </div>
          <Dialog
            open={isAddAccommodationOpen}
            onOpenChange={(open) => {
              setIsAddAccommodationOpen(open);
              if (!open) {
                setEditingAccommodation(null);
                form.reset();
              }
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Accommodation
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingAccommodation ? "Edit Accommodation" : "Add New Accommodation"}
                </DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Hotel Name" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="hotel">Hotel</SelectItem>
                            <SelectItem value="apartment">Apartment</SelectItem>
                            <SelectItem value="hostel">Hostel</SelectItem>
                            <SelectItem value="resort">Resort</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="coordinates"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location</FormLabel>
                        <FormControl>
                          <div className="h-[300px] rounded-md overflow-hidden">
                            <MapPicker
                              initialPosition={field.value}
                              onPositionChange={(pos) => field.onChange(pos)}
                            />
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="checkInDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Check-in Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="checkInTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Time</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} value={field.value || ''} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="checkOutDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Check-out Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="checkOutTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Time</FormLabel>
                          <FormControl>
                            <Input type="time" {...field} value={field.value || ''} />
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
                  <FormField
                    control={form.control}
                    name="roomType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Room Type</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Double Room, Suite" {...field} value={field.value || ''} />
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
                    {editingAccommodation ? "Update Accommodation" : "Add Accommodation"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {accommodations.map((accommodation) => (
            <div
              key={accommodation.id}
              className="flex items-center justify-between p-4 rounded-lg border bg-card cursor-pointer hover:bg-accent/50"
              onClick={() => {
                setEditingAccommodation(accommodation);
                form.reset(accommodation);
              }}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  <span className="font-medium">{accommodation.name}</span>
                  <Badge>{accommodation.bookingStatus}</Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  {accommodation.type} - {accommodation.roomType}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>
                    {format(new Date(accommodation.checkInDate), "MMM d, yyyy")} to{" "}
                    {format(new Date(accommodation.checkOutDate), "MMM d, yyyy")}
                  </span>
                </div>
                {accommodation.coordinates && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span>Location saved</span>
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="font-medium">
                  {accommodation.price} {accommodation.currency}
                </div>
                <div className="text-sm text-muted-foreground">
                  {accommodation.bookingReference}
                </div>
              </div>
            </div>
          ))}
          {accommodations.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No accommodations booked yet
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}