import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ChecklistItem } from "@db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Plus, Pencil, Trash2, ListTodo, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ChecklistProps {
  tripId?: number;
}

export function Checklist({ tripId }: ChecklistProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newItemTitle, setNewItemTitle] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const { data: items = [], isError } = useQuery<ChecklistItem[]>({
    queryKey: [`/api/trips/${tripId}/checklist`],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripId}/checklist`, {
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: 'Failed to fetch checklist items' }));
        throw new Error(error.message);
      }
      return res.json();
    },
    enabled: !!tripId,
  });

  const deleteItem = useMutation({
    mutationFn: async (itemId: number) => {
      const res = await fetch(`/api/trips/${tripId}/checklist/${itemId}`, {
        method: "DELETE",
        credentials: "include",
        headers: {
          "Accept": "application/json",
        },
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: 'Failed to delete checklist item' }));
        throw new Error(error.message);
      }

      return res.json().catch(() => ({}));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/trips/${tripId}/checklist`],
      });
    },
    onError: (error: Error) => {
      console.error("Delete error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete item",
      });
    },
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
        const error = await res.json().catch(() => ({ message: 'Failed to create checklist item' }));
        throw new Error(error.message);
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/trips/${tripId}/checklist`],
      });
      setNewItemTitle("");
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create checklist item",
      });
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, title, completed }: Partial<ChecklistItem> & { id: number }) => {
      const res = await fetch(`/api/trips/${tripId}/checklist/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title, completed }),
        credentials: "include",
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: 'Failed to update checklist item' }));
        throw new Error(error.message);
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/trips/${tripId}/checklist`],
      });
      setEditingId(null);
      setEditingTitle("");
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update checklist item",
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

    createItem.mutate(newItemTitle);
  };

  const startEditing = (item: ChecklistItem) => {
    setEditingId(item.id);
    setEditingTitle(item.title);
  };

  const handleEditSubmit = (item: ChecklistItem) => {
    if (editingTitle.trim() === "") {
      return;
    }
    updateItem.mutate({ id: item.id, title: editingTitle, completed: item.completed });
  };

  const handleDeleteItem = (itemId: number) => {
    if (!tripId) return;
    deleteItem.mutate(itemId);
  };

  const completedItems = items.filter(item => item.completed);
  const pendingItems = items.filter(item => !item.completed);
  const progressPercentage = items.length > 0 ? (completedItems.length / items.length) * 100 : 0;

  if (!tripId) {
    return (
      <Card className="bg-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListTodo className="w-5 h-5" />
            Trip Checklist
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">Select a trip to view its checklist</p>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="bg-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListTodo className="w-5 h-5" />
            Trip Checklist
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">Failed to load checklist</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border/50 shadow-soft hover:shadow-card transition-all duration-300" data-tutorial="checklist">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ListTodo className="w-5 h-5 text-primary" />
              Trip Checklist
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {items.length > 0 ? `${completedItems.length} of ${items.length} completed` : "No items yet"}
            </p>
          </div>
          {items.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-adventure transition-all duration-300"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
              <span className="text-sm font-medium text-primary">{Math.round(progressPercentage)}%</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add new item form */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            placeholder="Add new item to your checklist..."
            value={newItemTitle}
            onChange={(e) => setNewItemTitle(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" variant="adventure" disabled={createItem.isPending}>
            <Plus className="h-4 w-4" />
          </Button>
        </form>

        {/* Checklist items */}
        <div className="space-y-3">
          {items.length === 0 ? (
            <div className="text-center py-8">
              <ListTodo className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No checklist items yet
              </h3>
              <p className="text-muted-foreground mb-4">
                Add items to keep track of your trip preparation tasks.
              </p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className={`flex items-center gap-3 p-4 rounded-lg border transition-all duration-200 group ${
                  item.completed 
                    ? "bg-primary/5 border-primary/20" 
                    : "bg-muted/30 border-border/50 hover:bg-muted/50 hover:shadow-soft"
                }`}
              >
                <Checkbox
                  id={`item-${item.id}`}
                  checked={item.completed || false}
                  onCheckedChange={() =>
                    updateItem.mutate({ id: item.id, completed: !item.completed })
                  }
                  className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
                
                {editingId === item.id ? (
                  <form
                    className="flex-1 flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleEditSubmit(item);
                    }}
                  >
                    <Input
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onBlur={() => handleEditSubmit(item)}
                      autoFocus
                      className="flex-1"
                    />
                  </form>
                ) : (
                  <>
                    <label
                      htmlFor={`item-${item.id}`}
                      className={`flex-1 cursor-pointer transition-all ${
                        item.completed 
                          ? "line-through text-muted-foreground" 
                          : "text-foreground hover:text-primary"
                      }`}
                    >
                      {item.title}
                    </label>
                    
                    {item.completed && (
                      <Check className="w-4 h-4 text-primary" />
                    )}
                    
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-primary/10"
                        onClick={() => startEditing(item)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteItem(item.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        {/* Summary footer */}
        {items.length > 0 && (
          <div className="flex items-center justify-between pt-4 border-t border-border/50">
            <div className="text-sm text-muted-foreground">
              {pendingItems.length > 0 
                ? `${pendingItems.length} remaining`
                : "All items completed! 🎉"
              }
            </div>
            {completedItems.length > 0 && (
              <div className="text-sm font-medium text-primary">
                {completedItems.length} completed
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}