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
  onNewConversation
}: { 
  currentConversationId?: string;
  onConversationSelect: (id: string) => void;
  onNewConversation: () => void;
}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const fetchConversations = async () => {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_uuid', session.user.id)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error fetching conversations:', error);
        toast.error('Failed to load conversations');
        setIsLoading(false);
        return;
      }

      setConversations(data || []);
      setIsLoading(false);
    };

    fetchConversations();

    // Subscribe to changes
    const channel = supabase
      .channel('conversations_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations'
        },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [supabase]);

  const deleteConversation = async (id: string) => {
    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting conversation:', error);
      toast.error('Failed to delete conversation');
      return;
    }
    setConversations(conversations.filter(c => c.id !== id));

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