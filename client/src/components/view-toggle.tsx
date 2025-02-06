import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { CalendarDays, LayoutDashboard } from "lucide-react";
import { useLocation } from "wouter";

interface ViewToggleProps {
  tripId: number;
}

export function ViewToggle({ tripId }: ViewToggleProps) {
  const [location, setLocation] = useLocation();
  const isCalendarView = location.includes("/calendar");

  const handleViewChange = (value: string) => {
    if (value === "calendar") {
      setLocation(`/trips/${tripId}/calendar`);
    } else {
      setLocation(`/trips/${tripId}`);
    }
  };

  return (
    <div className="inline-flex rounded-lg border bg-card p-1 text-card-foreground shadow-sm">
      <ToggleGroup
        type="single"
        value={isCalendarView ? "calendar" : "details"}
        onValueChange={handleViewChange}
        className="grid grid-cols-2 gap-1"
      >
        <ToggleGroupItem 
          value="details" 
          aria-label="View trip details"
          className="px-3 py-2 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          <LayoutDashboard className="h-4 w-4 mr-2" />
          <span className="hidden sm:inline">Details</span>
        </ToggleGroupItem>
        <ToggleGroupItem 
          value="calendar" 
          aria-label="View trip calendar"
          className="px-3 py-2 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          <CalendarDays className="h-4 w-4 mr-2" />
          <span className="hidden sm:inline">Calendar</span>
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}