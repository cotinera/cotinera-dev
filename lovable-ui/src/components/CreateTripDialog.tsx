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

interface CreateTripDialogProps {
  onTripCreated: (trip: any) => void;
}

const CreateTripDialog = ({ onTripCreated }: CreateTripDialogProps) => {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    title: "",
    destination: "",
    startDate: "",
    endDate: "",
    travelers: 1
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const newTrip = {
        id: Date.now().toString(),
        ...formData,
        status: "upcoming" as const,
        travelers: Number(formData.travelers)
      };
      
      onTripCreated(newTrip);
      
      toast({
        title: "Trip Created!",
        description: `Your trip to ${formData.destination} has been created successfully.`,
      });
      
      setFormData({
        title: "",
        destination: "",
        startDate: "",
        endDate: "",
        travelers: 1
      });
      
      setOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create trip. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string | number) => {
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
            <Label htmlFor="destination" className="text-sm font-medium flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              Destination
            </Label>
            <Input
              id="destination"
              placeholder="Paris, France"
              value={formData.destination}
              onChange={(e) => handleInputChange("destination", e.target.value)}
              required
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
          
          <div className="space-y-2">
            <Label htmlFor="travelers" className="text-sm font-medium flex items-center gap-1">
              <Users className="w-4 h-4" />
              Number of Travelers
            </Label>
            <Input
              id="travelers"
              type="number"
              min="1"
              max="20"
              value={formData.travelers}
              onChange={(e) => handleInputChange("travelers", parseInt(e.target.value))}
              required
            />
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
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? "Creating..." : "Create Trip"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTripDialog;