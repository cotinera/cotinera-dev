import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Trip, Participant, Flight, Accommodation, User } from "@db/schema";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { CalendarDays, Hotel, Plane, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TripParticipantDetailsProps {
  tripId: number;
}

type BookingStatus = "yes" | "no" | "pending";

interface ParticipantDetails extends Participant {
  user: User;
  flights?: Flight[];
  accommodation?: Accommodation;
  flightStatus: BookingStatus;
  hotelStatus: BookingStatus;
}

export function TripParticipantDetails({ tripId }: TripParticipantDetailsProps) {
  const queryClient = useQueryClient();
  const [selectedParticipant, setSelectedParticipant] = useState<ParticipantDetails | null>(null);

  // Fetch participants with their travel details
  const { data: participants = [], isLoading } = useQuery<ParticipantDetails[]>({
    queryKey: [`/api/trips/${tripId}/participants`],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripId}/participants`);
      if (!res.ok) throw new Error("Failed to fetch participants");
      return res.json();
    },
  });

  const updateBookingStatus = async (
    participantId: number,
    type: "flight" | "hotel",
    status: BookingStatus
  ) => {
    try {
      const res = await fetch(`/api/trips/${tripId}/participants/${participantId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, status }),
      });

      if (!res.ok) throw new Error(`Failed to update ${type} status`);

      // Invalidate participants query to refresh the data
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/participants`] });
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Trip Details</CardTitle>
            <CardDescription>Manage participant travel arrangements</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><Users className="h-4 w-4" /> Participant</TableHead>
              <TableHead><CalendarDays className="h-4 w-4" /> Dates</TableHead>
              <TableHead><Hotel className="h-4 w-4" /> Accommodation</TableHead>
              <TableHead><Plane className="h-4 w-4" /> Flight</TableHead>
              <TableHead>Booking Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {participants.map((participant) => (
              <TableRow key={participant.id}>
                <TableCell className="font-medium">
                  {participant.user.name}
                </TableCell>
                <TableCell>
                  {participant.arrivalDate && participant.departureDate ? (
                    <span>
                      {format(new Date(participant.arrivalDate), "MMM d")} -{" "}
                      {format(new Date(participant.departureDate), "MMM d, yyyy")}
                    </span>
                  ) : (
                    <Badge variant="outline">Dates not set</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {participant.accommodation ? (
                    <span>{participant.accommodation.name}</span>
                  ) : (
                    <Badge variant="outline">Not booked</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {participant.flights?.length ? (
                    <div className="flex flex-col gap-1">
                      {participant.flights.map((flight) => (
                        <div key={flight.id} className="text-sm">
                          {flight.airline} {flight.flightNumber}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Badge variant="outline">Not booked</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Select
                      value={participant.flightStatus}
                      onValueChange={(value: BookingStatus) =>
                        updateBookingStatus(participant.id, "flight", value)
                      }
                    >
                      <SelectTrigger className="w-[100px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Flight ✓</SelectItem>
                        <SelectItem value="no">Flight ✗</SelectItem>
                        <SelectItem value="pending">Flight ?</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={participant.hotelStatus}
                      onValueChange={(value: BookingStatus) =>
                        updateBookingStatus(participant.id, "hotel", value)
                      }
                    >
                      <SelectTrigger className="w-[100px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Hotel ✓</SelectItem>
                        <SelectItem value="no">Hotel ✗</SelectItem>
                        <SelectItem value="pending">Hotel ?</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
