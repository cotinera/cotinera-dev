import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useForm, useFieldArray } from "react-hook-form";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDistance } from "date-fns";
import { Send, ChevronDown, BarChart } from "lucide-react";
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
  DialogTrigger,
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

function PollMessage({ message, tripId }: { message: ChatMessage; tripId: number }) {
  const queryClient = useQueryClient();
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  // Parse poll data from message
  const pollData = useMemo(() => {
    try {
      const data = JSON.parse(message.message);
      return data.type === 'poll' ? data : null;
    } catch (e) {
      console.error('Error parsing poll data:', e);
      return null;
    }
  }, [message.message]);

  const { data: pollDetails } = useQuery({
    queryKey: ["/api/trips", tripId, "polls", pollData?.pollId],
    queryFn: async () => {
      if (!pollData?.pollId) return null;
      const res = await fetch(`/api/trips/${tripId}/polls/${pollData.pollId}`);
      if (!res.ok) throw new Error("Failed to fetch poll details");
      return res.json();
    },
    enabled: !!pollData?.pollId,
  });

  const { mutate: submitVote } = useMutation({
    mutationFn: async (optionIndex: number) => {
      if (!pollData?.pollId) return;
      const res = await fetch(`/api/trips/${tripId}/polls/${pollData.pollId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionIndex }),
        credentials: 'include'
      });
      if (!res.ok) throw new Error("Failed to submit vote");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/trips", tripId, "polls", pollData?.pollId],
      });
    },
  });

  if (!pollData || !pollDetails) return null;

  const { votes = [] } = pollDetails;
  const optionVotes = pollData.options.map((_: string, index: number) =>
    votes.filter((vote: any) => vote.optionIndex === index).length
  );
  const totalVotes = votes.length;

  return (
    <div className="bg-accent/20 rounded-lg p-4 mt-2">
      <h4 className="font-medium mb-2">{pollData.question}</h4>
      <div className="space-y-2">
        {pollData.options.map((option: string, index: number) => {
          const voteCount = optionVotes[index];
          const percentage = totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0;

          return (
            <button
              key={index}
              className={cn(
                "w-full text-left p-2 rounded hover:bg-accent/30 relative",
                selectedOption === index && "bg-accent/40"
              )}
              onClick={() => {
                setSelectedOption(index);
                submitVote(index);
              }}
              disabled={pollDetails?.isClosed}
            >
              <div className="flex justify-between items-center">
                <span>{option}</span>
                <span className="text-sm text-muted-foreground">
                  {voteCount} ({percentage.toFixed(1)}%)
                </span>
              </div>
              <div
                className="absolute inset-0 bg-accent/20 rounded"
                style={{
                  width: `${percentage}%`,
                  zIndex: -1,
                }}
              />
            </button>
          );
        })}
      </div>
      {pollDetails?.endTime && (
        <p className="text-sm text-muted-foreground mt-2">
          Ends {formatDistance(new Date(pollDetails.endTime), new Date(), { addSuffix: true })}
        </p>
      )}
    </div>
  );
}

export function ChatMessages({ tripId }: ChatMessagesProps) {
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPollDialogOpen, setIsPollDialogOpen] = useState(false);

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

  const { data: messages = [], isLoading } = useQuery<ChatMessage[]>({
    queryKey: ["/api/trips", tripId, "chat"],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripId}/chat`);
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json();
    },
    refetchInterval: 2000,
  });

  const { mutate: sendMessage, isPending: isSendingMessage } = useMutation({
    mutationFn: async (data: ChatFormData) => {
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
    },
  });

  const { mutate: createPoll, isPending: isCreatingPoll } = useMutation({
    mutationFn: async (data: PollFormData) => {
      const res = await fetch(`/api/trips/${tripId}/polls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: data.question,
          options: data.options.filter(opt => opt.trim()),
          endTime: data.endTime,
        }),
        credentials: 'include'
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Failed to create poll');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips", tripId, "chat"] });
      setIsPollDialogOpen(false);
      pollForm.reset({
        question: "",
        options: ["", ""],
        endTime: undefined,
      });
    },
    onError: (error) => {
      console.error('Error creating poll:', error);
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [messages]);

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
      await createPoll({
        question: data.question,
        options: filteredOptions,
        endTime: data.endTime,
      });
    } catch (error) {
      console.error('Error creating poll:', error);
    }
  };

  return (
    <div className="flex flex-col h-[400px] border rounded-lg bg-background">
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {[...messages].reverse().map((message) => (
            <div key={message.id} className="flex items-start gap-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback>
                  {message.user?.name?.[0]?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {message.user?.name || message.user?.email?.split('@')[0] || 'Unknown User'}
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
                      return <PollMessage message={message} tripId={tripId} />;
                    }
                    return <p className="text-sm mt-1">{linkifyText(message.message)}</p>;
                  } catch (error) {
                    console.error("Error parsing message:", error);
                    return <p>Error parsing message</p>;
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

                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsPollDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isCreatingPoll}>
                        Create Poll
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
          <Button
            type="submit"
            size="icon"
            disabled={isSendingMessage}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}

// Helper function to convert URLs in text to clickable links
function linkifyText(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          {part}
        </a>
      );
    }
    return part;
  });
}