import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Upload } from "lucide-react";

interface ImageUploadProps {
  tripId: number;
  currentImage?: string;
  onSuccess: (imageUrl: string) => void;
}

export function ImageUpload({ tripId, currentImage, onSuccess }: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append('image', file);

    try {
      setIsUploading(true);
      const response = await fetch(`/api/trips/${tripId}/image`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = await response.json();
      onSuccess(data.imageUrl);
      
      toast({
        title: "Success",
        description: "Trip image updated successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to upload image",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {currentImage && (
        <img
          src={currentImage}
          alt="Trip thumbnail"
          className="w-full h-48 object-cover rounded-lg"
        />
      )}
      <Button
        variant="outline"
        className="w-full"
        disabled={isUploading}
        asChild
      >
        <label className="cursor-pointer">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
            disabled={isUploading}
          />
          <Upload className="mr-2 h-4 w-4" />
          {isUploading ? "Uploading..." : "Upload Image"}
        </label>
      </Button>
    </div>
  );
}
