import React, { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Phone } from "lucide-react";

const inviteSchema = z.object({
  email: z.string().optional(),
  phone: z.string().optional(),
  role: z.enum(["viewer", "editor", "admin"]).default("viewer"),
  inviteMethod: z.enum(["email", "phone"]).default("email")
}).refine((data) => {
  if (data.inviteMethod === "email") {
    return data.email && z.string().email().safeParse(data.email).success;
  }
  if (data.inviteMethod === "phone") {
    return data.phone && data.phone.length >= 10 && /^\+?[\d\s\-\(\)]+$/.test(data.phone);
  }
  return false;
}, {
  message: "Please provide valid contact information",
  path: ["email"] // Will be overridden in the component
});

type InviteFormValues = z.infer<typeof inviteSchema>;

interface InviteUserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: number;
}

export function InviteUserDialog({ isOpen, onClose, tripId }: InviteUserDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [inviteMethod, setInviteMethod] = useState<"email" | "phone">("email");

  const form = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: "",
      phone: "",
      role: "viewer",
      inviteMethod: "email"
    }
  });

  const inviteMutation = useMutation({
    mutationFn: async (values: InviteFormValues) => {
      const response = await fetch(`/api/trips/${tripId}/invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Failed to invite user");
      }
      
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Invitation sent",
        description: "The user has been invited to join the trip",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/trips/${tripId}/participants`] });
      form.reset();
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InviteFormValues) => {
    // Validate based on invite method
    if (data.inviteMethod === "email" && !data.email) {
      form.setError("email", { message: "Email is required" });
      return;
    }
    if (data.inviteMethod === "phone" && !data.phone) {
      form.setError("phone", { message: "Phone number is required" });
      return;
    }
    
    inviteMutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Invite User</DialogTitle>
          <DialogDescription>
            Send an invitation to collaborate on this trip. Choose to invite by email or phone number.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <Tabs 
              value={inviteMethod} 
              onValueChange={(value) => {
                const method = value as "email" | "phone";
                setInviteMethod(method);
                form.setValue("inviteMethod", method);
                // Clear the other field when switching
                if (method === "email") {
                  form.setValue("phone", "");
                  form.clearErrors("phone");
                } else {
                  form.setValue("email", "");
                  form.clearErrors("email");
                }
              }}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email
                </TabsTrigger>
                <TabsTrigger value="phone" className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Phone
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="email">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="user@example.com"
                          type="email"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>
              
              <TabsContent value="phone">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="+1 (555) 123-4567"
                          type="tel"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>
            </Tabs>

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Permission Level</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a permission level" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="viewer">Viewer (can view only)</SelectItem>
                      <SelectItem value="editor">Editor (can edit details)</SelectItem>
                      <SelectItem value="admin">Admin (full access)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={inviteMutation.isPending}>
                {inviteMutation.isPending ? "Sending invitation..." : "Send Invitation"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}