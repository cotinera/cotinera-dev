import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { ChecklistItem } from "@db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ChecklistProps {
  tripId?: number;
}

export function Checklist({ tripId }: ChecklistProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newItemTitle, setNewItemTitle] = useState("");

  const { data: items = [] } = useQuery<ChecklistItem[]>({
    queryKey: [`/api/trips/${tripId}/checklist`],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripId}/checklist`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch checklist items");
      return res.json();
    },
    enabled: !!tripId,
  });

  const createItem = useMutation({
    mutationFn: async (title: string) => {
      const res = await fetch(`/api/trips/${tripId}/checklist`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title }),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/trips/${tripId}/checklist`],
      });
      setNewItemTitle("");
    },
  });

  const toggleItem = useMutation({
    mutationFn: async (item: ChecklistItem) => {
      const res = await fetch(`/api/trips/${tripId}/checklist/${item.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ completed: !item.completed }),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/trips/${tripId}/checklist`],
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tripId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a trip first",
      });
      return;
    }

    if (!newItemTitle.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a title",
      });
      return;
    }

    try {
      await createItem.mutateAsync(newItemTitle);
      toast({
        title: "Success",
        description: "Item added to checklist",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create checklist item",
      });
    }
  };

  if (!tripId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Checklist</CardTitle>
          <CardDescription>Select a trip to view its checklist</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trip Checklist</CardTitle>
        <CardDescription>Track your trip preparation tasks</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
          <Input
            placeholder="Add new item..."
            value={newItemTitle}
            onChange={(e) => setNewItemTitle(e.target.value)}
          />
          <Button type="submit" size="icon" disabled={createItem.isPending}>
            <Plus className="h-4 w-4" />
          </Button>
        </form>

        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-accent"
            >
              <Checkbox
                id={`item-${item.id}`}
                checked={item.completed}
                onCheckedChange={() => toggleItem.mutate(item)}
              />
              <label
                htmlFor={`item-${item.id}`}
                className={`flex-1 cursor-pointer ${
                  item.completed ? "line-through text-muted-foreground" : ""
                }`}
              >
                {item.title}
              </label>
            </div>
          ))}
          {items.length === 0 && (
            <p className="text-muted-foreground text-center py-4">
              No items in checklist
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}