'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { MessageSquare, Plus, Trash2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Message } from 'ai/react';
import { toast } from 'sonner';

interface ChatMessage extends Message {
  timestamp: string;
  name?: string;
}

interface Conversation {
  id: string;
  user_uuid: string;
  messages: ChatMessage[];
  created_at: string;
  updated_at: string;
}

export function ConversationSidebar({ 
  currentConversationId,
  onConversationSelect,
  onNewConversation,
  conversations,
  setConversations,
  isLoading
}: { 
  currentConversationId?: string;
  onConversationSelect: (id: string) => void;
  onNewConversation: () => void;
  conversations: Array<{
    id: string;
    user_uuid: string;
    messages: ChatMessage[];
    created_at: string;
    updated_at: string;
  }>;
  setConversations: React.Dispatch<React.SetStateAction<Array<{
    id: string;
    user_uuid: string;
    messages: ChatMessage[];
    created_at: string;
    updated_at: string;
  }>>>;
  isLoading: boolean;
}) {
  const supabase = createClient();

  useEffect(() => {
    // Subscribe to changes for real-time updates
    const channel = supabase
      .channel('conversations_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations'
        },
        async (payload) => {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) return;

          // Handle deletion
          if (payload.eventType === 'DELETE') {
            setConversations(prev => prev.filter(conv => conv.id !== payload.old.id));
            return;
          }

          // Handle inserts and updates
          const { data } = await supabase
            .from('conversations')
            .select('*')
            .eq('id', payload.new.id)
            .single();

          if (data) {
            setConversations(prev => {
              const existing = prev.find(c => c.id === data.id);
              if (!existing) {
                // New conversation
                return [data, ...prev];
              } else {
                // Updated conversation
                return prev
                  .map(c => c.id === data.id ? data : c)
                  .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
              }
            });
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [supabase, setConversations]);

  const deleteConversation = async (id: string) => {
    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', id);

      if (error) {
        console.error('Error deleting conversation:', error);
        toast.error('Failed to delete conversation');
        // Restore the conversation in local state if deletion failed
        if (id === currentConversationId) {
          const { data } = await supabase
            .from('conversations')
            .select('*')
            .eq('id', id)
            .single();
          if (data) {
            setConversations(prev => [data, ...prev]);
          }
        }
        return;
      }
    setConversations(prev => prev.filter(c => c.id !== id));
    if (id === currentConversationId) {
      onConversationSelect('');
    }
    toast.success('Conversation deleted');
  };

  const getConversationTitle = (messages: ChatMessage[]) => {
    const firstUserMessage = messages.find(m => m.role === 'user');
    if (!firstUserMessage) return 'New Conversation';
    return firstUserMessage.content.slice(0, 30) + (firstUserMessage.content.length > 30 ? '...' : '');
  };

  return (
    <div className="w-64 h-full border-r flex flex-col">
      <div className="p-4 border-b">
        <Button 
          onClick={onNewConversation}
          className="w-full font-alchemist text-xl"
          variant="secondary"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Chat
        </Button>
      </div>
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center h-20">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="p-2 flex flex-col gap-2">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                className={cn(
                  "group flex items-center gap-2 rounded-lg p-2 text-sm hover:bg-secondary/80 cursor-pointer",
                  currentConversationId === conversation.id && "bg-secondary"
                )}
                onClick={() => onConversationSelect(conversation.id)}
              >
                <MessageSquare className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate font-mysticora">
                  {getConversationTitle(conversation.messages)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConversation(conversation.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
} 