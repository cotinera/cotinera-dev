import { useState, useCallback } from "react";
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
  preferredActivities: z.array(z.string()).default([]),
  interests: z.array(z.string()).default([]),
  budgetRange: z.object({
    min: z.number().default(0),
    max: z.number().default(5000),
    currency: z.string().default("USD"),
  }),
  preferredAccommodations: z.array(z.string()).default([]),
  preferredClimate: z.array(z.string()).default([]),
  travelStyle: z.array(z.string()).default([]),
  tripDuration: z.object({
    min: z.number().default(1),
    max: z.number().default(14),
  }),
  travelPace: z.string().default("Moderate"),
  mustHaveAmenities: z.array(z.string()).default([]),
  transportationPreferences: z.array(z.string()).default([]),
  specialInterests: z.array(z.string()).default([]),
  languagesSpoken: z.array(z.string()).default([]),
  travelCompanions: z.array(z.string()).default([]),
  photoOpportunities: z.boolean().default(true),
  localExperiences: z.boolean().default(true),
  guidedTours: z.boolean().default(false),
  adventureLevel: z.number().default(3),
  partyingLevel: z.number().default(3),
  relaxationLevel: z.number().default(3),
  culturalImmersionLevel: z.number().default(3),
  seasonalPreferences: z.array(z.string()).default([]),
});

type FormData = z.infer<typeof travelPreferencesSchema>;

// Constants moved to external objects to prevent re-creation on render
const FORM_OPTIONS = {
  ACTIVITIES: [
    "Sightseeing", "Museums", "Shopping", "Food & Dining",
    "Nightlife", "Adventure Sports", "Beach Activities", "Cultural Events",
    "Nature Walks", "Historical Sites"
  ],
  INTERESTS: [
    "Art & Culture", "History", "Nature", "Food & Wine",
    "Adventure", "Relaxation", "Photography", "Architecture",
    "Local Experiences", "Wildlife"
  ],
  ACCOMMODATIONS: [
    "Hotels", "Hostels", "Resorts", "Vacation Rentals",
    "Boutique Hotels", "Camping", "B&Bs"
  ],
  CLIMATES: [
    "Tropical", "Mediterranean", "Desert", "Alpine",
    "Temperate", "Coastal", "Mountain"
  ],
  TRAVEL_STYLES: [
    "Luxury", "Budget", "Mid-Range", "Backpacking",
    "Group Tours", "Solo Travel", "Family-Friendly"
  ],
  TRAVEL_PACES: ["Slow", "Moderate", "Fast"],
  AMENITIES: [
    "Wi-Fi", "Air Conditioning", "Pool", "Gym",
    "Restaurant", "Room Service", "Spa", "Business Center"
  ],
  TRANSPORTATION: [
    "Public Transit", "Rental Car", "Walking", "Biking",
    "Rideshare", "Private Driver", "Train"
  ],
  SEASONS: [
    "Spring", "Summer", "Fall", "Winter",
    "Dry Season", "Rainy Season"
  ],
  LANGUAGES: [
    "English", "Spanish", "French", "German",
    "Italian", "Mandarin", "Japanese", "Arabic"
  ],
  COMPANIONS: [
    "Solo", "Couple", "Family", "Friends",
    "Group", "Business"
  ],
} as const;

export function TravelPreferencesForm({ onClose }: { onClose?: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(travelPreferencesSchema),
    defaultValues: travelPreferencesSchema.parse({}),
  });

  const onSubmit = useCallback(async (data: FormData) => {
    setLoading(true);
    try {
      const response = await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
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
        credentials: 'include',
      });

      if (onClose) {
        onClose();
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update travel preferences",
      });
    } finally {
      setLoading(false);
    }
  }, [toast, queryClient, onClose]);

  // Memoized handlers for multi-select fields
  const handleMultiSelect = useCallback((field: any, onChange: (value: string[]) => void) => {
    return (value: string) => {
      const currentValues = field.value || [];
      const newValues = currentValues.includes(value)
        ? currentValues.filter((v: string) => v !== value)
        : [...currentValues, value];
      onChange(newValues);
    };
  }, []);

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
                    onValueChange={handleMultiSelect(field, field.onChange)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select activities" />
                    </SelectTrigger>
                    <SelectContent>
                      {FORM_OPTIONS.ACTIVITIES.map((activity) => (
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
                    onValueChange={handleMultiSelect(field, field.onChange)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select travel styles" />
                    </SelectTrigger>
                    <SelectContent>
                      {FORM_OPTIONS.TRAVEL_STYLES.map((style) => (
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