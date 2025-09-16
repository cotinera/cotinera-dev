import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Plus, Pencil, Trash2, Calendar as CalendarIcon, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface ChecklistProps {
  tripId?: number;
}

export function Checklist({ tripId }: ChecklistProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newItemTitle, setNewItemTitle] = useState("");
  const [newItemAssignedTo, setNewItemAssignedTo] = useState<string>("");
  const [newItemDeadline, setNewItemDeadline] = useState<Date | undefined>(undefined);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingAssignedTo, setEditingAssignedTo] = useState<string>("");
  const [editingDeadline, setEditingDeadline] = useState<Date | undefined>(undefined);

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

  const { data: participants = [] } = useQuery({
    queryKey: [`/api/trips/${tripId}/participants`],
    queryFn: async () => {
      const res = await fetch(`/api/trips/${tripId}/participants`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error('Failed to fetch participants');
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
    mutationFn: async (data: { title: string; assignedTo?: number; deadline?: string }) => {
      const res = await fetch(`/api/trips/${tripId}/checklist`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
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
      setNewItemAssignedTo("");
      setNewItemDeadline(undefined);
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
    mutationFn: async ({ id, title, completed, assignedTo, deadline }: Partial<ChecklistItem> & { id: number }) => {
      const res = await fetch(`/api/trips/${tripId}/checklist/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title, completed, assignedTo, deadline }),
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
      setEditingAssignedTo("");
      setEditingDeadline(undefined);
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

    createItem.mutate({
      title: newItemTitle,
      assignedTo: newItemAssignedTo ? parseInt(newItemAssignedTo) : undefined,
      deadline: newItemDeadline ? newItemDeadline.toISOString() : undefined,
    });
  };

  const startEditing = (item: ChecklistItem) => {
    setEditingId(item.id);
    setEditingTitle(item.title);
    setEditingAssignedTo(item.assignedTo ? item.assignedTo.toString() : "");
    setEditingDeadline(item.deadline ? new Date(item.deadline) : undefined);
  };

  const handleEditSubmit = (item: ChecklistItem) => {
    if (editingTitle.trim() === "") {
      return;
    }
    updateItem.mutate({ 
      id: item.id, 
      title: editingTitle, 
      completed: item.completed,
      assignedTo: editingAssignedTo ? parseInt(editingAssignedTo) : undefined,
      deadline: editingDeadline || null,
    });
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
    <Card data-tutorial="checklist">
      <CardHeader>
        <CardTitle>Trip Checklist</CardTitle>
        <CardDescription>Track your trip preparation tasks</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3 mb-4">
          <div className="flex gap-2">
            <Input
              placeholder="Add new item..."
              value={newItemTitle}
              onChange={(e) => setNewItemTitle(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" size="icon" disabled={createItem.isPending}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex gap-2">
            <Select value={newItemAssignedTo} onValueChange={setNewItemAssignedTo}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Assign to..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No assignee</SelectItem>
                {participants.map((participant: any) => (
                  <SelectItem key={participant.id} value={participant.userId?.toString() || participant.id.toString()}>
                    {participant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "flex-1 justify-start text-left font-normal",
                    !newItemDeadline && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {newItemDeadline ? format(newItemDeadline, "PPP") : "Set deadline"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={newItemDeadline}
                  onSelect={setNewItemDeadline}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </form>

        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2 p-2 rounded-md bg-muted/50 hover:bg-muted/70 transition-colors group"
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
                  className="flex-1 space-y-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleEditSubmit(item);
                  }}
                >
                  <Input
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    autoFocus
                    placeholder="Task title"
                  />
                  <div className="flex gap-2">
                    <Select value={editingAssignedTo} onValueChange={setEditingAssignedTo}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Assign to..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">No assignee</SelectItem>
                        {participants.map((participant: any) => (
                          <SelectItem key={participant.id} value={participant.userId?.toString() || participant.id.toString()}>
                            {participant.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "flex-1 justify-start text-left font-normal",
                            !editingDeadline && "text-muted-foreground"
                          )}
                          type="button"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {editingDeadline ? format(editingDeadline, "PPP") : "Set deadline"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={editingDeadline}
                          onSelect={setEditingDeadline}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" className="flex-1">
                      Save
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => {
                        setEditingId(null);
                        setEditingTitle("");
                        setEditingAssignedTo("");
                        setEditingDeadline(undefined);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex-1">
                    <label
                      htmlFor={`item-${item.id}`}
                      className={`block cursor-pointer ${
                        item.completed ? "line-through text-muted-foreground" : ""
                      }`}
                    >
                      {item.title}
                    </label>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      {(item as any).assignedUser && (
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span>{(item as any).assignedUser.name}</span>
                        </div>
                      )}
                      {item.deadline && (
                        <div className="flex items-center gap-1">
                          <CalendarIcon className="h-3 w-3" />
                          <span>{format(new Date(item.deadline), "MMM d, yyyy")}</span>
                        </div>
                      )}
                    </div>
                  </div>
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