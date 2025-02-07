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
    <div className="relative inline-flex rounded-lg bg-muted p-1">
      <ToggleGroup
        type="single"
        value={isCalendarView ? "calendar" : "details"}
        onValueChange={handleViewChange}
        className="relative z-0 grid grid-cols-2"
      >
        <div
          className={`absolute inset-0 z-[-1] w-1/2 rounded-md bg-background
            shadow-sm transition-transform duration-200 ease-in-out
            ${isCalendarView ? "translate-x-full" : ""}`}
        />
        <ToggleGroupItem 
          value="details" 
          aria-label="View trip details"
          className="rounded-md px-3 py-2 transition-colors duration-200 ease-in-out
            data-[state=on]:text-foreground data-[state=off]:text-muted-foreground/60
            data-[state=on]:font-medium"
        >
          <LayoutDashboard className="h-4 w-4 mr-2" />
          <span className="hidden sm:inline">Details</span>
        </ToggleGroupItem>
        <ToggleGroupItem 
          value="calendar" 
          aria-label="View trip calendar"
          className="rounded-md px-3 py-2 transition-colors duration-200 ease-in-out
            data-[state=on]:text-foreground data-[state=off]:text-muted-foreground/60
            data-[state=on]:font-medium"
        >
          <CalendarDays className="h-4 w-4 mr-2" />
          <span className="hidden sm:inline">Calendar</span>
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}