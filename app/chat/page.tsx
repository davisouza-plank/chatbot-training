'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { ChatWindow } from '@/components/ChatWindow'

export default function ChatPage() {
  const supabase = createClient()
  const [authHeader, setAuthHeader] = useState<string>('')

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
    return <div className="flex h-[calc(100vh-4rem)] w-4/5 mx-auto items-center justify-center">Loading...</div>
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] w-4/5 mx-auto relative">
      <div className="absolute inset-0 overflow-hidden">
        <ChatWindow
          endpoint="/api/chat/multi"
          emptyStateComponent={
            <div className="text-center">
              <h1 className="text-2xl font-bold mb-4">Welcome to the Chat!</h1>
              <p>Start a conversation by typing a message below.</p>
            </div>
          }
          placeholder="How's the weather in San Francisco?"
          showIntermediateStepsToggle={false}
          headers={{
            'Authorization': authHeader
          }}
        />
      </div>
    </div>
  )
} 