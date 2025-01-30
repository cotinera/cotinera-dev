import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Flight } from "@db/schema";
import { useToast } from "@/hooks/use-toast";

export function useFlights(tripId: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: flights = [], isLoading } = useQuery<Flight[]>({
    queryKey: [`/api/trips/${tripId}/flights`],
    enabled: !!tripId,
  });

  const createFlight = useMutation({
    mutationFn: async (flightData: Partial<Flight>) => {
      const res = await fetch(`/api/trips/${tripId}/flights`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(flightData),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/trips/${tripId}/flights`],
      });
      toast({
        title: "Success",
        description: "Flight added successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to add flight",
      });
    },
  });

  const updateFlight = useMutation({
    mutationFn: async ({ id, ...flightData }: Partial<Flight> & { id: number }) => {
      const res = await fetch(`/api/trips/${tripId}/flights/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(flightData),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/trips/${tripId}/flights`],
      });
      toast({
        title: "Success",
        description: "Flight updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update flight",
      });
    },
  });

  return {
    flights,
    isLoading,
    createFlight: createFlight.mutateAsync,
    updateFlight: updateFlight.mutateAsync,
  };
}
