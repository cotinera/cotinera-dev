import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ShareLink } from "@db/schema";
import { useToast } from "@/hooks/use-toast";

export function useShareLinks(tripId: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createShareLink = useMutation({
    mutationFn: async ({
      expiresInDays,
      accessLevel,
    }: {
      expiresInDays?: number;
      accessLevel?: "view" | "edit";
    }) => {
      const res = await fetch(`/api/trips/${tripId}/share`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ expiresInDays, accessLevel }),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json() as Promise<ShareLink>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/trips/${tripId}/share`],
      });
      toast({
        title: "Success",
        description: "Share link created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create share link",
      });
    },
  });

  const revokeShareLink = useMutation({
    mutationFn: async (linkId: number) => {
      const res = await fetch(`/api/trips/${tripId}/share/${linkId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/trips/${tripId}/share`],
      });
      toast({
        title: "Success",
        description: "Share link revoked successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to revoke share link",
      });
    },
  });

  return {
    createShareLink: createShareLink.mutateAsync,
    revokeShareLink: revokeShareLink.mutateAsync,
  };
}
