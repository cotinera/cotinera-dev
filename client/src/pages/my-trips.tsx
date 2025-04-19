import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, PlusCircle, CalendarCheck, Users, Clock } from "lucide-react";
import type { Trip } from "@db/schema";
import { format } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

export default function MyTripsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const {
    data: trips,
    isLoading: tripsLoading,
    error,
  } = useQuery<Trip[]>({
    queryKey: ["/api/my-trips"],
    queryFn: async () => {
      if (!user) return [];
      
      const res = await fetch(`/api/my-trips`, {
        credentials: "include",
      });
      
      if (!res.ok) {
        throw new Error("Failed to fetch trips");
      }
      
      return res.json();
    },
    enabled: !!user,
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  // Handle error
  useEffect(() => {
    if (error) {
      toast({
        title: "Error",
        description: "Failed to load trips. Please try again.",
        variant: "destructive",
      });
    }
  }, [error, toast]);

  if (authLoading || tripsLoading) {
    return <TripsSkeleton />;
  }

  if (!user) {
    return null; // Will redirect to login
  }

  return (
    <div className="container py-8 max-w-6xl">
      <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Trips</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back, {user.name || user.email}. Manage your upcoming and past trips.
          </p>
        </div>
        <Button onClick={() => navigate("/")}>
          <PlusCircle className="mr-2 h-4 w-4" />
          New Trip
        </Button>
      </div>

      <Tabs defaultValue="upcoming" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="upcoming">Upcoming Trips</TabsTrigger>
          <TabsTrigger value="past">Past Trips</TabsTrigger>
          <TabsTrigger value="all">All Trips</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming">
          <TripsGrid 
            trips={trips?.filter(trip => new Date(trip.endDate) >= new Date())} 
            emptyMessage="No upcoming trips yet. Start planning your next adventure!"
          />
        </TabsContent>

        <TabsContent value="past">
          <TripsGrid 
            trips={trips?.filter(trip => new Date(trip.endDate) < new Date())} 
            emptyMessage="You haven't completed any trips yet."
          />
        </TabsContent>

        <TabsContent value="all">
          <TripsGrid 
            trips={trips} 
            emptyMessage="No trips found. Let's start planning your first trip!"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

type TripsGridProps = {
  trips?: Trip[];
  emptyMessage: string;
};

function TripsGrid({ trips, emptyMessage }: TripsGridProps) {
  if (!trips?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-xl font-medium mb-2">No Trips Found</h3>
        <p className="text-muted-foreground max-w-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {trips.map((trip) => (
        <TripCard key={trip.id} trip={trip} />
      ))}
    </div>
  );
}

function TripCard({ trip }: { trip: Trip }) {
  // Format dates properly
  const startDate = new Date(trip.startDate);
  const endDate = new Date(trip.endDate);
  const isUpcoming = endDate >= new Date();
  
  // Calculate duration
  const durationInDays = Math.ceil(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      {trip.thumbnail && (
        <div className="aspect-video w-full overflow-hidden">
          <img
            src={trip.thumbnail}
            alt={trip.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle className="text-xl truncate">{trip.title}</CardTitle>
          <div 
            className={`px-2 py-1 rounded-full text-xs font-medium ${
              isUpcoming ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
            }`}
          >
            {isUpcoming ? "Upcoming" : "Past"}
          </div>
        </div>
        <CardDescription className="truncate">
          {trip.location || "No location specified"}
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center text-sm text-muted-foreground">
            <CalendarCheck className="mr-2 h-4 w-4" />
            <span>
              {format(startDate, "MMM d")} - {format(endDate, "MMM d, yyyy")}
            </span>
          </div>
          
          <div className="flex items-center text-sm text-muted-foreground">
            <Clock className="mr-2 h-4 w-4" />
            <span>{durationInDays} {durationInDays === 1 ? "day" : "days"}</span>
          </div>
          
          <div className="flex items-center text-sm text-muted-foreground">
            <Users className="mr-2 h-4 w-4" />
            <div className="flex -space-x-2">
              {/* This would be replaced with actual participants */}
              <Avatar className="h-6 w-6 border-2 border-background">
                <AvatarFallback>U</AvatarFallback>
              </Avatar>
              <Avatar className="h-6 w-6 border-2 border-background">
                <AvatarFallback>U2</AvatarFallback>
              </Avatar>
            </div>
          </div>
        </div>
      </CardContent>
      
      <CardFooter>
        <Link href={`/trips/${trip.id}`} className="w-full">
          <Button variant="outline" className="w-full">View Trip Details</Button>
        </Link>
      </CardFooter>
    </Card>
  );
}

function TripsSkeleton() {
  return (
    <div className="container py-8 max-w-6xl">
      <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-4">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      <Skeleton className="h-10 w-64 mb-6" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array(6).fill(0).map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <Skeleton className="h-48 w-full" />
            <CardHeader>
              <Skeleton className="h-6 w-36 mb-2" />
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </CardContent>
            <CardFooter>
              <Skeleton className="h-10 w-full" />
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}