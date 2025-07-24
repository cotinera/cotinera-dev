import { useState, useEffect } from "react";
import { useGoogleLogin } from "@react-oauth/google";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Calendar, LogOut, Loader2, CheckCircle } from "lucide-react";
import type { Activity, Trip } from "@db/schema";

interface GoogleCalendarSyncProps {
  trip: Trip;
  activities: Activity[];
}

interface GoogleCalendar {
  id: string;
  summary: string;
  primary?: boolean;
}

export function GoogleCalendarSync({ trip, activities }: GoogleCalendarSyncProps) {
  const { toast } = useToast();
  const [isConnected, setIsConnected] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>("");
  const [autoSync, setAutoSync] = useState(false);
  const [isLoadingCalendars, setIsLoadingCalendars] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Check if we have a stored token and calendar preference
  useEffect(() => {
    const storedToken = localStorage.getItem(`google_calendar_token_${trip.id}`);
    const storedCalendarId = localStorage.getItem(`google_calendar_id_${trip.id}`);
    const storedAutoSync = localStorage.getItem(`google_calendar_autosync_${trip.id}`);
    
    if (storedToken) {
      setAccessToken(storedToken);
      setIsConnected(true);
      if (storedCalendarId) {
        setSelectedCalendarId(storedCalendarId);
      }
      if (storedAutoSync === 'true') {
        setAutoSync(true);
      }
    }
  }, [trip.id]);

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      const token = tokenResponse.access_token;
      setAccessToken(token);
      setIsConnected(true);
      
      // Store token for this trip
      localStorage.setItem(`google_calendar_token_${trip.id}`, token);
      
      // Fetch calendars
      await fetchCalendars(token);
      
      toast({
        title: "Connected to Google Calendar",
        description: "You can now sync your trip events.",
      });
    },
    onError: (error) => {
      console.error("Login error:", error);
      toast({
        title: "Connection failed",
        description: "Could not connect to Google Calendar. Please try again.",
        variant: "destructive",
      });
    },
    scope: "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly",
  });

  const fetchCalendars = async (token: string) => {
    setIsLoadingCalendars(true);
    try {
      const response = await fetch(
        "https://www.googleapis.com/calendar/v3/users/me/calendarList",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch calendars");
      }

      const data = await response.json();
      const calendarList = data.items || [];
      setCalendars(calendarList);
      
      // Auto-select primary calendar if no calendar is selected
      const primaryCalendar = calendarList.find((cal: GoogleCalendar) => cal.primary);
      if (primaryCalendar && !selectedCalendarId) {
        setSelectedCalendarId(primaryCalendar.id);
        localStorage.setItem(`google_calendar_id_${trip.id}`, primaryCalendar.id);
      }
    } catch (error) {
      console.error("Error fetching calendars:", error);
      toast({
        title: "Error",
        description: "Could not fetch your calendars. Please reconnect.",
        variant: "destructive",
      });
      handleDisconnect();
    } finally {
      setIsLoadingCalendars(false);
    }
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    setAccessToken(null);
    setCalendars([]);
    setSelectedCalendarId("");
    setAutoSync(false);
    
    // Clear stored data for this trip
    localStorage.removeItem(`google_calendar_token_${trip.id}`);
    localStorage.removeItem(`google_calendar_id_${trip.id}`);
    localStorage.removeItem(`google_calendar_autosync_${trip.id}`);
    
    toast({
      title: "Disconnected",
      description: "Disconnected from Google Calendar.",
    });
  };

  const handleCalendarChange = (calendarId: string) => {
    setSelectedCalendarId(calendarId);
    localStorage.setItem(`google_calendar_id_${trip.id}`, calendarId);
  };

  const handleAutoSyncChange = (checked: boolean) => {
    setAutoSync(checked);
    localStorage.setItem(`google_calendar_autosync_${trip.id}`, checked.toString());
  };

  const syncAllEvents = async () => {
    if (!accessToken || !selectedCalendarId) {
      toast({
        title: "Error",
        description: "Please connect to Google Calendar and select a calendar first.",
        variant: "destructive",
      });
      return;
    }

    setIsSyncing(true);
    let successCount = 0;
    let errorCount = 0;

    for (const activity of activities) {
      try {
        await syncEventToGoogle(activity, accessToken, selectedCalendarId);
        successCount++;
      } catch (error) {
        console.error(`Failed to sync activity ${activity.id}:`, error);
        errorCount++;
      }
    }

    setIsSyncing(false);

    if (successCount > 0) {
      toast({
        title: "Sync complete",
        description: `Successfully synced ${successCount} event${successCount > 1 ? 's' : ''} to Google Calendar.${errorCount > 0 ? ` ${errorCount} event${errorCount > 1 ? 's' : ''} failed.` : ''}`,
      });
    } else {
      toast({
        title: "Sync failed",
        description: "Could not sync any events. Please try again.",
        variant: "destructive",
      });
    }
  };

  const syncEventToGoogle = async (activity: Activity, token: string, calendarId: string) => {
    const event = {
      summary: activity.title,
      description: activity.description || `Activity from ${trip.title} trip`,
      start: {
        dateTime: activity.startTime,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: activity.endTime,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      location: activity.location || trip.location,
    };

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || "Failed to create event");
    }

    return response.json();
  };

  // Export function to be called when creating/updating events
  const syncSingleEvent = async (activity: Activity) => {
    if (!autoSync || !accessToken || !selectedCalendarId) {
      return;
    }

    try {
      await syncEventToGoogle(activity, accessToken, selectedCalendarId);
      toast({
        title: "Event synced",
        description: `"${activity.title}" has been added to your Google Calendar.`,
      });
    } catch (error) {
      console.error("Failed to sync event:", error);
      toast({
        title: "Sync failed",
        description: "Could not sync event to Google Calendar.",
        variant: "destructive",
      });
    }
  };

  // Expose sync function to parent component
  useEffect(() => {
    // Store sync function in window for access by other components
    if (autoSync && accessToken && selectedCalendarId) {
      (window as any)[`googleCalendarSync_${trip.id}`] = syncSingleEvent;
    } else {
      delete (window as any)[`googleCalendarSync_${trip.id}`];
    }

    return () => {
      delete (window as any)[`googleCalendarSync_${trip.id}`];
    };
  }, [autoSync, accessToken, selectedCalendarId, trip.id]);

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Google Calendar Sync
        </CardTitle>
        <CardDescription>
          Sync your trip events with Google Calendar
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isConnected ? (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Connect your Google account to sync events
            </p>
            <Button onClick={() => googleLogin()} size="sm">
              <Calendar className="h-4 w-4 mr-2" />
              Connect Google Calendar
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">Connected to Google Calendar</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDisconnect}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Disconnect
              </Button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="calendar-select">Select Calendar</Label>
                <Select
                  value={selectedCalendarId}
                  onValueChange={handleCalendarChange}
                  disabled={isLoadingCalendars}
                >
                  <SelectTrigger id="calendar-select">
                    <SelectValue placeholder={isLoadingCalendars ? "Loading calendars..." : "Select a calendar"} />
                  </SelectTrigger>
                  <SelectContent>
                    {calendars.map((calendar) => (
                      <SelectItem key={calendar.id} value={calendar.id}>
                        {calendar.summary}
                        {calendar.primary && " (Primary)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-sync">Auto-sync new events</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically add new events to Google Calendar
                  </p>
                </div>
                <Switch
                  id="auto-sync"
                  checked={autoSync}
                  onCheckedChange={handleAutoSyncChange}
                  disabled={!selectedCalendarId}
                />
              </div>

              {activities.length > 0 && (
                <div className="pt-2">
                  <Button
                    onClick={syncAllEvents}
                    disabled={!selectedCalendarId || isSyncing}
                    className="w-full"
                    size="sm"
                  >
                    {isSyncing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <Calendar className="h-4 w-4 mr-2" />
                        Sync All Events ({activities.length})
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}