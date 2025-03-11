"use client";


import { useChat, Message } from "@ai-sdk/react";
import { useState, useEffect } from "react";
import type { FormEvent, ReactNode } from "react";
import { toast } from "sonner";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";
import type { ToolInvocationUIPart } from "@ai-sdk/ui-utils";
import React from "react";

import { ChatMessageBubble } from "@/components/ChatMessageBubble";
import { IntermediateStep } from "@/components/IntermediateStep";
import { Button } from "./ui/button";
import { ArrowDown, LoaderCircle, Paperclip } from "lucide-react";
import { Checkbox } from "./ui/checkbox";
import { cn } from "@/lib/utils";

interface ChatMessage extends Message {
    timestamp: string;
}

function ChatMessages(props: {
  messages: ChatMessage[];
  emptyStateComponent: ReactNode;
  sourcesForMessages: Record<string, any>;
  aiEmoji?: string;
  className?: string;
}) {
  const { scrollToBottom } = useStickToBottomContext();
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const lastMessageLengthRef = React.useRef<number>(0);
  const isStreamingRef = React.useRef<boolean>(false);

  const scrollToBottomImmediate = React.useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
  }, []);

  // Handle new messages and streaming updates
  useEffect(() => {
    const lastMessage = props.messages[props.messages.length - 1];
    if (!lastMessage) return;

    // Check if this is a new message
    const isNewMessage = lastMessageLengthRef.current === 0;
    
    // Check if this is a streaming update
    const currentLength = lastMessage.content.length;
    const isStreaming = currentLength > lastMessageLengthRef.current;
    
    if (isNewMessage || isStreaming) {
      scrollToBottomImmediate();
      lastMessageLengthRef.current = currentLength;
      isStreamingRef.current = true;
    } else if (isStreamingRef.current) {
      // If we were streaming but content length didn't change, streaming has ended
      isStreamingRef.current = false;
    }
  }, [props.messages, scrollToBottomImmediate]);

  return (
    <div className="flex flex-col max-w-[768px] mx-auto pb-12 w-full">
      {props.messages.map((m, i) => {
        if (m.role === "system") {
          return <IntermediateStep key={m.id} message={m} />;
        }

        const sourceKey = (props.messages.length - 1 - i).toString();
        return (
          <ChatMessageBubble
            key={m.id}
            message={m}
            aiEmoji={props.aiEmoji}
            sources={props.sourcesForMessages[sourceKey]}
          />
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
}

export function ChatInput(props: {
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onStop?: () => void;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  loading?: boolean;
  placeholder?: string;
  children?: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  const disabled = props.loading && props.onStop == null;
  return (
    <form
      onSubmit={(e) => {
        e.stopPropagation();
        e.preventDefault();

        if (props.loading) {
          props.onStop?.();
        } else {
          props.onSubmit(e);
        }
      }}
      className={cn("flex w-full flex-col", props.className)}
    >
      <div className="border border-input bg-secondary rounded-lg flex flex-col gap-2 max-w-[768px] w-full mx-auto">
        <input
          value={props.value}
          placeholder={props.placeholder}
          onChange={props.onChange}
          className="border-none outline-none bg-transparent p-4"
        />

        <div className="flex justify-between ml-4 mr-2 mb-2">
          <div className="flex gap-3">{props.children}</div>

          <div className="flex gap-2 self-end">
            {props.actions}
            <Button type="submit" className="self-end" disabled={disabled}>
              {props.loading ? (
                <span role="status" className="flex justify-center">
                  <LoaderCircle className="animate-spin" />
                  <span className="sr-only">Loading...</span>
                </span>
              ) : (
                <span>Send</span>
              )}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}

function ScrollToBottom(props: { className?: string }) {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  if (isAtBottom) return null;
  return (
    <Button
      variant="outline"
      className={props.className}
      onClick={() => scrollToBottom()}
    >
      <ArrowDown className="w-4 h-4" />
      <span>Scroll to bottom</span>
    </Button>
  );
}

function StickyToBottomContent(props: {
  content: ReactNode;
  footer?: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  const context = useStickToBottomContext();

  // scrollRef will also switch between overflow: unset to overflow: auto
  return (
    <div
      ref={context.scrollRef}
      style={{ width: "100%", height: "100%" }}
      className={cn("grid grid-rows-[1fr,auto]", props.className)}
    >
      <div ref={context.contentRef} className={props.contentClassName}>
        {props.content}
      </div>

      {props.footer}
    </div>
  );
}

export function ChatLayout(props: { content: ReactNode; footer: ReactNode }) {
  return (
    <StickToBottom>
      <StickyToBottomContent
        className="absolute inset-0 flex flex-col"
        contentClassName="flex-1 overflow-y-auto py-8 px-2"
        content={props.content}
        footer={
          <div className="sticky bottom-0 px-2 py-4 bg-background border-t">
            <ScrollToBottom className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4" />
            {props.footer}
          </div>
        }
      />
    </StickToBottom>
  );
}

export function ChatWindow(props: {
  endpoint: string;
  emptyStateComponent: ReactNode;
  placeholder?: string;
  emoji?: string;
  showIngestForm?: boolean;
  showIntermediateStepsToggle?: boolean;
  headers?: Record<string, string>;
}) {
  const [showIntermediateSteps, setShowIntermediateSteps] = useState(
    !!props.showIntermediateStepsToggle,
  );
  const [intermediateStepsLoading, setIntermediateStepsLoading] =
    useState(false);

  const [sourcesForMessages, setSourcesForMessages] = useState<
    Record<string, any>
  >({});

  const chat = useChat({
    api: props.endpoint,
    onResponse(response) {
      const sourcesHeader = response.headers.get("x-sources");
      const sources = sourcesHeader
        ? JSON.parse(Buffer.from(sourcesHeader, "base64").toString("utf8"))
        : [];
      const messageIndexHeader = response.headers.get("x-message-index");
      
      // Set up the text decoder for streaming
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      if (reader) {
        // Read the stream
        const readStream = async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              
              // Decode the stream chunk
              const chunk = decoder.decode(value);
              
              // Match complete messages in the format "0:{...}"
              const messageRegex = /0:(\{(?:[^{}]|(?:\{[^{}]*\}))*\})/g;
              const matches = Array.from(chunk.matchAll(messageRegex));
              
              for (const match of matches) {
                try {
                  const jsonContent = match[1];
                  console.log(jsonContent);
                  const update = JSON.parse(jsonContent);
                  
                  // Update the last message with the new content
                  chat.setMessages(messages => {
                    const lastMessage = messages[messages.length - 1];
                    if (lastMessage && lastMessage.role === update.role) {
                      return [
                        ...messages.slice(0, -1),
                        {
                          ...lastMessage,
                          content: lastMessage.content + update.content,
                          timestamp: new Date().toISOString()
                        }
                      ];
                    }
                    return [
                      ...messages,
                      {
                        ...update,
                        id: messages.length.toString(),
                        timestamp: new Date().toISOString()
                      }
                    ];
                  });
                } catch (e) {
                  console.error("Error parsing stream chunk:", e);
                }
              }
            }
          } catch (e) {
            console.error("Error reading stream:", e);
          }
        };
        
        readStream();
      }

      if (sources.length && messageIndexHeader !== null) {
        setSourcesForMessages({
          ...sourcesForMessages,
          [messageIndexHeader]: sources,
        });
      }
    },
    onFinish(message) {
      // Add timestamp to the message if not already present
      if (!(message as ChatMessage).timestamp) {
        const messageWithTimestamp = {
          ...message,
          timestamp: new Date().toISOString()
        };
        chat.setMessages([...chat.messages.slice(0, -1), messageWithTimestamp]);
      }
    },
    onError: (e) =>
      toast.error(`Error while processing your request`, {
        description: e.message,
      }),
  });


  async function sendMessage(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (chat.isLoading || intermediateStepsLoading) return;

    if (!showIntermediateSteps) {
      try {
        chat.handleSubmit(e);
      } catch (error) {
        console.error("Error sending message:", error);
      }
      return;
    }

    // Some extra work to show intermediate steps properly
    setIntermediateStepsLoading(true);

    chat.setInput("");
    const messagesWithUserReply = chat.messages.concat({
      id: chat.messages.length.toString(),
      content: chat.input,
      role: "user",
      parts: []
    });
    chat.setMessages(messagesWithUserReply);

    const response = await fetch(props.endpoint, {
      method: "POST",
      body: JSON.stringify({
        messages: messagesWithUserReply,
        show_intermediate_steps: true,
      }),
    });
    const json = await response.json();
    setIntermediateStepsLoading(false);

    if (!response.ok) {
      toast.error(`Error while processing your request`, {
        description: json.error,
      });
      return;
    }

    const responseMessages: Message[] = json.messages;

    // Represent intermediate steps as system messages for display purposes
    // TODO: Add proper support for tool messages
    const toolCallMessages = responseMessages.filter(
      (responseMessage: Message) => {
        const toolInvocationParts = responseMessage.parts?.filter(
          part => part.type === "tool-invocation"
        );
        return (
          (responseMessage.role === "assistant" &&
            toolInvocationParts &&
            toolInvocationParts.length > 0) ||
          responseMessage.role === "data"
        );
      },
    );

    const intermediateStepMessages = [];
    for (let i = 0; i < toolCallMessages.length; i += 2) {
      const aiMessage = toolCallMessages[i];
      const toolInvocationPart = aiMessage.parts?.find(
        part => part.type === "tool-invocation"
      ) as ToolInvocationUIPart | undefined;
      const toolMessage = toolCallMessages[i + 1];
      intermediateStepMessages.push({
        id: (messagesWithUserReply.length + i / 2).toString(),
        role: "system" as const,
        content: JSON.stringify({
          action: toolInvocationPart?.toolInvocation,
          observation: toolMessage.content,
        }),
        parts: []
      });
    }
    const newMessages = messagesWithUserReply;
    for (const message of intermediateStepMessages) {
      newMessages.push(message);
      chat.setMessages([...newMessages]);
      await new Promise((resolve) =>
        setTimeout(resolve, 1000 + Math.random() * 1000),
      );
    }

    chat.setMessages([
      ...newMessages,
      {
        id: newMessages.length.toString(),
        content: responseMessages[responseMessages.length - 1].content,
        role: "assistant",
      },
    ]);
  }

  return (
    <ChatLayout
      content={
        chat.messages.length === 0 ? (
          <div>{props.emptyStateComponent}</div>
        ) : (
          <ChatMessages
            aiEmoji={props.emoji}
            messages={chat.messages.map(msg => ({
              ...msg,
              timestamp: (msg as ChatMessage).timestamp || new Date().toISOString()
            })) as ChatMessage[]}
            emptyStateComponent={props.emptyStateComponent}
            sourcesForMessages={sourcesForMessages}
          />
        )
      }
      footer={
        <ChatInput
          value={chat.input}
          onChange={chat.handleInputChange}
          onSubmit={sendMessage}
          loading={chat.isLoading || intermediateStepsLoading}
          placeholder={props.placeholder ?? "What's it like to be a pirate?"}
        >

          {props.showIntermediateStepsToggle && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="show_intermediate_steps"
                name="show_intermediate_steps"
                checked={showIntermediateSteps}
                disabled={chat.isLoading || intermediateStepsLoading}
                onCheckedChange={(e) => setShowIntermediateSteps(!!e)}
              />
              <label htmlFor="show_intermediate_steps" className="text-sm">
                Show intermediate steps
              </label>
            </div>
          )}
        </ChatInput>
      }
    />
  );
}