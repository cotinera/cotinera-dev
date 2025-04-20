import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Trip } from "@db/schema";

export function useTrips() {
  const queryClient = useQueryClient();

  // Check if in development bypass mode
  const isDevelopmentBypass = localStorage.getItem("dev_bypass_auth") === "true";
  
  // Use different query key based on auth mode
  const queryKey = isDevelopmentBypass ? ["/api/trips"] : ["/api/my-trips"];
  
  const { data: trips = [], isLoading } = useQuery<Trip[]>({
    queryKey,
    queryFn: async () => {
      try {
        // In dev bypass mode, use the /api/trips endpoint directly
        if (isDevelopmentBypass) {
          console.log("Using development bypass mode for trips");
          const devRes = await fetch(`/api/trips`, {
            credentials: "include"
          });
          
          if (devRes.ok) {
            return devRes.json();
          }
        } else {
          // Normal authenticated flow with /api/my-trips
          const res = await fetch(`/api/my-trips`, {
            credentials: "include",
          });
          
          if (res.ok) {
            return res.json();
          }
        }
        
        throw new Error("Failed to fetch trips");
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
      // Invalidate the correct query key based on auth mode
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    trips,
    isLoading,
    createTrip: createTrip.mutateAsync,
  };
}
