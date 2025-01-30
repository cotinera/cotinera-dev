import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Accommodation } from "@db/schema";
import { useToast } from "@/hooks/use-toast";

export function useAccommodations(tripId: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: accommodations = [], isLoading } = useQuery<Accommodation[]>({
    queryKey: [`/api/trips/${tripId}/accommodations`],
    enabled: !!tripId,
  });

  const createAccommodation = useMutation({
    mutationFn: async (accommodationData: Partial<Accommodation>) => {
      const res = await fetch(`/api/trips/${tripId}/accommodations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(accommodationData),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/trips/${tripId}/accommodations`],
      });
      toast({
        title: "Success",
        description: "Accommodation added successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to add accommodation",
      });
    },
  });

  const updateAccommodation = useMutation({
    mutationFn: async ({ id, ...accommodationData }: Partial<Accommodation> & { id: number }) => {
      const res = await fetch(`/api/trips/${tripId}/accommodations/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(accommodationData),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/trips/${tripId}/accommodations`],
      });
      toast({
        title: "Success",
        description: "Accommodation updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update accommodation",
      });
    },
  });

  return {
    accommodations,
    isLoading,
    createAccommodation: createAccommodation.mutateAsync,
    updateAccommodation: updateAccommodation.mutateAsync,
  };
}
