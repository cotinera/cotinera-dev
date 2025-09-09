import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ViewToggle } from "@/components/view-toggle";
import { TripHeaderEdit } from "@/components/trip-header-edit";
import { BudgetTracker } from "@/components/budget-tracker";
import { Loader2, ArrowLeft, Wallet, DollarSign } from "lucide-react";
import type { Trip } from "@db/schema";

export default function TripSpending() {
  const [, params] = useRoute("/trips/:id/spending");
  const tripId = params ? parseInt(params.id) : null;
  const [, setLocation] = useLocation();

  const { data: trip, isLoading, error } = useQuery<Trip>({
    queryKey: ["/api/trips", tripId],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripId}`);
      if (!res.ok) {
        throw new Error("Failed to fetch trip");
      }
      return res.json();
    },
    enabled: !!tripId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-adventure">
        <div className="text-center text-white">
          <Wallet className="h-16 w-16 mx-auto mb-4 animate-pulse drop-shadow-lg" />
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 drop-shadow-lg" />
          <p className="text-lg font-medium drop-shadow-md">Loading your budget...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-sunset">
        <div className="text-center text-white max-w-md mx-4">
          <div className="bg-white/10 backdrop-blur rounded-lg p-8 shadow-hero">
            <Wallet className="h-16 w-16 mx-auto mb-4 drop-shadow-lg" />
            <h1 className="text-2xl font-bold mb-4">Unable to Load Budget</h1>
            <p className="text-white/90 mb-4">{(error as Error).message}</p>
            <Button 
              onClick={() => setLocation("/")}
              variant="secondary"
              className="bg-white text-primary hover:bg-white/90"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-ocean">
        <div className="text-center text-white max-w-md mx-4">
          <div className="bg-white/10 backdrop-blur rounded-lg p-8 shadow-hero">
            <Wallet className="h-16 w-16 mx-auto mb-4 drop-shadow-lg" />
            <h1 className="text-2xl font-bold mb-4">Trip Not Found</h1>
            <p className="text-white/90 mb-6">The trip you're looking for doesn't exist or you don't have access to it.</p>
            <Button 
              onClick={() => setLocation("/")}
              variant="secondary"
              className="bg-white text-primary hover:bg-white/90"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 shadow-soft">
        <div className="relative overflow-hidden py-12">
          {trip.thumbnail && (
            <div 
              className="absolute inset-0 bg-cover bg-center"
              style={{ 
                backgroundImage: `url(${trip.thumbnail})`,
                filter: "blur(20px)",
                transform: "scale(1.2)",
                opacity: "0.7",
              }} 
            />
          )}
          <div className="absolute inset-0 bg-gradient-adventure opacity-80" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/40" />
          
          <div className="container mx-auto px-6 relative z-10">
            <Button
              variant="ghost"
              onClick={() => setLocation("/")}
              className="absolute left-6 top-4 text-white hover:bg-white/20 border border-white/20 backdrop-blur-sm transition-all duration-300"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>

            <div className="pt-16">
              <TripHeaderEdit 
                trip={trip} 
                onBack={() => setLocation("/")} 
              />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12">
        <Card className="bg-card/50 border-border/50 shadow-soft backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-adventure text-white shadow-soft">
                <DollarSign className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-2xl bg-gradient-adventure bg-clip-text text-transparent">
                  Trip Budget & Expenses
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Track expenses and manage your trip budget
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <BudgetTracker tripId={trip.id} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}