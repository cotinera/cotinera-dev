import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format, addHours } from "date-fns";
import type { Trip } from "@db/schema";
import { Loader2 } from "lucide-react";

interface NLPEventCreatorProps {
  trip: Trip;
}

interface NLPEventResult {
  title: string;
  description: string | null;
  location: string | null;
  startTime: string; // ISO string
  endTime: string;   // ISO string
}

export function NLPEventCreator({ trip }: NLPEventCreatorProps) {
  const [value, setValue] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Mutation to process natural language into event details
  const processNLPMutation = useMutation({
    mutationFn: async (text: string) => {
      const response = await fetch(`/api/nlp/parse-event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ text })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to process event text: ${errorText}`);
      }
      
      return response.json() as Promise<NLPEventResult>;
    },
    onSuccess: (data) => {
      // Once we parse the text successfully, create the actual event
      createEventMutation.mutate(data);
      setValue("");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to process input",
        description: error.message,
        variant: "destructive"
      });
      setIsProcessing(false);
    }
  });

  // Mutation to create the event once parsed
  const createEventMutation = useMutation({
    mutationFn: async (data: NLPEventResult) => {
      const response = await fetch(`/api/trips/${trip.id}/activities`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          title: data.title,
          description: data.description,
          location: data.location,
          startTime: data.startTime,
          endTime: data.endTime
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create event: ${errorText}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${trip.id}/activities`] });
      toast({
        title: "Event created",
        description: "Your event has been added to the calendar."
      });
      setIsProcessing(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create event",
        description: error.message,
        variant: "destructive"
      });
      setIsProcessing(false);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    
    setIsProcessing(true);
    processNLPMutation.mutate(value);
  };

  return (
    <div className="relative">
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. 'Film at 7pm on Friday'"
          className="flex-1"
          disabled={isProcessing}
        />
        <Button 
          type="submit" 
          size="sm"
          disabled={!value.trim() || isProcessing}
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing
            </>
          ) : "Create"}
        </Button>
      </form>
    </div>
  );
}