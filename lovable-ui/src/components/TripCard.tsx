import { Calendar, MapPin, Users } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Trip {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  travelers: number;
  status: "upcoming" | "ongoing" | "completed";
  image?: string;
}

interface TripCardProps {
  trip: Trip;
  onClick?: () => void;
}

const TripCard = ({ trip, onClick }: TripCardProps) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "upcoming": return "bg-primary/10 text-primary";
      case "ongoing": return "bg-accent/20 text-accent-foreground";
      case "completed": return "bg-muted text-muted-foreground";
      default: return "bg-secondary text-secondary-foreground";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <Card 
      className="group cursor-pointer transition-all duration-300 hover:shadow-card hover:-translate-y-1 bg-card border-border/50"
      onClick={onClick}
    >
      <CardHeader className="p-0">
        <div className="relative h-48 w-full overflow-hidden rounded-t-lg">
          <div className="absolute inset-0 bg-gradient-adventure opacity-90" />
          <div className="absolute inset-0 flex items-center justify-center">
            <MapPin className="w-12 h-12 text-white" />
          </div>
          <Badge 
            className={`absolute top-3 right-3 ${getStatusColor(trip.status)} border-0`}
          >
            {trip.status}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="p-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-xl font-semibold text-foreground group-hover:text-primary transition-colors">
              {trip.title}
            </h3>
            <div className="flex items-center text-muted-foreground mt-1">
              <MapPin className="w-4 h-4 mr-1" />
              <span className="text-sm">{trip.destination}</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center">
              <Calendar className="w-4 h-4 mr-1" />
              <span>{formatDate(trip.startDate)} - {formatDate(trip.endDate)}</span>
            </div>
            
            <div className="flex items-center">
              <Users className="w-4 h-4 mr-1" />
              <span>{trip.travelers} {trip.travelers === 1 ? 'traveler' : 'travelers'}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default TripCard;