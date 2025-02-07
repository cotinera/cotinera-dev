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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MapPin, Calendar, Users, ImageIcon } from "lucide-react";
import { ShareTripDialog } from "@/components/share-trip-dialog";
import { useLocation } from "wouter";
import { ImageUpload } from "@/components/image-upload";
import { useState } from "react";

const THUMBNAILS = [
  "https://images.unsplash.com/photo-1605130284535-11dd9eedc58a",
  "https://images.unsplash.com/photo-1554366347-897a5113f6ab",
  "https://images.unsplash.com/photo-1606944331341-72bf6523ff5e",
  "https://images.unsplash.com/photo-1594661745200-810105bcf054",
];

interface TripCardProps {
  trip: Trip & {
    participants?: { userId: number; status: string }[];
  };
}

export function TripCard({ trip }: TripCardProps) {
  const [, setLocation] = useLocation();
  const [isEditingImage, setIsEditingImage] = useState(false);
  const thumbnailIndex = trip.id % THUMBNAILS.length;
  const thumbnail = trip.thumbnail || THUMBNAILS[thumbnailIndex];

  const handleNavigate = () => {
    setLocation(`/trips/${trip.id}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <Card className="overflow-hidden">
      <div 
        className="relative h-48 cursor-pointer"
        onClick={handleNavigate}
      >
        <img
          src={thumbnail}
          alt={trip.title}
          className="w-full h-full object-cover"
        />
      </div>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div 
            className="cursor-pointer"
            onClick={handleNavigate}
          >
            <CardTitle>{trip.title}</CardTitle>
            <CardDescription className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {trip.location}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsEditingImage(true)}
            >
              <ImageIcon className="h-4 w-4" />
            </Button>
            <ShareTripDialog tripId={trip.id} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isEditingImage ? (
          <div className="mb-4">
            <ImageUpload
              tripId={trip.id}
              currentImage={thumbnail}
              onSuccess={() => setIsEditingImage(false)}
            />
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                {formatDistance(new Date(trip.startDate), new Date(), {
                  addSuffix: true,
                })}
              </span>
            </div>
            {trip.participants && trip.participants.length > 0 && (
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
        )}
      </CardContent>
      <CardFooter>
        <Button 
          variant="outline" 
          className="w-full"
          onClick={handleNavigate}
        >
          View Details
        </Button>
      </CardFooter>
    </Card>
  );
}