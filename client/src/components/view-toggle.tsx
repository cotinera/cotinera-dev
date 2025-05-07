import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { CalendarDays, LayoutDashboard, Map, DollarSign, MoreVertical, Check } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

interface ViewToggleProps {
  tripId: number;
}

interface ViewPreferences {
  showCalendar: boolean;
  showSpending: boolean;
  showMap: boolean;
}

export function ViewToggle({ tripId }: ViewToggleProps) {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showDropdown, setShowDropdown] = useState(false);
  const [viewPreferences, setViewPreferences] = useState<ViewPreferences>({
    showCalendar: true,
    showSpending: true,
    showMap: true
  });

  const { data: trip } = useQuery({
    queryKey: ["/api/trips", tripId],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripId}`);
      if (!res.ok) throw new Error("Failed to fetch trip");
      return res.json();
    },
    enabled: !!tripId,
  });

  // Initialize viewPreferences from trip data
  useEffect(() => {
    if (trip?.viewPreferences) {
      setViewPreferences(trip.viewPreferences);
    }
  }, [trip]);

  const updateViewPreferencesMutation = useMutation({
    mutationFn: async (newPreferences: ViewPreferences) => {
      const res = await fetch(`/api/trips/${tripId}/view-preferences`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newPreferences),
      });
      
      if (!res.ok) {
        throw new Error("Failed to update view preferences");
      }
      
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId] });
      toast({
        title: "View preferences updated",
        description: "Your changes have been saved",
        variant: "default",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update view preferences",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getCurrentView = () => {
    if (location.includes("/calendar")) return "calendar";
    if (location.includes("/map")) return "map";
    if (location.includes("/spending")) return "spending";
    return "details";
  };

  const handleViewChange = (value: string) => {
    switch (value) {
      case "calendar":
        if (viewPreferences.showCalendar) {
          setLocation(`/trips/${tripId}/calendar`);
        }
        break;
      case "map":
        if (viewPreferences.showMap) {
          setLocation(`/trips/${tripId}/map`);
        }
        break;
      case "spending":
        if (viewPreferences.showSpending) {
          setLocation(`/trips/${tripId}/spending`);
        }
        break;
      default:
        setLocation(`/trips/${tripId}`);
        break;
    }
  };
  
  const toggleViewPreference = (view: keyof ViewPreferences) => {
    const newPreferences = { ...viewPreferences, [view]: !viewPreferences[view] };
    setViewPreferences(newPreferences);
    updateViewPreferencesMutation.mutate(newPreferences);
    
    // If currently on a view that's being disabled, redirect to details
    const currentView = getCurrentView();
    if (
      (currentView === "calendar" && view === "showCalendar" && !newPreferences.showCalendar) ||
      (currentView === "map" && view === "showMap" && !newPreferences.showMap) ||
      (currentView === "spending" && view === "showSpending" && !newPreferences.showSpending)
    ) {
      setLocation(`/trips/${tripId}`);
    }
  };

  // No need for the grid columns calculation anymore since we're using flex

  return (
    <div className="flex items-center">
      <div className="relative rounded-lg bg-muted p-1">
        <ToggleGroup
          type="single"
          value={getCurrentView()}
          onValueChange={handleViewChange}
          className="relative z-0 flex"
        >
          <ToggleGroupItem 
            value="details" 
            aria-label="View trip details"
            className="rounded-md px-3 py-2 transition-colors duration-200 ease-in-out
              hover:bg-background/80 hover:text-foreground
              data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:font-medium
              data-[state=off]:text-muted-foreground/60"
          >
            <LayoutDashboard className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Details</span>
          </ToggleGroupItem>
          {viewPreferences.showCalendar && (
            <ToggleGroupItem 
              value="calendar" 
              aria-label="View trip calendar"
              className="rounded-md px-3 py-2 transition-colors duration-200 ease-in-out
                hover:bg-background/80 hover:text-foreground
                data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:font-medium
                data-[state=off]:text-muted-foreground/60"
            >
              <CalendarDays className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Calendar</span>
            </ToggleGroupItem>
          )}
          {viewPreferences.showSpending && (
            <ToggleGroupItem 
              value="spending" 
              aria-label="View trip spending"
              className="rounded-md px-3 py-2 transition-colors duration-200 ease-in-out
                hover:bg-background/80 hover:text-foreground
                data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:font-medium
                data-[state=off]:text-muted-foreground/60"
            >
              <DollarSign className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Spending</span>
            </ToggleGroupItem>
          )}
          {viewPreferences.showMap && (
            <ToggleGroupItem 
              value="map" 
              aria-label="View trip map"
              className="rounded-md px-3 py-2 transition-colors duration-200 ease-in-out
                hover:bg-background/80 hover:text-foreground
                data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:font-medium
                data-[state=off]:text-muted-foreground/60"
            >
              <Map className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Map</span>
            </ToggleGroupItem>
          )}
        </ToggleGroup>
      </div>
      
      {/* Three dots menu as a separate bubble */}
      <div className="ml-2">
        <DropdownMenu>
          <DropdownMenuTrigger className="w-8 h-8 inline-flex items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-background hover:text-foreground focus:outline-none">
            <MoreVertical className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Customize Views</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={viewPreferences.showCalendar}
              onCheckedChange={() => toggleViewPreference('showCalendar')}
            >
              <CalendarDays className="h-4 w-4 mr-2 inline" />
              Show Calendar
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={viewPreferences.showSpending}
              onCheckedChange={() => toggleViewPreference('showSpending')}
            >
              <DollarSign className="h-4 w-4 mr-2 inline" />
              Show Spending
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={viewPreferences.showMap}
              onCheckedChange={() => toggleViewPreference('showMap')}
            >
              <Map className="h-4 w-4 mr-2 inline" />
              Show Map
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}