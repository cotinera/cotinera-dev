import { formatDistance } from "date-fns";
import type { Trip } from "@db/schema";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Button } from "@/components/ui/button";
import { MapPin, Calendar, Users, ImageIcon, Trash2, Check } from "lucide-react";
import { ShareTripDialog } from "@/components/share-trip-dialog";
import { useLocation } from "wouter";
import { ImageUpload } from "@/components/image-upload";
import { useState } from "react";
import { cn, generateGradientImage } from "@/lib/utils";

interface TripCardProps {
  trip: Trip & {
    participants?: { userId: number | null; name?: string; status: string }[];
  };
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (tripId: number) => void;
  onDelete?: (tripId: number) => void;
}

export function TripCard({ trip, selectable, selected, onSelect, onDelete }: TripCardProps) {
  const [, setLocation] = useLocation();
  const [isEditingImage, setIsEditingImage] = useState(false);
  // Generate a gradient image based on trip ID for consistent, unique thumbnails
  const gradientThumbnail = generateGradientImage(trip.id);
  const thumbnail = trip.thumbnail || gradientThumbnail;

  // Live query for participants with proper error handling and retries
  const { data: participants = [], isError } = useQuery({
    queryKey: [`/api/trips/${trip.id}/participants`],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${trip.id}/participants`, {
        credentials: 'include', // Ensure cookies are sent
      });
      if (!res.ok) {
        const error = await res.text();
        throw new Error(error || "Failed to fetch participants");
      }
      return res.json();
    },
    retry: 3, // Retry failed requests up to 3 times
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    staleTime: 2000, // Consider data fresh for 2 seconds
  });

  const handleNavigate = () => {
    if (!selectable) {
      setLocation(`/trips/${trip.id}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Get initial for avatar fallback
  const getInitial = (participant: { userId: number | null; name?: string }) => {
    if (participant?.name) {
      return participant.name[0].toUpperCase();
    }
    return '?';
  };

  return (
    <Card className={cn(
      "overflow-hidden",
      selectable && "cursor-pointer hover:border-primary/50",
      selected && "border-primary"
    )}>
      <div
        className="relative h-48 cursor-pointer"
        onClick={selectable ? () => onSelect?.(trip.id) : handleNavigate}
      >
        <img
          src={thumbnail}
          alt={trip.title}
          className="w-full h-full object-cover"
        />
        {selected && (
          <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
            <Check className="h-4 w-4" />
          </div>
        )}
      </div>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div
            className="cursor-pointer"
            onClick={selectable ? () => onSelect?.(trip.id) : handleNavigate}
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
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => onDelete(trip.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <ShareTripDialog tripId={trip.id} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isEditingImage ? (
          <div className="space-y-4">
            <ImageUpload
              tripId={trip.id}
              currentImage={thumbnail}
              onSuccess={() => setIsEditingImage(false)}
            />
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setIsEditingImage(false)}
            >
              Done
            </Button>
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
            {participants && participants.length > 0 && !isError && (
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <HoverCard>
                  <HoverCardTrigger asChild>
                    <div className="flex -space-x-2 cursor-help">
                      {participants.slice(0, 3).map((participant, i) => (
                        <Avatar key={i} className="h-6 w-6 border-2 border-background">
                          <AvatarFallback>
                            {getInitial(participant)}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                      {participants.length > 3 && (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-muted text-xs">
                          +{participants.length - 3}
                        </div>
                      )}
                    </div>
                  </HoverCardTrigger>
                  <HoverCardContent className="w-64">
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold">Trip Participants</h4>
                      <div className="space-y-1">
                        {participants.sort((a, b) => {
                          const nameA = a.name || 'Unknown';
                          const nameB = b.name || 'Unknown';
                          return nameA.localeCompare(nameB);
                        }).map((participant, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback>{getInitial(participant)}</AvatarFallback>
                            </Avatar>
                            <span className="text-sm">{participant.name || 'Unknown'}</span>
                            <span className={cn(
                              "text-xs ml-auto",
                              {
                                "text-green-500": participant.status === 'yes',
                                "text-red-500": participant.status === 'no',
                                "text-muted-foreground": participant.status === 'pending'
                              }
                            )}>
                              {participant.status === 'yes' && 'Confirmed'}
                              {participant.status === 'no' && 'Declined'}
                              {participant.status === 'pending' && 'Pending'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </HoverCardContent>
                </HoverCard>
              </div>
            )}
          </div>
        )}
      </CardContent>
      {!selectable && (
        <CardFooter>
          <Button
            variant="outline"
            className="w-full"
            onClick={handleNavigate}
          >
            View Details
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}