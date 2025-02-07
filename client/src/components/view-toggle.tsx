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
    <div className="relative inline-flex rounded-lg bg-muted p-1 text-muted-foreground shadow-sm">
      <ToggleGroup
        type="single"
        value={isCalendarView ? "calendar" : "details"}
        onValueChange={handleViewChange}
        className="relative z-0 grid grid-cols-2"
      >
        <div
          className={`absolute inset-0 z-[-1] w-1/2 rounded-md bg-background 
            shadow-sm transition-all duration-500 ease-in-out transform 
            ${isCalendarView ? "translate-x-full shadow-md" : ""}`}
        />
        <ToggleGroupItem 
          value="details" 
          aria-label="View trip details"
          className="rounded-md px-3 py-2 transition-all duration-500 ease-in-out
            hover:scale-105 hover:text-foreground/90 active:scale-95
            data-[state=on]:text-foreground data-[state=off]:hover:text-foreground/80
            focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/20"
        >
          <LayoutDashboard className="h-4 w-4 mr-2" />
          <span className="hidden sm:inline">Details</span>
        </ToggleGroupItem>
        <ToggleGroupItem 
          value="calendar" 
          aria-label="View trip calendar"
          className="rounded-md px-3 py-2 transition-all duration-500 ease-in-out
            hover:scale-105 hover:text-foreground/90 active:scale-95
            data-[state=on]:text-foreground data-[state=off]:hover:text-foreground/80
            focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/20"
        >
          <CalendarDays className="h-4 w-4 mr-2" />
          <span className="hidden sm:inline">Calendar</span>
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}