"use client";


import { useChat, Message } from "@ai-sdk/react";
import { useState, useEffect } from "react";
import type { FormEvent, ReactNode } from "react";
import { toast } from "sonner";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";
import type { ToolInvocationUIPart } from "@ai-sdk/ui-utils";
import React from "react";
import { createClient } from '@/utils/supabase/client';

import { ChatMessageBubble } from "@/components/ChatMessageBubble";
import { IntermediateStep } from "@/components/IntermediateStep";
import { LoadingBubble } from "@/components/LoadingBubble";
import { Button } from "./ui/button";
import { ArrowDown, LoaderCircle, Paperclip } from "lucide-react";
import { Checkbox } from "./ui/checkbox";
import { cn } from "@/lib/utils";

interface ChatMessage extends Message {
    timestamp: string;
    name?: string;
}

function ChatMessages(props: {
  messages: ChatMessage[];
  emptyStateComponent: ReactNode;
  sourcesForMessages: Record<string, any>;
  aiEmoji?: string;
  className?: string;
  isLoading?: boolean;
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
      {props.isLoading && <LoadingBubble />}
      <div ref={messagesEndRef} />
    </div>
  );
}

export function ChatInput(props: {
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onStop?: () => void;
  onClear?: () => void;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  loading?: boolean;
  placeholder?: string;
  children?: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  const disabled = props.loading && props.onStop == null;
  const [isRecording, setIsRecording] = useState(false);

  const startVoiceRecognition = () => {
    if (!('webkitSpeechRecognition' in window)) {
      toast.error('Speech recognition is not supported in your browser');
      return;
    }

    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      // Create a synthetic event to update the input
      const syntheticEvent = {
        target: { value: props.value + transcript }
      } as React.ChangeEvent<HTMLInputElement>;
      props.onChange(syntheticEvent);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsRecording(false);
      toast.error('Error recording voice input');
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
  };

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
          className="font-alchemist border-none outline-none bg-transparent p-4"
        />

        <div className="flex justify-between ml-2 mr-2 mb-2">
          <div className="flex gap-3">
            {props.children}
            <Button 
              type="button" 
              variant="destructive" 
              onClick={props.onClear}
              className="self-end font-alchemist text-xl"
            >
              Clear History
            </Button>
          </div>

          <div className="flex gap-2 self-end">
            {props.actions}
            <Button 
              type="button"
              onClick={startVoiceRecognition}
              className={cn(
                "self-end",
                isRecording && "bg-red-500 hover:bg-red-600"
              )}
              disabled={disabled || isRecording}
            >
              <span className="font-alchemist text-xl">
                {isRecording ? "Scribing Sound" : "🗣️"}
              </span>
            </Button>
            <Button type="submit" className="self-end" disabled={disabled}>
              {props.loading ? (
                <span role="status" className="flex justify-center">
                  <LoaderCircle className="animate-spin" />
                  <span className="sr-only">Loading...</span>
                </span>
              ) : (
                <span className="font-alchemist text-xl">Send</span>
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
  onConversationCreated?: (id: string, conversation: any) => void;
  onConversationUpdated?: (conversation: any) => void;
}) {
  const [sourcesForMessages, setSourcesForMessages] = useState<
    Record<string, any>
  >({});

  const chat = useChat({
    api: props.endpoint,
    id: props.headers?.['X-Conversation-Id'],
    initialMessages: [],
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
                  const update = JSON.parse(jsonContent) as ChatMessage;
                  
                  // Update the last message with the new content
                  chat.setMessages(messages => {
                    const lastMessage = messages[messages.length - 1] as ChatMessage;
                    if (lastMessage && 
                        lastMessage.role === update.role && 
                        lastMessage.name === update.name) {
                      const newMessages = [
                        ...messages.slice(0, -1),
                        {
                          ...lastMessage,
                          content: lastMessage.content + update.content,
                          timestamp: new Date().toISOString()
                        }
                      ];
                      // Save messages immediately after update
                      saveConversation(props.headers?.['X-Conversation-Id'] || '', newMessages);
                      return newMessages;
                    }
                    // Create new message if role or name is different
                    const newMessages = [
                      ...messages,
                      {
                        ...update,
                        id: messages.length.toString(),
                        timestamp: new Date().toISOString(),
                        content: update.content || ''
                      }
                    ];
                    // Save messages immediately after update
                    saveConversation(props.headers?.['X-Conversation-Id'] || '', newMessages);
                    return newMessages;
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
        chat.setMessages(prevMessages => {
          const newMessages = [...prevMessages.slice(0, -1), messageWithTimestamp];
          // Save conversation after updating messages
          saveConversation(props.headers?.['X-Conversation-Id'] || '', newMessages);
          return newMessages;
        });
      } else {
        // Save conversation even if message already has timestamp
        saveConversation(props.headers?.['X-Conversation-Id'] || '', chat.messages);
      }
    },
    onError: (e) =>
      toast.error(`Error while processing your request`, {
        description: e.message,
      }),
  });

  // Add effect to save messages whenever they change
  useEffect(() => {
    if (chat.messages.length > 0) {
      saveConversation(props.headers?.['X-Conversation-Id'] || '', chat.messages);
    }
  }, [chat.messages, props.headers]);

  const saveConversation = async (conversationId: string, messages: Message[]) => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || messages.length === 0) return;

    const messagesWithTimestamp = messages.map(msg => ({
      ...msg,
      timestamp: (msg as ChatMessage).timestamp || new Date().toISOString()
    }));

    if (conversationId) {
      // Update existing conversation
      const { data, error } = await supabase
        .from('conversations')
        .upsert({
          id: conversationId,
          user_uuid: session.user.id,
          messages: messagesWithTimestamp,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving conversation:', error);
        toast.error('Failed to save conversation');
      } else if (data && props.onConversationUpdated) {
        props.onConversationUpdated(data);
      }
    } else if (messages.length > 0) {
      // Create new conversation only if there are messages
      const { data, error } = await supabase
        .from('conversations')
        .insert({
          user_uuid: session.user.id,
          messages: messagesWithTimestamp,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating conversation:', error);
        toast.error('Failed to create conversation');
      } else if (data) {
        // Update the conversation ID in the headers
        if (props.headers) {
          props.headers['X-Conversation-Id'] = data.id;
        }
        // Notify parent component about the new conversation
        props.onConversationCreated?.(data.id, data);
      }
    }
  };

  async function sendMessage(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (chat.isLoading) return;

    try {
      // If we don't have a conversation ID, create one first
      if (!props.headers?.['X-Conversation-Id']) {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // Create new empty conversation
        const { data, error } = await supabase
          .from('conversations')
          .insert({
            user_uuid: session.user.id,
            messages: [],
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (error) {
          console.error('Error creating new conversation:', error);
          toast.error('Failed to create new conversation');
          return;
        }

        if (data) {
          // Update headers with new conversation ID
          if (props.headers) {
            props.headers['X-Conversation-Id'] = data.id;
          }
          // Notify parent about new conversation
          props.onConversationCreated?.(data.id, data);
        }
      }

      chat.handleSubmit(e);
    } catch (error) {
      console.error("Error sending message:", error);
    }
  }

  const clearHistory = () => {
    chat.setMessages([]);
    setSourcesForMessages({});
    // If we have a conversation ID, update it to empty in Supabase
    if (props.headers?.['X-Conversation-Id']) {
      saveConversation(props.headers['X-Conversation-Id'], []);
    }
  };

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
            isLoading={chat.isLoading}
          />
        )
      }
      footer={
        <ChatInput
          value={chat.input}
          onChange={chat.handleInputChange}
          onSubmit={sendMessage}
          onClear={clearHistory}
          loading={chat.isLoading}
          placeholder={props.placeholder ?? "What's it like to be a pirate?"}
        >
        </ChatInput>
      }
    />
  );
}