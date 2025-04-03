import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useForm, useFieldArray } from "react-hook-form";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDistance } from "date-fns";
import { Send, ChevronDown, BarChart, MessageSquare, ChevronUp } from "lucide-react";
import type { ChatMessage, Poll, PollVote } from "@db/schema";
import { useEffect, useRef, useState, useMemo } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface ChatMessagesProps {
  tripId: number;
}

interface ChatFormData {
  message: string;
}

interface PollFormData {
  question: string;
  options: string[];
  endTime?: string;
}

const pollFormSchema = z.object({
  question: z.string().min(1, "Question is required"),
  options: z.array(z.string()).min(2, "At least 2 options are required"),
  endTime: z.string().optional(),
});

export function ChatMessages({ tripId }: ChatMessagesProps) {
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPollDialogOpen, setIsPollDialogOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const { toast } = useToast();
  
  // Get the messages for the chat
  const { data: messages = [], isLoading } = useQuery<ChatMessage[]>({
    queryKey: ["/api/trips", tripId, "chat"],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripId}/chat`);
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json();
    },
    refetchInterval: 2000,
  });
  
  const mostRecentMessage = messages.length > 0 ? messages[0] : null;
  
  const chatForm = useForm<ChatFormData>({
    defaultValues: {
      message: "",
    },
  });

  const pollForm = useForm<PollFormData>({
    resolver: zodResolver(pollFormSchema),
    defaultValues: {
      question: "",
      options: ["", ""],
      endTime: undefined,
    },
  });

  const { fields: optionFields, append, remove } = useFieldArray({
    control: pollForm.control,
    name: "options",
  });

  const { mutate: sendMessage } = useMutation({
    mutationFn: async (data: ChatFormData | { message: string }) => {
      const res = await fetch(`/api/trips/${tripId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: 'include'
      });
      if (!res.ok) throw new Error("Failed to send message");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId, "chat"] });
      chatForm.reset();
      
      // Auto expand when a user sends a message
      if (!isExpanded) {
        setIsExpanded(true);
      }
    },
  });

  const { mutate: createPoll, isPending: isCreatingPoll } = useMutation({
    mutationFn: async (data: PollFormData) => {
      console.log('Creating poll with data:', data);
      const res = await fetch(`/api/trips/${tripId}/polls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: data.question,
          options: data.options.filter(opt => opt.trim()),
          endTime: data.endTime
        }),
        credentials: 'include'
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || error.details || 'Failed to create poll');
      }

      return res.json();
    },
    onSuccess: (data) => {
      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId, "chat"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId, "polls"] });

      // Close dialog and reset form
      setIsPollDialogOpen(false);
      pollForm.reset({
        question: "",
        options: ["", ""],
        endTime: undefined,
      });

      // Show success message
      toast({
        title: "Success",
        description: "Poll created successfully",
      });
      
      // Auto expand when a poll is created
      if (!isExpanded) {
        setIsExpanded(true);
      }
    },
    onError: (error: Error) => {
      console.error('Error creating poll:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create poll",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (scrollRef.current && isExpanded) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isExpanded]);

  const onSubmitChat = (data: ChatFormData) => {
    if (!data.message.trim()) return;
    sendMessage(data);
  };

  const onSubmitPoll = async (data: PollFormData) => {
    try {
      const filteredOptions = data.options.filter(option => option.trim());
      if (filteredOptions.length < 2) {
        pollForm.setError("options", {
          message: "At least 2 non-empty options are required",
        });
        return;
      }

      createPoll({
        question: data.question,
        options: filteredOptions,
        endTime: data.endTime,
      });
    } catch (error) {
      console.error('Error creating poll:', error);
    }
  };
  
  // Function to get a preview of the message content
  const getMessagePreview = (message: ChatMessage | null) => {
    if (!message) return "No messages yet";
    
    try {
      const data = JSON.parse(message.message);
      if (data.type === 'poll') {
        return `Poll: ${data.question}`;
      }
    } catch (error) {
      // Not a JSON message, continue with normal preview
    }
    
    // Truncate message if needed
    const preview = message.message.length > 60 
      ? message.message.substring(0, 60) + "..." 
      : message.message;
      
    return preview;
  };
  
  if (!isExpanded) {
    // Collapsed view
    return (
      <Card className="mb-4">
        <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-md font-medium flex items-center">
            <MessageSquare className="h-4 w-4 mr-2" />
            Group Chat
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsExpanded(true)}
            className="h-8 px-2"
          >
            <ChevronDown className="h-4 w-4 mr-1" /> 
            Expand
          </Button>
        </CardHeader>
        <CardContent className="px-4 py-2 flex justify-between items-center">
          <div className="text-sm truncate text-muted-foreground">
            {mostRecentMessage && (
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarFallback>
                    {'U'}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium text-xs">
                  User:
                </span>
                {getMessagePreview(mostRecentMessage)}
              </div>
            )}
            {!mostRecentMessage && "No messages yet - click to start a conversation"}
          </div>
          <form
            onSubmit={chatForm.handleSubmit(onSubmitChat)}
            className="flex items-center gap-2"
          >
            <Input
              {...chatForm.register("message")}
              placeholder="Quick message..."
              className="w-40 h-8 text-sm"
            />
            <Button
              type="submit"
              size="sm"
              disabled={chatForm.watch("message").length === 0}
              className="h-8"
            >
              <Send className="h-3 w-3" />
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }
  
  // Expanded view
  return (
    <Card className="mb-4">
      <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0 border-b">
        <CardTitle className="text-md font-medium flex items-center">
          <MessageSquare className="h-4 w-4 mr-2" />
          Group Chat
        </CardTitle>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setIsExpanded(false)}
          className="h-8 px-2"
        >
          <ChevronUp className="h-4 w-4 mr-1" /> 
          Collapse
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex flex-col h-[350px]">
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            <div className="space-y-4">
              {[...messages].reverse().map((message) => (
                <div key={message.id} className="flex items-start gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      {'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {'User'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {message.createdAt ? formatDistance(new Date(message.createdAt), new Date(), {
                          addSuffix: true,
                        }) : ''}
                      </span>
                    </div>
                    {(() => {
                      try {
                        const data = JSON.parse(message.message);
                        if (data.type === 'poll') {
                          return <div className="bg-accent/20 rounded-lg p-4 mt-2">
                            <h4 className="font-medium mb-2">{data.question || 'Poll question'}</h4>
                            <div className="space-y-2">
                              {(data.options || []).map((option: string, index: number) => (
                                <div key={index} className="w-full text-left p-2 rounded bg-accent/30">
                                  {option}
                                </div>
                              ))}
                            </div>
                          </div>;
                        }
                        return <p className="text-sm mt-1">{linkifyURLs(message.message)}</p>;
                      } catch (error) {
                        return <p className="text-sm mt-1">{linkifyURLs(message.message)}</p>;
                      }
                    })()}
                  </div>
                </div>
              ))}
              {messages.length === 0 && !isLoading && (
                <p className="text-center text-muted-foreground">
                  Share flight deals, accommodations, and travel ideas with your group here!
                </p>
              )}
            </div>
          </ScrollArea>
          <div className="p-4 border-t">
            <form
              onSubmit={chatForm.handleSubmit(onSubmitChat)}
              className="flex items-center gap-2"
            >
              <div className="flex-1 flex gap-2">
                <Input
                  {...chatForm.register("message")}
                  placeholder="Type a message..."
                  className="flex-1"
                />
                <Dialog open={isPollDialogOpen} onOpenChange={setIsPollDialogOpen}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon">
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setIsPollDialogOpen(true)}>
                        <BarChart className="h-4 w-4 mr-2" />
                        Create Poll
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create a Poll</DialogTitle>
                    </DialogHeader>
                    <Form {...pollForm}>
                      <form onSubmit={pollForm.handleSubmit(onSubmitPoll)} className="space-y-4">
                        <FormField
                          control={pollForm.control}
                          name="question"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Question</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="What's your question?" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="space-y-2">
                          <FormLabel>Options</FormLabel>
                          {optionFields.map((field, index) => (
                            <FormField
                              key={field.id}
                              control={pollForm.control}
                              name={`options.${index}`}
                              render={({ field }) => (
                                <FormItem>
                                  <div className="flex gap-2">
                                    <FormControl>
                                      <Input {...field} placeholder={`Option ${index + 1}`} />
                                    </FormControl>
                                    {index >= 2 && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => remove(index)}
                                      >
                                        ×
                                      </Button>
                                    )}
                                  </div>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          ))}
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full"
                            onClick={() => append("")}
                          >
                            Add Option
                          </Button>
                        </div>

                        <FormField
                          control={pollForm.control}
                          name="endTime"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>End Time (Optional)</FormLabel>
                              <FormControl>
                                <Input
                                  type="datetime-local"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <DialogFooter>
                          <Button type="submit" disabled={isCreatingPoll}>
                            Create Poll
                          </Button>
                        </DialogFooter>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
              <Button
                type="submit"
                size="icon"
                disabled={chatForm.watch("message").length === 0}
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Helper function to wrap URLs in clickable links
function linkifyURLs(text: string) {
  // Regular expression to match URLs
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  
  // If no URLs in the text, return the text as is
  if (!urlRegex.test(text)) {
    return text;
  }
  
  // Split the text by URLs
  const parts = text.split(urlRegex);
  
  // Create a new array to hold the result
  const result = [];
  
  // For each part in the array, check if it's a URL
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    
    // If the part matches the URL regex, it's a URL
    if (part && part.match(urlRegex)) {
      result.push(
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          {part}
        </a>
      );
    } else if (part) {
      // Otherwise, it's regular text
      result.push(part);
    }
  }
  
  return result;
}