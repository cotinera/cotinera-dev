import { useState } from "react";
import { MapPin, Calendar, TrendingUp, Users } from "lucide-react";
import TripCard from "@/components/TripCard";
import CreateTripDialog from "@/components/CreateTripDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import heroImage from "@/assets/hero-travel.jpg";

const Index = () => {
  const [trips, setTrips] = useState([
    {
      id: "1",
      title: "Summer Adventure in Bali",
      destination: "Bali, Indonesia",
      startDate: "2024-08-15",
      endDate: "2024-08-22",
      travelers: 2,
      status: "upcoming" as const
    },
    {
      id: "2", 
      title: "European City Tour",
      destination: "Paris, France",
      startDate: "2024-09-10",
      endDate: "2024-09-17",
      travelers: 4,
      status: "upcoming" as const
    },
    {
      id: "3",
      title: "Mountain Hiking Retreat", 
      destination: "Swiss Alps, Switzerland",
      startDate: "2024-07-20",
      endDate: "2024-07-25",
      travelers: 3,
      status: "completed" as const
    }
  ]);

  const handleTripCreated = (newTrip: any) => {
    setTrips(prev => [newTrip, ...prev]);
  };

  const upcomingTrips = trips.filter(trip => trip.status === "upcoming");
  const totalDestinations = new Set(trips.map(trip => trip.destination)).size;
  const totalTravelers = trips.reduce((sum, trip) => sum + trip.travelers, 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative h-96 overflow-hidden">
        <img 
          src={heroImage} 
          alt="Beautiful tropical beach at sunset"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/60 to-accent/40" />
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
            <CreateTripDialog onTripCreated={handleTripCreated} />
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
              {trips.map((trip) => (
                <TripCard 
                  key={trip.id} 
                  trip={trip}
                  onClick={() => console.log("Trip clicked:", trip.title)}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Index;
