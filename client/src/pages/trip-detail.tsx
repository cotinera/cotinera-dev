import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { FlightBookings } from "@/components/flight-bookings";
import { AccommodationBookings } from "@/components/accommodation-bookings";
import { Checklist } from "@/components/checklist";
import { CalendarView } from "@/components/calendar-view";
import { Loader2, ArrowLeft } from "lucide-react";
import { useNavigate } from "wouter";

export default function TripDetail() {
  const [, params] = useRoute("/trips/:id");
  const tripId = params ? parseInt(params.id) : null;
  const navigate = useNavigate();

  const { data: trip, isLoading } = useQuery({
    queryKey: [`/api/trips/${tripId}`],
    enabled: !!tripId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Trip not found</h1>
          <Button onClick={() => navigate("/")}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate("/")} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-2xl font-bold">{trip.title}</h1>
          <p className="text-muted-foreground">{trip.location}</p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-8">
          <section>
            <h2 className="text-xl font-semibold mb-4">Calendar</h2>
            <CalendarView trips={[trip]} />
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Flights</h2>
            <FlightBookings tripId={trip.id} />
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Accommodations</h2>
            <AccommodationBookings tripId={trip.id} />
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">Checklist</h2>
            <Checklist tripId={trip.id} />
          </section>
        </div>
      </main>
    </div>
  );
}
