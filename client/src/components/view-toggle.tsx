import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { Calendar, Layout } from "lucide-react";
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
    <ToggleGroup
      type="single"
      value={isCalendarView ? "calendar" : "details"}
      onValueChange={handleViewChange}
      className="justify-center"
    >
      <ToggleGroupItem value="details" aria-label="View trip details">
        <Layout className="h-4 w-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="calendar" aria-label="View trip calendar">
        <Calendar className="h-4 w-4" />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
