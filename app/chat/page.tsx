'use client'

import { useEffect, useState, Suspense } from 'react'
import { createClient } from '@/utils/supabase/client'
import { ChatWindow } from '@/components/ChatWindow'
import { ConversationSidebar } from '@/components/ConversationSidebar'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'

export default function ChatPage() {
  const supabase = createClient()
  const [authHeader, setAuthHeader] = useState<string>('')
  const router = useRouter()

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        setAuthHeader(`Bearer ${session.access_token}`)
      }
    }
    getSession()
  }, [supabase.auth])

  if (!authHeader) {
    return <div className="flex h-[calc(100vh-4rem)] items-center justify-center">Loading...</div>
  }

  return (
    <Suspense fallback={<div className="flex h-[calc(100vh-4rem)] items-center justify-center">Loading...</div>}>
      <ChatPageContent authHeader={authHeader} />
    </Suspense>
  )
}

function ChatPageContent({ authHeader }: { authHeader: string }) {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const conversationId = searchParams.get('id')
  const [conversations, setConversations] = useState<Array<{
    id: string;
    user_uuid: string;
    messages: any[];
    created_at: string;
    updated_at: string;
  }>>([])
  const [isLoading, setIsLoading] = useState(true)

  // Fetch initial conversations
  useEffect(() => {
    const fetchConversations = async () => {
      setIsLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setIsLoading(false)
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
      } else {
        setConversations(data || []);
      }
      setIsLoading(false);
    };

    fetchConversations();
  }, [supabase]);

  const handleConversationSelect = (id: string) => {
    router.push(`/chat?id=${id}`)
  }

  const handleNewConversation = async () => {
    const { data: { session } } = await supabase.auth.getSession()
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
      // Update local state immediately
      setConversations(prev => [data, ...prev]);
      router.push(`/chat?id=${data.id}`)
    }
  }

  const handleConversationCreated = (id: string, conversation: any) => {
    if (!conversationId) {
      router.push(`/chat?id=${id}`);
    }
    // Update conversations list immediately
    setConversations(prev => [conversation, ...prev]);
  }

  const handleConversationUpdated = (updatedConversation: any) => {
    setConversations(prev => 
      prev.map(conv => 
        conv.id === updatedConversation.id ? updatedConversation : conv
      ).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      <ConversationSidebar 
        currentConversationId={conversationId || undefined}
        onConversationSelect={handleConversationSelect}
        onNewConversation={handleNewConversation}
        conversations={conversations}
        setConversations={setConversations}
        isLoading={isLoading}
      />
      <div className="flex-1 pr-20">
        <div className="h-full relative">
          <div className="absolute inset-0 overflow-hidden">
            <ChatWindow
              key={conversationId || 'new'}
              endpoint="/api/chat/multi"
              emptyStateComponent={
                <div className="text-center">
                  <h1 className="font-unzialish text-3xl font-bold mb-4">Welcome to the Inner Chambers!</h1>
                  <p className="font-mysticora text-xl w-1/2 mx-auto">Start a conversation with <span className="text-blue-300">Merlin</span> and the other wizards <br/> - <span className="text-emerald-300">Tempest</span> (Weather) and <span className="text-amber-300">Chronicle</span> (News) - <br/> by typing a message below</p>
                </div>
              }
              placeholder="How's the weather in San Francisco?"
              showIntermediateStepsToggle={false}
              headers={{
                'Authorization': authHeader,
                'X-Conversation-Id': conversationId || ''
              }}
              onConversationCreated={handleConversationCreated}
              onConversationUpdated={handleConversationUpdated}
            />
          </div>
        </div>
      </div>
    </div>
  )
} 