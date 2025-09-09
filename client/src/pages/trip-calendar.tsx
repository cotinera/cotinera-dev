import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft, Calendar, Plus, Clock, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import type { Trip, Activity } from "@db/schema";
import { DayView } from "@/components/calendar/day-view";
import { CalendarSummary } from "@/components/calendar/calendar-summary";
import { GoogleCalendarSync } from "@/components/calendar/google-calendar-sync";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type ViewMode = "edit" | "summary";

export default function TripCalendar() {
  const [, params] = useRoute("/trips/:id/calendar");
  const tripId = params ? parseInt(params.id) : null;
  const [, setLocation] = useLocation();
  const [viewMode, setViewMode] = useState<ViewMode>("edit");

  const { data: trip, isLoading: tripLoading } = useQuery<Trip>({
    queryKey: ["/api/trips", tripId],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripId}`);
      if (!res.ok) {
        throw new Error("Failed to fetch trip");
      }
      return res.json();
    },
    enabled: !!tripId,
  });

  const { data: activities = [], isLoading: activitiesLoading } = useQuery<Activity[]>({
    queryKey: [`/api/trips/${tripId}/activities`],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripId}/activities`);
      if (!res.ok) throw new Error("Failed to fetch activities");
      return res.json();
    },
    enabled: !!tripId,
  });

  const isLoading = tripLoading || activitiesLoading;

  const getEventColor = (type: string) => {
    switch (type) {
      case "transportation": return "bg-blue-100 text-blue-800 border-blue-200";
      case "accommodation": return "bg-green-100 text-green-800 border-green-200";
      case "activity": return "bg-purple-100 text-purple-800 border-purple-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const groupEventsByDate = (events: Activity[]) => {
    return events.reduce((acc, event) => {
      const date = new Date(event.startTime).toDateString();
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(event);
      return acc;
    }, {} as Record<string, Activity[]>);
  };

  const groupedEvents = groupEventsByDate(activities);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

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
          <Button onClick={() => setLocation("/")}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => setLocation(`/trips/${tripId}`)}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Trip
              </Button>
              <h1 className="text-xl font-semibold">Trip Calendar</h1>
            </div>
            
            <div className="flex items-center gap-4">
              <ToggleGroup type="single" value={viewMode} onValueChange={(value: ViewMode) => value && setViewMode(value)}>
                <ToggleGroupItem value="edit" size="sm">
                  Edit View
                </ToggleGroupItem>
                <ToggleGroupItem value="summary" size="sm">
                  Summary
                </ToggleGroupItem>
              </ToggleGroup>
              
              <Button variant="adventure">
                <Plus className="w-4 h-4 mr-2" />
                Add Event
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Google Calendar Sync */}
      {import.meta.env.VITE_GOOGLE_CLIENT_ID && (
        <div className="container mx-auto px-6 py-4 border-b">
          <GoogleCalendarSync trip={trip} activities={activities} />
        </div>
      )}

      {/* Calendar Content */}
      <main className="container mx-auto px-6 py-8">
        {viewMode === "edit" ? (
          <DayView trip={trip} />
        ) : (
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
                  {Object.entries(groupedEvents).length > 0 ? (
                    Object.entries(groupedEvents).map(([date, dayEvents]) => (
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
                                  {formatTime(event.startTime)}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <h4 className="font-medium text-foreground truncate">
                                    {event.title}
                                  </h4>
                                  {event.location && (
                                    <div className="flex items-center gap-1 mt-1">
                                      <MapPin className="w-3 h-3 text-muted-foreground" />
                                      <span className="text-xs text-muted-foreground">
                                        {event.location}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              <Badge 
                                variant="outline" 
                                className="border flex-shrink-0"
                              >
                                Event
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12">
                      <Calendar className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-foreground mb-2">
                        No events scheduled
                      </h3>
                      <p className="text-muted-foreground mb-6">
                        Start planning your itinerary by adding events to your trip calendar.
                      </p>
                      <Button variant="adventure">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Your First Event
                      </Button>
                    </div>
                  )}
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
                    <div className="text-2xl font-bold text-foreground">{activities.length}</div>
                    <p className="text-sm text-muted-foreground">Total Events</p>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Activities</span>
                      <span className="font-medium">
                        {activities.filter(e => !e.location?.toLowerCase().includes('airport')).length}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Transportation</span>
                      <span className="font-medium">
                        {activities.filter(e => e.location?.toLowerCase().includes('airport')).length}
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
        )}
      </main>
    </div>
  );
}