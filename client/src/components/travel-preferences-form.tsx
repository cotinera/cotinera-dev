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
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface TravelPreferences {
  preferredActivities: string[];
  interests: string[];
  budgetRange: {
    min: number;
    max: number;
    currency: string;
  };
  preferredAccommodations: string[];
  dietaryRestrictions: string[];
  accessibility: string[];
  travelStyle: string[];
  preferredClimate: string[];
  tripDuration: {
    min: number;
    max: number;
  };
}

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

export function TravelPreferencesForm() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const form = useForm<TravelPreferences>({
    defaultValues: {
      preferredActivities: [],
      interests: [],
      budgetRange: {
        min: 0,
        max: 5000,
        currency: "USD"
      },
      preferredAccommodations: [],
      dietaryRestrictions: [],
      accessibility: [],
      travelStyle: [],
      preferredClimate: [],
      tripDuration: {
        min: 1,
        max: 14
      }
    }
  });

  const onSubmit = async (data: TravelPreferences) => {
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
        description: "Your travel preferences have been updated",
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
                    onValueChange={field.onChange}
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

          <FormField
            control={form.control}
            name="interests"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Interests</FormLabel>
                <FormDescription>
                  Select your travel interests
                </FormDescription>
                <FormControl>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    multiple
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select interests" />
                    </SelectTrigger>
                    <SelectContent>
                      {INTEREST_OPTIONS.map((interest) => (
                        <SelectItem key={interest} value={interest}>
                          {interest}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-4">
            <FormLabel>Budget Range (USD)</FormLabel>
            <FormDescription>
              Set your preferred budget range for trips
            </FormDescription>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="budgetRange.min"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Min budget"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="budgetRange.max"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Max budget"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </div>

          <FormField
            control={form.control}
            name="preferredAccommodations"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Preferred Accommodations</FormLabel>
                <FormDescription>
                  Select your preferred types of accommodation
                </FormDescription>
                <FormControl>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    multiple
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select accommodations" />
                    </SelectTrigger>
                    <SelectContent>
                      {ACCOMMODATION_OPTIONS.map((accommodation) => (
                        <SelectItem key={accommodation} value={accommodation}>
                          {accommodation}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="preferredClimate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Preferred Climate</FormLabel>
                <FormDescription>
                  Select your preferred climate types
                </FormDescription>
                <FormControl>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    multiple
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select climate preferences" />
                    </SelectTrigger>
                    <SelectContent>
                      {CLIMATE_OPTIONS.map((climate) => (
                        <SelectItem key={climate} value={climate}>
                          {climate}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="travelStyle"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Travel Style</FormLabel>
                <FormDescription>
                  Select your preferred travel styles
                </FormDescription>
                <FormControl>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
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

          <div className="space-y-4">
            <FormLabel>Trip Duration (Days)</FormLabel>
            <FormDescription>
              Set your preferred trip duration range
            </FormDescription>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tripDuration.min"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Min days"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tripDuration.max"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Max days"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </div>

          <Button type="submit" disabled={loading}>
            {loading ? "Saving..." : "Save Preferences"}
          </Button>
        </form>
      </Form>
    </Card>
  );
}
