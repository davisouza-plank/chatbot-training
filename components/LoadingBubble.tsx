import { cn } from "@/lib/utils";

export function LoadingBubble() {
  return (
    <div className="flex items-start mb-4 mt-4">
      <div className="bg-secondary rounded-lg p-4 max-w-[85%] flex items-center gap-2">
        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.3s]" />
        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.15s]" />
        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
      </div>
    </div>
  );
} 