import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { CalendarDays, LayoutDashboard, Map, DollarSign } from "lucide-react";
import { useLocation } from "wouter";

interface ViewToggleProps {
  tripId: number;
}

export function ViewToggle({ tripId }: ViewToggleProps) {
  const [location, setLocation] = useLocation();

  const getCurrentView = () => {
    if (location.includes("/calendar")) return "calendar";
    if (location.includes("/map")) return "map";
    if (location.includes("/spending")) return "spending";
    return "details";
  };

  const handleViewChange = (value: string) => {
    switch (value) {
      case "calendar":
        setLocation(`/trips/${tripId}/calendar`);
        break;
      case "map":
        setLocation(`/trips/${tripId}/map`);
        break;
      case "spending":
        setLocation(`/trips/${tripId}/spending`);
        break;
      default:
        setLocation(`/trips/${tripId}`);
        break;
    }
  };

  return (
    <div className="relative inline-flex rounded-lg bg-muted p-1">
      <ToggleGroup
        type="single"
        value={getCurrentView()}
        onValueChange={handleViewChange}
        className="relative z-0 grid grid-cols-4"
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
      </ToggleGroup>
    </div>
  );
}