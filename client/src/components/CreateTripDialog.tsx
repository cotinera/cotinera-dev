import { useState } from "react";
import { Plus, Calendar, MapPin, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface CreateTripDialogProps {
  onTripCreated?: (trip: any) => void;
}

const CreateTripDialog = ({ onTripCreated }: CreateTripDialogProps) => {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    startDate: "",
    endDate: "",
  });

  const createTripMutation = useMutation({
    mutationFn: async (tripData: typeof formData) => {
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tripData),
        credentials: 'include'
      });
      if (!res.ok) throw new Error("Failed to create trip");
      return res.json();
    },
    onSuccess: (newTrip) => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      onTripCreated?.(newTrip);
      toast({
        title: "Trip Created!",
        description: `Your trip "${formData.title}" has been created successfully.`,
      });
      setFormData({
        title: "",
        description: "",
        startDate: "",
        endDate: "",
      });
      setOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create trip. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    createTripMutation.mutate(formData);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="adventure" className="gap-2">
          <Plus className="w-4 h-4" />
          Create New Trip
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Create New Trip</DialogTitle>
          <DialogDescription>
            Plan your next adventure by adding trip details below.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title" className="text-sm font-medium">
              Trip Title
            </Label>
            <Input
              id="title"
              placeholder="Summer Vacation 2024"
              value={formData.title}
              onChange={(e) => handleInputChange("title", e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium">
              Description
            </Label>
            <Input
              id="description"
              placeholder="A wonderful trip with friends..."
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate" className="text-sm font-medium flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Start Date
              </Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => handleInputChange("startDate", e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="endDate" className="text-sm font-medium">
                End Date
              </Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) => handleInputChange("endDate", e.target.value)}
                required
              />
            </div>
          </div>
          
          <div className="flex gap-3 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              variant="adventure" 
              disabled={createTripMutation.isPending}
              className="flex-1"
            >
              {createTripMutation.isPending ? "Creating..." : "Create Trip"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTripDialog;