import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { TripCard } from "@/components/trip-card";
import { CalendarView } from "@/components/calendar-view";
import { Checklist } from "@/components/checklist";
import { Loader2, AlertCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function SharedTrip() {
  const [, params] = useRoute("/share/:token");
  const token = params?.token;

  const { data, isLoading, error } = useQuery({
    queryKey: [`/api/share/${token}`],
    enabled: !!token,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6">
            <div className="flex mb-4 gap-2">
              <AlertCircle className="h-8 w-8 text-red-500" />
              <h1 className="text-2xl font-bold text-gray-900">
                Share Link Invalid
              </h1>
            </div>
            <p className="mt-4 text-sm text-gray-600">
              This share link may have expired or been revoked.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { trip, accessLevel } = data;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Shared Trip Details</h1>
          {accessLevel === "edit" && (
            <Button variant="outline">Edit Mode</Button>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <TripCard trip={trip} />
          </div>
        </div>

        <div className="mt-8">
          <CalendarView trips={[trip]} />
        </div>

        <div className="mt-8">
          <Checklist tripId={trip.id} />
        </div>
      </main>
    </div>
  );
}
