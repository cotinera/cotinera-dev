import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MapPin, Calendar, DollarSign } from "lucide-react";
import type { TravelRecommendation } from "@db/schema";

interface TravelRecommendationsProps {
  tripId?: number;
  location?: string;
  startDate?: string;
  endDate?: string;
}

export function TravelRecommendations({
  tripId,
  location,
  startDate,
  endDate,
}: TravelRecommendationsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: recommendations, isLoading } = useQuery<TravelRecommendation[]>({
    queryKey: ['/api/recommendations', tripId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (tripId) params.append('tripId', tripId.toString());
      if (location) params.append('location', location);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await fetch(`/api/recommendations?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch recommendations');
      return response.json();
    },
    enabled: Boolean(tripId || location),
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/recommendations/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tripId,
          location,
          startDate,
          endDate,
        }),
      });
      
      if (!response.ok) throw new Error('Failed to generate recommendations');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recommendations', tripId] });
      toast({
        title: "Success",
        description: "New travel recommendations have been generated",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate recommendations",
      });
    },
  });

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold tracking-tight">
          Travel Recommendations
        </h2>
        <Button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
        >
          {generateMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            "Generate New Recommendations"
          )}
        </Button>
      </div>

      {recommendations?.length === 0 && (
        <Card className="p-6">
          <p className="text-center text-muted-foreground">
            No recommendations available. Click the button above to generate some!
          </p>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {recommendations?.map((recommendation) => (
          <Card key={recommendation.id} className="overflow-hidden">
            <div className="p-6">
              <h3 className="font-semibold text-lg mb-2">
                {recommendation.destinationName}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {recommendation.description}
              </p>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span>Activities: {recommendation.activities.join(", ")}</span>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span>
                    Recommended Duration: {recommendation.recommendedDuration} days
                  </span>
                </div>

                {recommendation.estimatedBudget && (
                  <div className="flex items-center gap-2 text-sm">
                    <DollarSign className="h-4 w-4 text-primary" />
                    <span>
                      Estimated Budget: {recommendation.estimatedBudget} {recommendation.currency}
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t">
                <div className="flex flex-wrap gap-2">
                  {recommendation.interests.map((interest, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                    >
                      {interest}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
