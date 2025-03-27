import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface ViewToggleProps {
  views: {
    id: string;
    label: string;
    icon: React.ReactNode;
  }[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
}

export function ViewToggle({
  views,
  value,
  onValueChange,
  className = ""
}: ViewToggleProps) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={onValueChange}
      className={`${className}`}
    >
      {views.map((view) => (
        <ToggleGroupItem 
          key={view.id} 
          value={view.id}
          aria-label={view.label}
          className="flex items-center gap-2 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          {view.icon}
          <span>{view.label}</span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}