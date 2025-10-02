// 'use client'

"use client"

import { useEffect, useRef, useState } from "react"
import { useMeeting } from "@/context/meeting-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function ChatSidebar() {
  const { messages, sendMessage, self } = useMeeting()
  const [text, setText] = useState("")
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length])

  return (
    <div className="h-full grid grid-rows-[auto,1fr,auto]">
      <div className="px-3 md:px-4 py-3 border-b border-border">
        <h2 className="font-medium">In-call chat</h2>
      </div>
      <div className="overflow-y-auto px-3 md:px-4 py-3 space-y-3">
        {messages.map((m) => {
          const isSelf = m.senderId === self?.id
          return (
            <div key={m.id} className="flex flex-col">
              <div className="text-xs text-muted-foreground">
                {isSelf ? "You" : m.senderName} • {new Date(m.timestamp).toLocaleTimeString()}
              </div>
              <div className="text-sm">{m.text}</div>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>
      <div className="p-3 md:p-4 border-t border-border">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Type a message..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && text.trim().length > 0) {
                sendMessage(text.trim())
                setText("")
              }
            }}
          />
          <Button
            onClick={() => {
              if (text.trim().length > 0) {
                sendMessage(text.trim())
                setText("")
              }
            }}
          >
            Send
          </Button>
        </div>
      </div>
    </div>
  )
}
