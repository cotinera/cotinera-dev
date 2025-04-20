import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Trip } from "@db/schema";

export function useTrips() {
  const queryClient = useQueryClient();

  const { data: trips = [], isLoading } = useQuery<Trip[]>({
    queryKey: ["/api/my-trips"],
    queryFn: async () => {
      try {
        const res = await fetch(`/api/my-trips`, {
          credentials: "include",
        });
        
        if (!res.ok) {
          // Special handling for dev bypass mode
          const isDevelopmentBypass = localStorage.getItem("dev_bypass_auth") === "true";
          if (isDevelopmentBypass) {
            // Fetch trips without auth in development mode
            const devRes = await fetch(`/api/trips`, {
              credentials: "include",
            });
            
            if (devRes.ok) {
              return devRes.json();
            }
          }
          
          throw new Error("Failed to fetch trips");
        }
        
        return res.json();
      } catch (error) {
        console.error("Error fetching trips:", error);
        throw error;
      }
    },
  });

  const createTrip = useMutation({
    mutationFn: async (tripData: Partial<Trip>) => {
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(tripData),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-trips"] });
    },
  });

  return {
    trips,
    isLoading,
    createTrip: createTrip.mutateAsync,
  };
}
