import { formatDistance } from "date-fns";
import type { Trip } from "@db/schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MapPin, Calendar, Users } from "lucide-react";

const THUMBNAILS = [
  "https://images.unsplash.com/photo-1605130284535-11dd9eedc58a",
  "https://images.unsplash.com/photo-1554366347-897a5113f6ab",
  "https://images.unsplash.com/photo-1606944331341-72bf6523ff5e",
  "https://images.unsplash.com/photo-1594661745200-810105bcf054",
];

interface TripCardProps {
  trip: Trip;
}

export function TripCard({ trip }: TripCardProps) {
  // Get a deterministic but random thumbnail based on trip ID
  const thumbnailIndex = trip.id % THUMBNAILS.length;
  const thumbnail = trip.thumbnail || THUMBNAILS[thumbnailIndex];

  return (
    <Card className="overflow-hidden">
      <div className="relative h-48">
        <img
          src={thumbnail}
          alt={trip.title}
          className="w-full h-full object-cover"
        />
      </div>
      <CardHeader>
        <CardTitle>{trip.title}</CardTitle>
        <CardDescription className="flex items-center gap-1">
          <MapPin className="h-4 w-4" />
          {trip.location}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              {formatDistance(new Date(trip.startDate), new Date(), {
                addSuffix: true,
              })}
            </span>
          </div>
          {trip.participants && (
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div className="flex -space-x-2">
                {trip.participants.slice(0, 3).map((participant, i) => (
                  <Avatar key={i} className="h-6 w-6 border-2 border-background">
                    <AvatarFallback>
                      {participant.userId.toString()[0]}
                    </AvatarFallback>
                  </Avatar>
                ))}
                {trip.participants.length > 3 && (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-muted text-xs">
                    +{trip.participants.length - 3}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <Button variant="outline" className="w-full">
          View Details
        </Button>
      </CardFooter>
    </Card>
  );
}
