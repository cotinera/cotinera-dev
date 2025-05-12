import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusCircle, ThumbsUp, Edit, Trash2, MapPin, Calendar } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axios from "axios";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { LocationSearchBar } from "./location-search-bar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format, isValid, parseISO } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ExpandableTripIdeaForm } from "./expandable-trip-idea-form";
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

interface TripIdeasProps {
  tripId: number;
  participants: Array<{
    id: number;
    name: string;
    userId: number;
    avatar?: string;
  }>;
}

export function TripIdeas({ tripId, participants }: TripIdeasProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingIdea, setEditingIdea] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [ideaToAddToCalendar, setIdeaToAddToCalendar] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [startTime, setStartTime] = useState("12:00");
  const [endTime, setEndTime] = useState("13:00");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: ideas = [], isLoading } = useQuery({
    queryKey: ["/api/trips", tripId, "ideas"],
    queryFn: async () => {
      const response = await axios.get(`/api/trips/${tripId}/ideas`);
      return response.data;
    },
  });

  const addForm = useForm<z.infer<typeof tripIdeaSchema>>({
    resolver: zodResolver(tripIdeaSchema),
    defaultValues: {
      title: "",
      description: "",
      status: "pending",
      location: "",
    },
  });

  const editForm = useForm<z.infer<typeof tripIdeaSchema>>({
    resolver: zodResolver(tripIdeaSchema),
    defaultValues: {
      title: "",
      description: "",
      status: "pending",
      location: "",
    },
  });

  const addIdeaMutation = useMutation({
    mutationFn: async (values: z.infer<typeof tripIdeaSchema>) => {
      const response = await axios.post(`/api/trips/${tripId}/ideas`, values);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId, "ideas"] });
      addForm.reset();
      setIsAddDialogOpen(false);
      toast({
        title: "Idea added",
        description: "Your trip idea has been added successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "Failed to add trip idea. Please try again.",
        variant: "destructive",
      });
      console.error("Error adding trip idea:", error);
    },
  });

  const editIdeaMutation = useMutation({
    mutationFn: async (values: z.infer<typeof tripIdeaSchema> & { id: number }) => {
      const { id, ...data } = values;
      const response = await axios.patch(`/api/trips/${tripId}/ideas/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId, "ideas"] });
      editForm.reset();
      setIsEditDialogOpen(false);
      setEditingIdea(null);
      toast({
        title: "Idea updated",
        description: "Your trip idea has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "Failed to update trip idea. Please try again.",
        variant: "destructive",
      });
      console.error("Error updating trip idea:", error);
    },
  });

  const deleteIdeaMutation = useMutation({
    mutationFn: async (ideaId: number) => {
      await axios.delete(`/api/trips/${tripId}/ideas/${ideaId}`);
      return ideaId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId, "ideas"] });
      toast({
        title: "Idea deleted",
        description: "The trip idea has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "Failed to delete trip idea. Please try again.",
        variant: "destructive",
      });
      console.error("Error deleting trip idea:", error);
    },
  });

  const voteIdeaMutation = useMutation({
    mutationFn: async (ideaId: number) => {
      const response = await axios.post(`/api/trips/${tripId}/ideas/${ideaId}/vote`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId, "ideas"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: "Failed to vote for idea. Please try again.",
        variant: "destructive",
      });
      console.error("Error voting for idea:", error);
    },
  });
  
  const addToCalendarMutation = useMutation({
    mutationFn: async (data: { 
      idea: any; 
      date: Date; 
      startTime: string; 
      endTime: string; 
    }) => {
      if (!data.date) {
        throw new Error("Please select a date");
      }

      // Create start and end date objects from the selected date and times
      const [startHours, startMinutes] = data.startTime.split(':').map(Number);
      const [endHours, endMinutes] = data.endTime.split(':').map(Number);
      
      const startDate = new Date(data.date);
      startDate.setHours(startHours, startMinutes, 0);
      
      const endDate = new Date(data.date);
      endDate.setHours(endHours, endMinutes, 0);

      const res = await fetch(`/api/trips/${tripId}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({
          title: data.idea.title,
          description: data.idea.description || '',
          location: data.idea.location,
          coordinates: data.idea.coordinates,
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString()
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Failed to add to calendar");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/trips/${tripId}/activities`]
      });
      
      setIdeaToAddToCalendar(null);
      setSelectedDate(undefined);
      
      toast({
        title: "Success",
        description: "Idea added to calendar",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to add to calendar",
      });
    },
  });

  const onAddSubmit = (data: z.infer<typeof tripIdeaSchema>) => {
    addIdeaMutation.mutate(data);
  };

  const onEditSubmit = (data: z.infer<typeof tripIdeaSchema>) => {
    if (editingIdea) {
      editIdeaMutation.mutate({ ...data, id: editingIdea.id });
    }
  };

  const handleEditClick = (idea: any) => {
    setEditingIdea(idea);
    editForm.reset({
      title: idea.title,
      description: idea.description || "",
      status: idea.status,
      location: idea.location || "",
      ownerId: idea.ownerId,
      plannedDate: idea.plannedDate ? new Date(idea.plannedDate) : undefined,
      plannedTime: idea.plannedTime || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleDeleteClick = (ideaId: number) => {
    if (window.confirm("Are you sure you want to delete this idea?")) {
      deleteIdeaMutation.mutate(ideaId);
    }
  };
  
  const handleAddToCalendar = () => {
    if (!ideaToAddToCalendar || !selectedDate) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a date",
      });
      return;
    }

    addToCalendarMutation.mutate({
      idea: ideaToAddToCalendar,
      date: selectedDate,
      startTime,
      endTime
    });
  };

  const filteredIdeas = Array.isArray(ideas) ? ideas.filter((idea: any) => {
    if (activeTab === "all") return true;
    return idea.status === activeTab;
  }) : [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="text-xs font-normal px-2 py-0">Pending</Badge>;
      case "booked":
        return <Badge className="bg-primary/80 text-primary-foreground hover:bg-primary/70 text-xs font-normal px-2 py-0">Booked</Badge>;
      case "unsure":
        return <Badge variant="secondary" className="text-xs font-normal px-2 py-0">Unsure</Badge>;
      default:
        return <Badge variant="outline" className="text-xs font-normal px-2 py-0">{status}</Badge>;
    }
  };

  if (isLoading) {
    return <div className="flex justify-center p-8">Loading ideas...</div>;
  }

  return (
    <Card className="overflow-hidden border-none shadow-sm bg-background">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            <span className="text-primary/80 rounded-full bg-primary/10 p-1">
              <ThumbsUp className="h-4 w-4" />
            </span>
            Trip Ideas
          </CardTitle>
        </div>
        <CardDescription>
          Collaborate on ideas for your trip with other participants
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-2 h-8 w-fit">
            <TabsTrigger value="all" className="text-xs px-3 h-7">All</TabsTrigger>
            <TabsTrigger value="pending" className="text-xs px-3 h-7">Pending</TabsTrigger>
            <TabsTrigger value="booked" className="text-xs px-3 h-7">Booked</TabsTrigger>
            <TabsTrigger value="unsure" className="text-xs px-3 h-7">Unsure</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-2">
            {filteredIdeas.length === 0 ? (
              <div className="text-center py-6 px-4 border rounded-md bg-muted/20">
                <p className="text-muted-foreground text-sm mb-4">No ideas found for this filter.</p>
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      className="w-full sm:w-auto sm:min-w-[200px] gap-2"
                    >
                      <PlusCircle className="h-4 w-4" />
                      Add New Idea
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[600px] p-0 border-none shadow-lg">
                    <DialogHeader className="sr-only">
                      <DialogTitle>Add Trip Idea</DialogTitle>
                      <DialogDescription>Form to add a new trip idea</DialogDescription>
                    </DialogHeader>
                    <ExpandableTripIdeaForm
                      tripId={tripId}
                      participants={participants}
                      onSubmit={onAddSubmit}
                      onCancel={() => setIsAddDialogOpen(false)}
                      isPending={addIdeaMutation.isPending}
                    />
                  </DialogContent>
                </Dialog>
              </div>
            ) : (
              <div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
                  {filteredIdeas.map((idea: any) => (
                    <Card key={idea.id} className="overflow-hidden border shadow-sm">
                      <CardHeader className="pb-2 space-y-1">
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-base font-medium">{idea.title}</CardTitle>
                          {getStatusBadge(idea.status)}
                        </div>
                        {idea.ownerName && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Avatar className="h-5 w-5">
                              {idea.ownerAvatar ? (
                                <AvatarImage src={idea.ownerAvatar} alt={idea.ownerName} />
                              ) : (
                                <AvatarFallback className="text-xs">{idea.ownerName.charAt(0)}</AvatarFallback>
                              )}
                            </Avatar>
                            <span>Owned by {idea.ownerName}</span>
                          </div>
                        )}
                      </CardHeader>
                      <CardContent className="pb-2 pt-0">
                        {idea.description && <p className="text-sm text-muted-foreground">{idea.description}</p>}
                        <div className="mt-2 space-y-1">
                          {idea.location && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3 text-primary/70" />
                              <span>{idea.location}</span>
                            </div>
                          )}
                          {idea.plannedDate && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3 text-primary/70" />
                              <span>
                                {format(new Date(idea.plannedDate), "PPP")}
                                {idea.plannedTime && ` at ${idea.plannedTime}`}
                              </span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                      <CardFooter className="border-t bg-muted/30 py-2 px-4 flex justify-between">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="gap-1 h-7 px-2 text-xs"
                          onClick={() => voteIdeaMutation.mutate(idea.id)}
                          disabled={voteIdeaMutation.isPending}
                        >
                          <ThumbsUp className="h-3 w-3" />
                          <span className="font-normal">{idea.votes || 0}</span>
                        </Button>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-7 px-2 text-xs flex items-center gap-1"
                            onClick={() => setIdeaToAddToCalendar(idea)}
                          >
                            <Calendar className="h-3 w-3" />
                            <span className="font-normal">Add to Calendar</span>
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => handleEditClick(idea)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => handleDeleteClick(idea.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
                
                <div className="flex justify-center">
                  <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                    <DialogTrigger asChild>
                      <Button 
                        size="lg" 
                        className="gap-2 bg-primary/90 hover:bg-primary text-primary-foreground px-6"
                      >
                        <PlusCircle className="h-5 w-5" />
                        Add New Idea
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[600px] p-0 border-none shadow-lg">
                      <DialogHeader className="sr-only">
                        <DialogTitle>Add Trip Idea</DialogTitle>
                        <DialogDescription>Form to add a new trip idea</DialogDescription>
                      </DialogHeader>
                      <ExpandableTripIdeaForm
                        tripId={tripId}
                        participants={participants}
                        onSubmit={onAddSubmit}
                        onCancel={() => setIsAddDialogOpen(false)}
                        isPending={addIdeaMutation.isPending}
                      />
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[600px] p-0 border-none shadow-lg">
            <DialogHeader className="sr-only">
              <DialogTitle>Edit Trip Idea</DialogTitle>
              <DialogDescription>Form to edit an existing trip idea</DialogDescription>
            </DialogHeader>
            <ExpandableTripIdeaForm
              tripId={tripId}
              participants={participants}
              onSubmit={onEditSubmit}
              onCancel={() => setIsEditDialogOpen(false)}
              isPending={editIdeaMutation.isPending}
              initialValues={editingIdea ? {
                title: editingIdea.title,
                description: editingIdea.description || "",
                status: editingIdea.status,
                location: editingIdea.location || "",
                ownerId: editingIdea.ownerId,
                plannedDate: editingIdea.plannedDate ? new Date(editingIdea.plannedDate) : undefined,
                plannedTime: editingIdea.plannedTime || "",
              } : undefined}
            />
          </DialogContent>
        </Dialog>
        
        {/* Add to Calendar Dialog */}
        <Dialog open={!!ideaToAddToCalendar} onOpenChange={(open) => !open && setIdeaToAddToCalendar(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add to Calendar</DialogTitle>
              <DialogDescription>
                Select a date and time to add {ideaToAddToCalendar?.title} to your trip calendar.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <h4 className="font-medium">Select Date</h4>
                <CalendarComponent
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  className="border rounded-md mx-auto"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium">Start Time</h4>
                  <Input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">End Time</h4>
                  <Input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button 
                onClick={handleAddToCalendar}
                disabled={!selectedDate || addToCalendarMutation.isPending}
              >
                {addToCalendarMutation.isPending ? "Adding..." : "Add to Calendar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}