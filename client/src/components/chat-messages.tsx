import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useForm } from "react-hook-form";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDistance } from "date-fns";
import { Send } from "lucide-react";
import type { ChatMessage } from "@db/schema";
import { useEffect, useRef } from "react";

interface ChatMessagesProps {
  tripId: number;
}

interface ChatFormData {
  message: string;
}

export function ChatMessages({ tripId }: ChatMessagesProps) {
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const form = useForm<ChatFormData>({
    defaultValues: {
      message: "",
    },
  });

  const { data: messages = [], isLoading } = useQuery<ChatMessage[]>({
    queryKey: ["/api/trips", tripId, "chat"],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripId}/chat`);
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json();
    },
    refetchInterval: 2000, // Poll every 2 seconds for new messages
  });

  const sendMessage = useMutation({
    mutationFn: async (data: ChatFormData) => {
      const res = await fetch(`/api/trips/${tripId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to send message");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["/api/trips", tripId, "chat"]);
      form.reset();
    },
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const onSubmit = (data: ChatFormData) => {
    if (!data.message.trim()) return;
    sendMessage.mutate(data);
  };

  return (
    <div className="flex flex-col h-[400px] border rounded-lg bg-background">
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((message) => (
            <div key={message.id} className="flex items-start gap-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback>
                  {message.user?.username?.[0].toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{message.user?.username || 'Unknown User'}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistance(new Date(message.createdAt), new Date(), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
                <p className="text-sm mt-1">{message.message}</p>
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
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex items-center gap-2"
        >
          <Input
            {...form.register("message")}
            placeholder="Type a message..."
            className="flex-1"
          />
          <Button
            type="submit"
            size="icon"
            disabled={sendMessage.isLoading}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}