import { TravelPreferencesForm } from "@/components/travel-preferences-form";
import { TravelRecommendations } from "@/components/travel-recommendations";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function TravelPreferencesPage() {
  return (
    <div className="container mx-auto py-8 space-y-8">
      <h1 className="text-3xl font-semibold">Travel Preferences & Recommendations</h1>
      
      <Tabs defaultValue="preferences">
        <TabsList>
          <TabsTrigger value="preferences">My Travel Preferences</TabsTrigger>
          <TabsTrigger value="recommendations">Personalized Recommendations</TabsTrigger>
        </TabsList>
        
        <TabsContent value="preferences">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Set Your Travel Preferences</h2>
            <p className="text-muted-foreground mb-6">
              Tell us about your travel style and preferences to get personalized recommendations
              for your next adventure.
            </p>
            <TravelPreferencesForm />
          </Card>
        </TabsContent>
        
        <TabsContent value="recommendations">
          <TravelRecommendations />
        </TabsContent>
      </Tabs>
    </div>
  );
}
