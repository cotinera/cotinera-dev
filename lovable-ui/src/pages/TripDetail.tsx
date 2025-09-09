import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Calendar, Users, Share2, Edit, Camera, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import type { Trip } from "@/types/trip";

const TripDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Mock trip data based on your schema
  const [trip] = useState<Trip>({
    id: id || "1",
    title: "Summer Adventure in Bali",
    description: "An amazing group trip exploring the beautiful islands of Indonesia with friends",
    startDate: "2024-08-15",
    endDate: "2024-08-22",
    ownerId: "user1",
    coverImage: "/api/placeholder/800/400",
    status: "planned",
    isPublic: false,
    locations: [
      {
        id: "loc1",
        name: "Ubud",
        description: "Cultural heart of Bali",
        coordinates: { lat: -8.5069, lng: 115.2625 },
        startDate: "2024-08-15",
        endDate: "2024-08-18",
        address: "Ubud, Bali, Indonesia"
      },
      {
        id: "loc2", 
        name: "Canggu",
        description: "Surfing and beach vibes",
        coordinates: { lat: -8.6465, lng: 115.1398 },
        startDate: "2024-08-18",
        endDate: "2024-08-22",
        address: "Canggu, Bali, Indonesia"
      }
    ],
    participants: [
      {
        userId: "user1",
        role: "owner",
        joinedAt: "2024-07-01T00:00:00Z",
        status: "accepted",
        user: {
          id: "user1",
          name: "Alex Chen",
          email: "alex@example.com",
          avatar: "/api/placeholder/40/40"
        }
      },
      {
        userId: "user2",
        role: "editor", 
        joinedAt: "2024-07-02T00:00:00Z",
        status: "accepted",
        user: {
          id: "user2",
          name: "Sarah Miller",
          email: "sarah@example.com"
        }
      }
    ],
    budget: {
      total: 2500,
      currency: "USD",
      categories: {
        accommodation: 800,
        transportation: 600,
        food: 500,
        activities: 400,
        other: 200
      }
    },
    createdAt: "2024-07-01T00:00:00Z",
    updatedAt: "2024-07-15T00:00:00Z"
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getDaysDifference = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({
      title: "Link copied!",
      description: "Trip link has been copied to clipboard.",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Trips
              </Button>
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleShare}>
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
              <Button variant="outline" size="sm">
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative h-64 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-adventure opacity-90" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Camera className="w-16 h-16 text-white/50" />
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
          <div className="container mx-auto">
            <div className="flex items-end justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">{trip.title}</h1>
                <p className="text-white/90 mb-4">{trip.description}</p>
                
                <div className="flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    <span>{formatDate(trip.startDate)} - {formatDate(trip.endDate)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    <span>{trip.locations.length} destinations</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    <span>{trip.participants.length} travelers</span>
                  </div>
                </div>
              </div>
              
              <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                {getDaysDifference(trip.startDate, trip.endDate)} days
              </Badge>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="overview" className="space-y-6">
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="itinerary">Itinerary</TabsTrigger>
                <TabsTrigger value="places">Places</TabsTrigger>
                <TabsTrigger value="chat">Chat</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                {/* Destinations */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="w-5 h-5" />
                      Destinations
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {trip.locations.map((location, index) => (
                      <div key={location.id} className="flex items-start gap-4 p-4 rounded-lg border border-border/50 hover:shadow-soft transition-all">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-foreground">{location.name}</h3>
                          <p className="text-sm text-muted-foreground mb-2">{location.description}</p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>{formatDate(location.startDate)} - {formatDate(location.endDate)}</span>
                            <span>{getDaysDifference(location.startDate, location.endDate)} days</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button 
                    variant="outline" 
                    className="h-16 flex-col gap-2"
                    onClick={() => navigate(`/trips/${trip.id}/map`)}
                  >
                    <MapPin className="w-5 h-5" />
                    View Map
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-16 flex-col gap-2"
                    onClick={() => navigate(`/trips/${trip.id}/calendar`)}
                  >
                    <Calendar className="w-5 h-5" />
                    Calendar
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-16 flex-col gap-2"
                    onClick={() => navigate(`/trips/${trip.id}/spending`)}
                  >
                    <Star className="w-5 h-5" />
                    Expenses
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="itinerary">
                <Card>
                  <CardHeader>
                    <CardTitle>Trip Itinerary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">Detailed itinerary planning coming soon...</p>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="places">
                <Card>
                  <CardHeader>
                    <CardTitle>Pinned Places</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">Discover and save places to visit...</p>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="chat">
                <Card>
                  <CardHeader>
                    <CardTitle>Group Chat</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">Stay connected with your travel group...</p>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Participants */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Travelers ({trip.participants.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {trip.participants.map((participant) => (
                  <div key={participant.userId} className="flex items-center gap-3">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={participant.user?.avatar} />
                      <AvatarFallback>
                        {participant.user?.name?.charAt(0) || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{participant.user?.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{participant.role}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Budget Overview */}
            <Card>
              <CardHeader>
                <CardTitle>Budget Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-foreground">
                    ${trip.budget.total.toLocaleString()} {trip.budget.currency}
                  </div>
                  <p className="text-sm text-muted-foreground">Total Budget</p>
                </div>
                
                <div className="space-y-2">
                  {Object.entries(trip.budget.categories).map(([category, amount]) => (
                    <div key={category} className="flex justify-between text-sm">
                      <span className="capitalize text-muted-foreground">{category}</span>
                      <span className="font-medium">${amount}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default TripDetail;