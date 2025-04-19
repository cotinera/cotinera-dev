import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { 
  CalendarIcon, 
  ClockIcon, 
  MapPinIcon, 
  UserIcon, 
  TagIcon,
  ChevronDownIcon,
  XIcon
} from "lucide-react";

// Helper function to safely display date
function getDateDisplay(date: unknown): string {
  if (date && typeof date === 'object' && date instanceof Date) {
    try {
      return format(date, "EEEE, dd MMMM");
    } catch (error) {
      return "Date selected";
    }
  }
  return "Date selected";
}

// Format date in short format
function getShortDateDisplay(date: unknown): string {
  if (date && typeof date === 'object' && date instanceof Date) {
    try {
      return format(date, "EEE, dd MMM");
    } catch (error) {
      return "Date selected";
    }
  }
  return "Date selected";
}

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LocationSearchBar } from "./location-search-bar";
import { cn } from "@/lib/utils";

// Define the TripIdea schema for form validation
const tripIdeaSchema = z.object({
  title: z.string().min(2, { message: "Title is required" }),
  description: z.string().optional(),
  status: z.enum(["pending", "booked", "unsure"]).default("pending"),
  location: z.string().optional(),
  ownerId: z.number().optional(),
  plannedDate: z.date().optional(),
  plannedTime: z.string().optional(), // Store time as HH:MM format
});

type ExpandableTripIdeaFormProps = {
  tripId: number;
  participants: Array<{
    id: number;
    name: string;
    userId: number;
    avatar?: string;
  }>;
  onSubmit: (data: z.infer<typeof tripIdeaSchema>) => void;
  onCancel: () => void;
  isPending: boolean;
  initialValues?: Partial<z.infer<typeof tripIdeaSchema>>;
};

export function ExpandableTripIdeaForm({
  tripId,
  participants,
  onSubmit,
  onCancel,
  isPending,
  initialValues
}: ExpandableTripIdeaFormProps) {
  const [expandedSections, setExpandedSections] = useState<{
    datetime: boolean;
    location: boolean;
    assign: boolean;
    status: boolean;
    description: boolean;
  }>({
    datetime: false,
    location: false,
    assign: false,
    status: false,
    description: false
  });

  const formRef = useRef<HTMLFormElement>(null);

  const form = useForm<z.infer<typeof tripIdeaSchema>>({
    resolver: zodResolver(tripIdeaSchema),
    defaultValues: {
      title: initialValues?.title || "",
      description: initialValues?.description || "",
      status: initialValues?.status || "pending",
      location: initialValues?.location || "",
      ownerId: initialValues?.ownerId,
      plannedDate: initialValues?.plannedDate,
      plannedTime: initialValues?.plannedTime || ""
    },
  });

  // Handle outside click to collapse sections
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (formRef.current && !formRef.current.contains(e.target as Node)) {
        // Don't close everything on outside click, user might be selecting a date, etc.
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Toggle section expansion
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleSubmit = (data: z.infer<typeof tripIdeaSchema>) => {
    onSubmit(data);
  };

  return (
    <div className="p-0 max-w-xl mx-auto">
      <form 
        ref={formRef}
        onSubmit={form.handleSubmit(handleSubmit)}
        className="space-y-0 bg-white rounded-lg overflow-hidden border"
      >
        <div className="p-4 pb-2">
          <Input
            placeholder="Add title"
            {...form.register("title")}
            className="text-xl border-none focus-visible:ring-0 focus-visible:ring-offset-0 px-0 font-medium"
          />
          {form.formState.errors.title && (
            <p className="text-sm font-medium text-destructive mt-1">
              {form.formState.errors.title.message}
            </p>
          )}

          <div className="divide-y">
            {/* Date & Time Section */}
            <div 
              className={cn(
                "transition-all hover:bg-slate-50/50",
                expandedSections.datetime ? "bg-slate-50/80" : ""
              )}
            >
              <div 
                className="flex items-center gap-2 cursor-pointer px-4 py-3" 
                onClick={() => toggleSection("datetime")}
              >
                <CalendarIcon className="h-5 w-5 text-primary/70" />
                <div className="flex-1">
                  {form.watch("plannedDate") ? (
                    <span className="text-sm">
                      {getDateDisplay(form.watch("plannedDate"))}
                      {form.watch("plannedTime") ? ` · ${form.watch("plannedTime")}` : ""}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">Add date & time</span>
                  )}
                </div>
                <ChevronDownIcon className={cn(
                  "h-4 w-4 transition-transform text-muted-foreground",
                  expandedSections.datetime ? "rotate-180" : ""
                )} />
              </div>
              
              {expandedSections.datetime && (
                <div className="px-4 pb-3 pt-0">
                  <div className="grid grid-cols-12 gap-2 ml-7">
                    <div className="col-span-8">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "justify-start text-left w-full",
                              !form.watch("plannedDate") && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {form.watch("plannedDate") ? (
                              getShortDateDisplay(form.watch("plannedDate"))
                            ) : (
                              "Pick a date"
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={
                              typeof form.watch("plannedDate") === 'object' && 
                              form.watch("plannedDate") instanceof Date 
                                ? form.watch("plannedDate") as Date 
                                : undefined
                            }
                            onSelect={(date) => form.setValue("plannedDate", date)}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="col-span-4">
                      <Select 
                        value={form.watch("plannedTime") || "none"}
                        onValueChange={(value) => form.setValue("plannedTime", value === "none" ? "" : value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Time" />
                        </SelectTrigger>
                        <SelectContent>
                          <ScrollArea className="h-60">
                            <SelectItem value="none">No time</SelectItem>
                            <SelectItem value="00:00">12:00 AM</SelectItem>
                            <SelectItem value="00:30">12:30 AM</SelectItem>
                            <SelectItem value="01:00">1:00 AM</SelectItem>
                            <SelectItem value="01:30">1:30 AM</SelectItem>
                            <SelectItem value="02:00">2:00 AM</SelectItem>
                            <SelectItem value="02:30">2:30 AM</SelectItem>
                            <SelectItem value="03:00">3:00 AM</SelectItem>
                            <SelectItem value="03:30">3:30 AM</SelectItem>
                            <SelectItem value="04:00">4:00 AM</SelectItem>
                            <SelectItem value="04:30">4:30 AM</SelectItem>
                            <SelectItem value="05:00">5:00 AM</SelectItem>
                            <SelectItem value="05:30">5:30 AM</SelectItem>
                            <SelectItem value="06:00">6:00 AM</SelectItem>
                            <SelectItem value="06:30">6:30 AM</SelectItem>
                            <SelectItem value="07:00">7:00 AM</SelectItem>
                            <SelectItem value="07:30">7:30 AM</SelectItem>
                            <SelectItem value="08:00">8:00 AM</SelectItem>
                            <SelectItem value="08:30">8:30 AM</SelectItem>
                            <SelectItem value="09:00">9:00 AM</SelectItem>
                            <SelectItem value="09:30">9:30 AM</SelectItem>
                            <SelectItem value="10:00">10:00 AM</SelectItem>
                            <SelectItem value="10:30">10:30 AM</SelectItem>
                            <SelectItem value="11:00">11:00 AM</SelectItem>
                            <SelectItem value="11:30">11:30 AM</SelectItem>
                            <SelectItem value="12:00">12:00 PM</SelectItem>
                            <SelectItem value="12:30">12:30 PM</SelectItem>
                            <SelectItem value="13:00">1:00 PM</SelectItem>
                            <SelectItem value="13:30">1:30 PM</SelectItem>
                            <SelectItem value="14:00">2:00 PM</SelectItem>
                            <SelectItem value="14:30">2:30 PM</SelectItem>
                            <SelectItem value="15:00">3:00 PM</SelectItem>
                            <SelectItem value="15:30">3:30 PM</SelectItem>
                            <SelectItem value="16:00">4:00 PM</SelectItem>
                            <SelectItem value="16:30">4:30 PM</SelectItem>
                            <SelectItem value="17:00">5:00 PM</SelectItem>
                            <SelectItem value="17:30">5:30 PM</SelectItem>
                            <SelectItem value="18:00">6:00 PM</SelectItem>
                            <SelectItem value="18:30">6:30 PM</SelectItem>
                            <SelectItem value="19:00">7:00 PM</SelectItem>
                            <SelectItem value="19:30">7:30 PM</SelectItem>
                            <SelectItem value="20:00">8:00 PM</SelectItem>
                            <SelectItem value="20:30">8:30 PM</SelectItem>
                            <SelectItem value="21:00">9:00 PM</SelectItem>
                            <SelectItem value="21:30">9:30 PM</SelectItem>
                            <SelectItem value="22:00">10:00 PM</SelectItem>
                            <SelectItem value="22:30">10:30 PM</SelectItem>
                            <SelectItem value="23:00">11:00 PM</SelectItem>
                            <SelectItem value="23:30">11:30 PM</SelectItem>
                          </ScrollArea>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Location Section */}
            <div 
              className={cn(
                "transition-all hover:bg-slate-50/50",
                expandedSections.location ? "bg-slate-50/80" : ""
              )}
            >
              <div 
                className="flex items-center gap-2 cursor-pointer px-4 py-3" 
                onClick={() => toggleSection("location")}
              >
                <MapPinIcon className="h-5 w-5 text-primary/70" />
                <div className="flex-1">
                  {form.watch("location") ? (
                    <span className="text-sm line-clamp-1">{form.watch("location")}</span>
                  ) : (
                    <span className="text-sm text-muted-foreground">Add location</span>
                  )}
                </div>
                <ChevronDownIcon className={cn(
                  "h-4 w-4 transition-transform text-muted-foreground",
                  expandedSections.location ? "rotate-180" : ""
                )} />
              </div>
              
              {expandedSections.location && (
                <div className="px-4 pb-3 pt-0">
                  <div className="ml-7">
                    <LocationSearchBar
                      value={form.watch("location") || ""}
                      onChange={(address) => {
                        form.setValue("location", address || "");
                      }}
                      placeholder="Search for a location..."
                      className="w-full"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Assign To Section */}
            <div 
              className={cn(
                "transition-all hover:bg-slate-50/50",
                expandedSections.assign ? "bg-slate-50/80" : ""
              )}
            >
              <div 
                className="flex items-center gap-2 cursor-pointer px-4 py-3" 
                onClick={() => toggleSection("assign")}
              >
                <UserIcon className="h-5 w-5 text-primary/70" />
                <div className="flex-1">
                  {form.watch("ownerId") ? (
                    <span className="text-sm">
                      {participants.find(p => p.userId === form.watch("ownerId"))?.name || "Assigned"}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">Assign to someone</span>
                  )}
                </div>
                <ChevronDownIcon className={cn(
                  "h-4 w-4 transition-transform text-muted-foreground",
                  expandedSections.assign ? "rotate-180" : ""
                )} />
              </div>
              
              {expandedSections.assign && (
                <div className="px-4 pb-3 pt-0">
                  <div className="ml-7">
                    <Select
                      value={form.watch("ownerId")?.toString() || "none"}
                      onValueChange={(value) => form.setValue("ownerId", value && value !== "none" ? parseInt(value) : undefined)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Assign to someone" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No assignment</SelectItem>
                        {participants
                          .filter(participant => participant.userId != null)
                          .map(participant => (
                            <SelectItem 
                              key={participant.userId} 
                              value={String(participant.userId)}
                            >
                              {participant.name}
                            </SelectItem>
                          ))
                        }
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            {/* Status Section */}
            <div 
              className={cn(
                "transition-all hover:bg-slate-50/50",
                expandedSections.status ? "bg-slate-50/80" : ""
              )}
            >
              <div 
                className="flex items-center gap-2 cursor-pointer px-4 py-3" 
                onClick={() => toggleSection("status")}
              >
                <TagIcon className="h-5 w-5 text-primary/70" />
                <div className="flex-1">
                  <span className="text-sm capitalize">
                    {form.watch("status") || "Pending"}
                  </span>
                </div>
                <ChevronDownIcon className={cn(
                  "h-4 w-4 transition-transform text-muted-foreground",
                  expandedSections.status ? "rotate-180" : ""
                )} />
              </div>
              
              {expandedSections.status && (
                <div className="px-4 pb-3 pt-0">
                  <div className="ml-7">
                    <Select
                      value={form.watch("status") || "pending"}
                      onValueChange={(value) => form.setValue("status", value as "pending" | "booked" | "unsure")}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="booked">Booked</SelectItem>
                        <SelectItem value="unsure">Unsure</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            {/* Description Section */}
            <div 
              className={cn(
                "transition-all hover:bg-slate-50/50",
                expandedSections.description ? "bg-slate-50/80" : ""
              )}
            >
              <div 
                className="flex items-center gap-2 cursor-pointer px-4 py-3" 
                onClick={() => toggleSection("description")}
              >
                <div className="h-5 w-5 flex items-center justify-center text-primary/70">
                  <span className="text-lg leading-none">¶</span>
                </div>
                <div className="flex-1">
                  {form.watch("description") ? (
                    <span className="text-sm line-clamp-1">{form.watch("description")}</span>
                  ) : (
                    <span className="text-sm text-muted-foreground">Add description</span>
                  )}
                </div>
                <ChevronDownIcon className={cn(
                  "h-4 w-4 transition-transform text-muted-foreground",
                  expandedSections.description ? "rotate-180" : ""
                )} />
              </div>
              
              {expandedSections.description && (
                <div className="px-4 pb-3 pt-0">
                  <div className="ml-7">
                    <Textarea
                      placeholder="Add description..."
                      {...form.register("description")}
                      className="min-h-[100px]"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 bg-muted/30 py-3 px-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            size="sm"
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isPending} size="sm">
            {isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </form>
    </div>
  );
}