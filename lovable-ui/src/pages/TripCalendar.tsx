import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar, Plus, Clock, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const TripCalendar = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // Mock calendar events
  const [events] = useState([
    {
      id: "1",
      title: "Flight to Bali",
      date: "2024-08-15",
      time: "14:30",
      type: "transportation",
      location: "Airport"
    },
    {
      id: "2", 
      title: "Check-in at Ubud Resort",
      date: "2024-08-15",
      time: "16:00",
      type: "accommodation",
      location: "Ubud"
    },
    {
      id: "3",
      title: "Temple Visit - Tirta Empul",
      date: "2024-08-16",
      time: "09:00",
      type: "activity",
      location: "Tampaksiring"
    },
    {
      id: "4",
      title: "Rice Terrace Tour",
      date: "2024-08-16",
      time: "14:00", 
      type: "activity",
      location: "Jatiluwih"
    },
    {
      id: "5",
      title: "Move to Canggu",
      date: "2024-08-18",
      time: "11:00",
      type: "transportation",
      location: "Ubud to Canggu"
    }
  ]);

  const getEventColor = (type: string) => {
    switch (type) {
      case "transportation": return "bg-blue-100 text-blue-800 border-blue-200";
      case "accommodation": return "bg-green-100 text-green-800 border-green-200";
      case "activity": return "bg-purple-100 text-purple-800 border-purple-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const groupEventsByDate = (events: Array<{
    id: string;
    title: string;
    date: string;
    time: string;
    type: string;
    location: string;
  }>) => {
    return events.reduce((acc, event) => {
      const date = event.date;
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(event);
      return acc;
    }, {} as Record<string, typeof events>);
  };

  const groupedEvents = groupEventsByDate(events);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long', 
      day: 'numeric',
      year: 'numeric'
    });
  };

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
              <h1 className="text-xl font-semibold">Trip Calendar</h1>
            </div>
            
            <Button variant="adventure">
              <Plus className="w-4 h-4 mr-2" />
              Add Event
            </Button>
          </div>
        </div>
      </header>

      {/* Calendar Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Calendar View */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Trip Schedule
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {Object.entries(groupedEvents).map(([date, dayEvents]) => (
                  <div key={date} className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-primary"></div>
                      <h3 className="text-lg font-semibold text-foreground">
                        {formatDate(date)}
                      </h3>
                    </div>
                    
                    <div className="space-y-3 ml-6">
                      {dayEvents.map((event) => (
                        <div 
                          key={event.id}
                          className="flex items-center gap-4 p-4 rounded-lg border border-border/50 hover:shadow-soft transition-all"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            <span className="text-sm font-medium text-muted-foreground flex-shrink-0">
                              {event.time}
                            </span>
                            <div className="min-w-0 flex-1">
                              <h4 className="font-medium text-foreground truncate">
                                {event.title}
                              </h4>
                              <div className="flex items-center gap-1 mt-1">
                                <MapPin className="w-3 h-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">
                                  {event.location}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          <Badge 
                            variant="outline" 
                            className={`${getEventColor(event.type)} border flex-shrink-0`}
                          >
                            {event.type}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-foreground">{events.length}</div>
                  <p className="text-sm text-muted-foreground">Total Events</p>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Activities</span>
                    <span className="font-medium">
                      {events.filter(e => e.type === "activity").length}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Transportation</span>
                    <span className="font-medium">
                      {events.filter(e => e.type === "transportation").length}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Accommodation</span>
                    <span className="font-medium">
                      {events.filter(e => e.type === "accommodation").length}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Legend */}
            <Card>
              <CardHeader>
                <CardTitle>Event Types</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                  <span className="text-sm">Activities</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span className="text-sm">Transportation</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-sm">Accommodation</span>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Activity
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Calendar className="w-4 h-4 mr-2" />
                  Set Reminder
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Clock className="w-4 h-4 mr-2" />
                  View Timeline
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default TripCalendar;