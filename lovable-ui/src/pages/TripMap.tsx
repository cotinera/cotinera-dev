import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Navigation, Layers, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const TripMap = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  // Mock locations for the trip
  const locations = [
    {
      id: "loc1",
      name: "Ubud Cultural Center",
      coordinates: { lat: -8.5069, lng: 115.2625 },
      type: "cultural"
    },
    {
      id: "loc2",
      name: "Canggu Beach",
      coordinates: { lat: -8.6465, lng: 115.1398 },
      type: "beach"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate(`/trips/${id}`)}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Trip
              </Button>
              <h1 className="text-xl font-semibold">Trip Map</h1>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Search places..." 
                  className="pl-10 w-64"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Map Container */}
      <div className="flex h-[calc(100vh-81px)]">
        {/* Sidebar */}
        <div className="w-80 border-r bg-card overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Map Controls */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="w-5 h-5" />
                  Map Layers
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Satellite View</span>
                  <Button variant="outline" size="sm">Toggle</Button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Traffic</span>
                  <Button variant="outline" size="sm">Show</Button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Transit</span>
                  <Button variant="outline" size="sm">Show</Button>
                </div>
              </CardContent>
            </Card>

            {/* Locations */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Trip Locations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {locations.map((location, index) => (
                  <div 
                    key={location.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:shadow-soft transition-all cursor-pointer"
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-foreground">{location.name}</h3>
                      <p className="text-xs text-muted-foreground capitalize">{location.type}</p>
                    </div>
                    <Button variant="ghost" size="sm">
                      <Navigation className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start">
                  <MapPin className="w-4 h-4 mr-2" />
                  Add Place
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Navigation className="w-4 h-4 mr-2" />
                  Get Directions
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Search className="w-4 h-4 mr-2" />
                  Find Nearby
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Map Area */}
        <div className="flex-1 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5 flex items-center justify-center">
            <div className="text-center">
              <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-adventure flex items-center justify-center">
                <MapPin className="w-12 h-12 text-white" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">Interactive Map</h2>
              <p className="text-muted-foreground mb-4 max-w-md">
                Google Maps integration will be displayed here with all your trip locations, 
                pinned places, and interactive features.
              </p>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>• View all destinations on the map</p>
                <p>• Search and discover new places</p>
                <p>• Get directions between locations</p>
                <p>• Pin interesting places to visit</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TripMap;