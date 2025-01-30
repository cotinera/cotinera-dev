import { Card } from "@/components/ui/card";
import { MapPin } from "lucide-react";

interface MapPlaceholderProps {
  location: string;
}

export function MapPlaceholder({ location }: MapPlaceholderProps) {
  return (
    <Card className="w-full h-[400px] bg-muted relative overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center flex-col gap-4">
        <MapPin className="h-12 w-12 text-muted-foreground" />
        <div className="text-center">
          <p className="font-medium">{location}</p>
          <p className="text-sm text-muted-foreground">Map will be displayed here</p>
        </div>
      </div>
    </Card>
  );
}
