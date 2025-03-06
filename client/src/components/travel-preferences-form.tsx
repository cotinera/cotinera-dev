import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

// Define form schema using zod
const travelPreferencesSchema = z.object({
  preferredActivities: z.array(z.string()),
  interests: z.array(z.string()),
  budgetRange: z.object({
    min: z.number(),
    max: z.number(),
    currency: z.string(),
  }),
  preferredAccommodations: z.array(z.string()),
  preferredClimate: z.array(z.string()),
  travelStyle: z.array(z.string()),
  tripDuration: z.object({
    min: z.number(),
    max: z.number(),
  }),
  travelPace: z.string(),
  mustHaveAmenities: z.array(z.string()),
  transportationPreferences: z.array(z.string()),
  specialInterests: z.array(z.string()),
  languagesSpoken: z.array(z.string()),
  travelCompanions: z.array(z.string()),
  photoOpportunities: z.boolean(),
  localExperiences: z.boolean(),
  guidedTours: z.boolean(),
  adventureLevel: z.number(),
  partyingLevel: z.number(),
  relaxationLevel: z.number(),
  culturalImmersionLevel: z.number(),
  seasonalPreferences: z.array(z.string()),
});

type FormData = z.infer<typeof travelPreferencesSchema>;

// Constants for form options
const ACTIVITY_OPTIONS = [
  "Sightseeing", "Museums", "Shopping", "Food & Dining",
  "Nightlife", "Adventure Sports", "Beach Activities", "Cultural Events",
  "Nature Walks", "Historical Sites"
];

const INTEREST_OPTIONS = [
  "Art & Culture", "History", "Nature", "Food & Wine",
  "Adventure", "Relaxation", "Photography", "Architecture",
  "Local Experiences", "Wildlife"
];

const ACCOMMODATION_OPTIONS = [
  "Hotels", "Hostels", "Resorts", "Vacation Rentals",
  "Boutique Hotels", "Camping", "B&Bs"
];

const CLIMATE_OPTIONS = [
  "Tropical", "Mediterranean", "Desert", "Alpine",
  "Temperate", "Coastal", "Mountain"
];

const TRAVEL_STYLE_OPTIONS = [
  "Luxury", "Budget", "Mid-Range", "Backpacking",
  "Group Tours", "Solo Travel", "Family-Friendly"
];

const TRAVEL_PACE_OPTIONS = [
  "Slow", "Moderate", "Fast"
];

const AMENITY_OPTIONS = [
  "Wi-Fi", "Air Conditioning", "Pool", "Gym",
  "Restaurant", "Room Service", "Spa", "Business Center"
];

const TRANSPORTATION_OPTIONS = [
  "Public Transit", "Rental Car", "Walking", "Biking",
  "Rideshare", "Private Driver", "Train"
];

const SEASON_OPTIONS = [
  "Spring", "Summer", "Fall", "Winter",
  "Dry Season", "Rainy Season"
];

const LANGUAGE_OPTIONS = [
  "English", "Spanish", "French", "German",
  "Italian", "Mandarin", "Japanese", "Arabic"
];

const COMPANION_OPTIONS = [
  "Solo", "Couple", "Family", "Friends",
  "Group", "Business"
];

export function TravelPreferencesForm() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(travelPreferencesSchema),
    defaultValues: {
      preferredActivities: [],
      interests: [],
      budgetRange: {
        min: 0,
        max: 5000,
        currency: "USD"
      },
      preferredAccommodations: [],
      preferredClimate: [],
      travelStyle: [],
      tripDuration: {
        min: 1,
        max: 14
      },
      travelPace: "Moderate",
      mustHaveAmenities: [],
      transportationPreferences: [],
      specialInterests: [],
      languagesSpoken: [],
      travelCompanions: [],
      photoOpportunities: true,
      localExperiences: true,
      guidedTours: false,
      adventureLevel: 3,
      partyingLevel: 3,
      relaxationLevel: 3,
      culturalImmersionLevel: 3,
      seasonalPreferences: [],
    }
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const response = await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          preferences: {
            travelPreferences: data
          }
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update preferences');
      }

      await queryClient.invalidateQueries({ queryKey: ['/api/user'] });

      toast({
        title: "Success",
        description: "Your travel preferences have been updated. We'll start generating personalized recommendations for you.",
      });

      // Trigger initial recommendations generation
      await fetch('/api/recommendations/generate', {
        method: 'POST',
      });

    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update travel preferences",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {/* Basic Preferences */}
          <FormField
            control={form.control}
            name="preferredActivities"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Preferred Activities</FormLabel>
                <FormDescription>
                  Select the types of activities you enjoy while traveling
                </FormDescription>
                <FormControl>
                  <Select
                    value={field.value}
                    onValueChange={(value) => field.onChange(value.split(','))}
                    multiple
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select activities" />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTIVITY_OPTIONS.map((activity) => (
                        <SelectItem key={activity} value={activity}>
                          {activity}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Travel Style */}
          <FormField
            control={form.control}
            name="travelStyle"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Travel Style</FormLabel>
                <FormDescription>
                  How do you prefer to travel?
                </FormDescription>
                <FormControl>
                  <Select
                    value={field.value}
                    onValueChange={(value) => field.onChange(value.split(','))}
                    multiple
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select travel styles" />
                    </SelectTrigger>
                    <SelectContent>
                      {TRAVEL_STYLE_OPTIONS.map((style) => (
                        <SelectItem key={style} value={style}>
                          {style}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Travel Pace */}
          <FormField
            control={form.control}
            name="travelPace"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Travel Pace</FormLabel>
                <FormDescription>
                  How quickly do you like to move through destinations?
                </FormDescription>
                <FormControl>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select pace" />
                    </SelectTrigger>
                    <SelectContent>
                      {TRAVEL_PACE_OPTIONS.map((pace) => (
                        <SelectItem key={pace} value={pace}>
                          {pace}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Experience Levels */}
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="adventureLevel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Adventure Level</FormLabel>
                  <FormDescription>
                    How adventurous do you want your trip to be? (1-5)
                  </FormDescription>
                  <FormControl>
                    <Slider
                      value={[field.value]}
                      onValueChange={(values) => field.onChange(values[0])}
                      min={1}
                      max={5}
                      step={1}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="culturalImmersionLevel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cultural Immersion</FormLabel>
                  <FormDescription>
                    How deeply do you want to experience local culture? (1-5)
                  </FormDescription>
                  <FormControl>
                    <Slider
                      value={[field.value]}
                      onValueChange={(values) => field.onChange(values[0])}
                      min={1}
                      max={5}
                      step={1}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Additional Preferences */}
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="photoOpportunities"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between">
                  <div>
                    <FormLabel>Photo Opportunities</FormLabel>
                    <FormDescription>
                      Prioritize scenic spots and photo opportunities
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="localExperiences"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between">
                  <div>
                    <FormLabel>Local Experiences</FormLabel>
                    <FormDescription>
                      Prioritize authentic local experiences
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Button type="submit" disabled={loading}>
            {loading ? "Saving..." : "Save Preferences"}
          </Button>
        </form>
      </Form>
    </Card>
  );
}