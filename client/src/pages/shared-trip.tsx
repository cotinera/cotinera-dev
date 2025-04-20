
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { TripCard } from "@/components/trip-card";
import { CalendarView } from "@/components/calendar-view";
import { Checklist } from "@/components/checklist";
import { Loader2, AlertCircle, MapPin, Calendar, Users } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function SharedTrip() {
  const [, params] = useRoute("/share/:token");
  const token = params?.token;
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Add function to join a trip
  const joinTripMutation = useMutation({
    mutationFn: async (tripId: number) => {
      const res = await fetch(`/api/trips/${tripId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
      });
      
      if (!res.ok) {
        throw new Error(await res.text());
      }
      
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success!",
        description: "You have joined the trip successfully.",
      });
      // Redirect to the trip detail page
      setLocation(`/trips/${data.tripId}`);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to join trip",
      });
    }
  });

  const joinTrip = (tripId: number) => {
    joinTripMutation.mutate(tripId);
  };

  const { data, isLoading, error } = useQuery({
    queryKey: [`/api/share/${token}`],
    enabled: !!token,
    queryFn: async () => {
      const res = await fetch(`/api/share/${token}`, {
        credentials: 'include'
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      return res.json();
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-blue-50 to-indigo-100">
        <div className="bg-white p-6 rounded-xl shadow-md">
          <Loader2 className="h-12 w-12 animate-spin text-indigo-600 mx-auto" />
          <p className="text-center mt-4 text-gray-600 font-medium">Loading trip details...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-red-50 to-pink-100">
        <Card className="w-full max-w-md mx-4 border-red-200 shadow-lg">
          <CardContent className="pt-6">
            <div className="flex mb-4 gap-3 items-center">
              <AlertCircle className="h-10 w-10 text-red-500" />
              <h1 className="text-2xl font-bold text-gray-900">
                Share Link Invalid
              </h1>
            </div>
            <p className="mt-4 text-sm text-gray-600">
              This share link may have expired or been revoked. Please request a new share link from the trip owner.
            </p>
            <Button variant="outline" className="mt-6 w-full" asChild>
              <a href="/">Return to Home</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { trip, accessLevel, isParticipant } = data;
  
  // Format dates for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-indigo-100">
      <header className="bg-white shadow-md">
        <div className="container mx-auto px-4 py-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 text-white p-2 rounded-full">
              <MapPin className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Shared Trip</h1>
          </div>
          <div className="flex items-center gap-4">
            {user && isParticipant && (
              <div className="text-sm py-1 px-3 rounded-full bg-indigo-100 text-indigo-800 font-medium">
                {accessLevel === "edit" ? "Editor Access" : "Viewer Access"}
              </div>
            )}
            {user && !isParticipant && (
              <Button 
                className="bg-green-600 hover:bg-green-700 text-white" 
                onClick={() => joinTrip(trip.id)}
              >
                Join Trip
              </Button>
            )}
            {!user && (
              <Button className="bg-indigo-600 hover:bg-indigo-700" asChild>
                <a href={`/auth?redirect=/share/${token}`}>Sign in to join</a>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-md overflow-hidden mb-8">
          <div className="p-6">
            <div className="flex flex-col md:flex-row justify-between">
              <div>
                <h2 className="text-3xl font-bold text-gray-800">{trip.title}</h2>
                <p className="text-gray-600 mt-2">{trip.location}</p>
                
                <div className="flex mt-4 gap-6">
                  <div className="flex items-center gap-2 text-gray-700">
                    <Calendar className="h-5 w-5 text-indigo-600" />
                    <div>
                      <div className="text-sm text-gray-500">Dates</div>
                      <div>{formatDate(trip.startDate)} - {formatDate(trip.endDate)}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 text-gray-700">
                    <Users className="h-5 w-5 text-indigo-600" />
                    <div>
                      <div className="text-sm text-gray-500">Participants</div>
                      <div>{trip.participants?.length || 0} people</div>
                    </div>
                  </div>
                </div>
              </div>
              
              {trip.thumbnail && (
                <div className="mt-4 md:mt-0">
                  <img 
                    src={trip.thumbnail} 
                    alt={trip.title}
                    className="h-40 w-64 object-cover rounded-lg shadow-sm"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md overflow-hidden mb-8">
          <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
            <h3 className="text-lg font-semibold text-gray-800">Trip Calendar</h3>
          </div>
          <div className="p-6">
            <CalendarView trips={[trip]} />
          </div>
        </div>

        {(user && accessLevel === "edit") && (
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-800">Trip Checklist</h3>
            </div>
            <div className="p-6">
              <Checklist tripId={trip.id} />
            </div>
          </div>
        )}
      </main>
      
      <footer className="bg-gray-50 border-t border-gray-200 mt-12 py-6">
        <div className="container mx-auto px-4">
          <p className="text-center text-gray-500 text-sm">
            This is a shared trip from TripPlanner. Sign in to collaborate.
          </p>
        </div>
      </footer>
    </div>
  );
}
