import { useState } from "react";
import { useShareLinks } from "@/hooks/use-share-links";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Share, Copy, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ShareTripDialogProps {
  tripId: number;
}

export function ShareTripDialog({ tripId }: ShareTripDialogProps) {
  const { createShareLink } = useShareLinks(tripId);
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [accessLevel, setAccessLevel] = useState<"view" | "edit">("view");
  const [expiresInDays, setExpiresInDays] = useState("7");

  const handleCreateShareLink = async () => {
    try {
      setIsLoading(true);
      const shareLink = await createShareLink({
        accessLevel,
        expiresInDays: parseInt(expiresInDays),
      });
      const url = `${window.location.origin}/share/${shareLink.token}`;
      setShareUrl(url);
    } catch (error) {
      console.error("Failed to create share link:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: "Success",
        description: "Share link copied to clipboard",
      });
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to copy to clipboard",
      });
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="icon">
          <Share className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Share Trip</AlertDialogTitle>
          <AlertDialogDescription>
            Create a shareable link to allow others to access this trip.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Access Level</Label>
            <Select
              value={accessLevel}
              onValueChange={(value: "view" | "edit") => setAccessLevel(value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="view">View Only</SelectItem>
                <SelectItem value="edit">Can Edit</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Expires In (Days)</Label>
            <Select
              value={expiresInDays}
              onValueChange={setExpiresInDays}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 Day</SelectItem>
                <SelectItem value="7">7 Days</SelectItem>
                <SelectItem value="30">30 Days</SelectItem>
                <SelectItem value="0">Never</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {!shareUrl ? (
            <Button
              className="w-full"
              onClick={handleCreateShareLink}
              disabled={isLoading}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Generate Share Link
            </Button>
          ) : (
            <div className="space-y-2">
              <Label>Share Link</Label>
              <div className="flex gap-2">
                <Input value={shareUrl} readOnly />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copyToClipboard}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          {shareUrl && (
            <AlertDialogAction onClick={copyToClipboard}>
              Copy Link
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}