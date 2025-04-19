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
import { toast } from "@/hooks/use-toast";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { LocationSearchBar } from "./location-search-bar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format, isValid, parseISO } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ExpandableTripIdeaForm } from "./expandable-trip-idea-form";

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
  const queryClient = useQueryClient();

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

  const filteredIdeas = Array.isArray(ideas) ? ideas.filter((idea: any) => {
    if (activeTab === "all") return true;
    return idea.status === activeTab;
  }) : [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline">Pending</Badge>;
      case "booked":
        return <Badge className="bg-green-500 text-white hover:bg-green-600">Booked</Badge>;
      case "unsure":
        return <Badge variant="secondary">Unsure</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return <div className="flex justify-center p-8">Loading ideas...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">Trip Ideas</h2>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-1">
              <PlusCircle className="h-4 w-4" />
              Add Idea
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="booked">Booked</TabsTrigger>
          <TabsTrigger value="unsure">Unsure</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {filteredIdeas.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-muted-foreground">No ideas found. Add your first idea!</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredIdeas.map((idea: any) => (
                <Card key={idea.id} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg font-semibold">{idea.title}</CardTitle>
                      {getStatusBadge(idea.status)}
                    </div>
                    {idea.ownerName && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Avatar className="h-6 w-6">
                          {idea.ownerAvatar ? (
                            <AvatarImage src={idea.ownerAvatar} alt={idea.ownerName} />
                          ) : (
                            <AvatarFallback>{idea.ownerName.charAt(0)}</AvatarFallback>
                          )}
                        </Avatar>
                        <span>Owned by {idea.ownerName}</span>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    {idea.description && <p className="text-sm text-muted-foreground">{idea.description}</p>}
                    {idea.location && (
                      <div className="flex items-center gap-1 mt-2 text-sm">
                        <MapPin className="h-4 w-4" />
                        <span>{idea.location}</span>
                      </div>
                    )}
                    {idea.plannedDate && (
                      <div className="flex items-center gap-1 mt-2 text-sm">
                        <Calendar className="h-4 w-4" />
                        <span>
                          {format(new Date(idea.plannedDate), "PPP")}
                          {idea.plannedTime && ` at ${idea.plannedTime}`}
                        </span>
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="border-t bg-muted/40 px-6 py-3 flex justify-between">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="gap-1"
                      onClick={() => voteIdeaMutation.mutate(idea.id)}
                      disabled={voteIdeaMutation.isPending}
                    >
                      <ThumbsUp className="h-4 w-4" />
                      <span>{idea.votes || 0}</span>
                    </Button>
                    <div className="flex gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleEditClick(idea)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleDeleteClick(idea.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardFooter>
                </Card>
              ))}
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
    </div>
  );
}