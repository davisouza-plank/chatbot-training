import { cn } from "@/lib/utils";
import type { Message as BaseMessage } from "ai/react";
import DOMPurify from 'isomorphic-dompurify';

interface Message extends BaseMessage {
  timestamp: string;
  name?: string;
}

export function ChatMessageBubble(props: {
  message: Message;
  aiEmoji?: string;
  sources: any[];
}) {
  // Function to safely render HTML content
  const createMarkup = (content: string) => {
    // Add classes to links before sanitizing
    const contentWithStyledLinks = content.replace(
      /<a\s+href="([^"]+)">/g,
      '<a href="$1" class="text-blue-500 hover:underline" target="_blank" rel="noopener noreferrer">'
    );

    const sanitizedContent = DOMPurify.sanitize(contentWithStyledLinks, {
      ALLOWED_TAGS: ['a'],
      ALLOWED_ATTR: ['href', 'target', 'rel', 'class']
    });
    return { __html: sanitizedContent };
  };

  const getAgentColor = (name?: string) => {
    switch (name) {
      case 'Merlin':
        return 'text-blue-300';
      case 'Tempest':
        return 'text-emerald-300';
      case 'Chronicle':
        return 'text-amber-300';
      default:
        return '';
    }
  };

  return (
    <div
      className={cn(
        `rounded-[24px] max-w-[80%] mb-8 flex`,
        props.message.role === "user"
          ? "bg-secondary text-secondary-foreground px-4 py-2"
          : null,
        props.message.role === "user" ? "ml-auto" : "mr-auto",
      )}
    >
      {props.message.role !== "user" && (
        <div className="flex flex-col items-center mr-4">
          <div className="border bg-secondary -mt-2 rounded-full w-10 h-10 flex-shrink-0 flex items-center justify-center">
            {props.aiEmoji}
          </div>
          {props.message.name && (
            <span className={cn("text-xs mt-1 font-medium", getAgentColor(props.message.name))}>
              {props.message.name}
            </span>
          )}
        </div>
      )}

      <div className="whitespace-pre-wrap flex flex-col">
        <span 
          className={cn(
            props.message.role === "user" ? "font-alchemist text-xl" : "font-mysticora text-2xl"
          )}
          dangerouslySetInnerHTML={createMarkup(props.message.content)} 
        />

        {props.sources && props.sources.length ? (
          <>
            <code className="mt-4 mr-auto bg-primary px-2 py-1 rounded">
              <h2>🔍 Sources:</h2>
            </code>
            <code className="mt-1 mr-2 bg-primary px-2 py-1 rounded text-xs">
              {props.sources?.map((source, i) => (
                <div className="mt-2" key={"source:" + i}>
                  {i + 1}. &quot;{source.pageContent}&quot;
                  {source.metadata?.loc?.lines !== undefined ? (
                    <div>
                      <br />
                      Lines {source.metadata?.loc?.lines?.from} to{" "}
                      {source.metadata?.loc?.lines?.to}
                    </div>
                  ) : (
                    ""
                  )}
                </div>
              ))}
            </code>
          </>
        ) : null}

        <div className="text-xs text-gray-500 mt-2 ml-auto font-cryuncial">
          {new Date(props.message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}