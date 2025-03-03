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
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";

interface ChecklistProps {
  tripId?: number;
}

export function Checklist({ tripId }: ChecklistProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newItemTitle, setNewItemTitle] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [isAddChecklist, setIsAddChecklist] = useState(false);

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
      setIsAddChecklist(false);
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

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Error</CardTitle>
          <CardDescription>Failed to load checklist</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <CardTitle>Trip Checklist</CardTitle>
          <div className="flex gap-2" data-tutorial="checklist">
            <Dialog open={isAddChecklist} onOpenChange={setIsAddChecklist}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </DialogTrigger>
              <form onSubmit={handleSubmit} className="flex gap-2 mt-2">
                <Input
                  placeholder="Add new item..."
                  value={newItemTitle}
                  onChange={(e) => setNewItemTitle(e.target.value)}
                />
                <Button type="submit" size="icon" disabled={createItem.isPending}>
                  <Plus className="h-4 w-4" />
                </Button>
              </form>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-accent group"
            >
              <Checkbox
                id={`item-${item.id}`}
                checked={item.completed || false}
                onCheckedChange={() =>
                  updateItem.mutate({ id: item.id, completed: !item.completed })
                }
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
                  />
                </form>
              ) : (
                <>
                  <label
                    htmlFor={`item-${item.id}`}
                    className={`flex-1 cursor-pointer ${
                      item.completed ? "line-through text-muted-foreground" : ""
                    }`}
                  >
                    {item.title}
                  </label>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => startEditing(item)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteItem(item.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </>
              )}
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