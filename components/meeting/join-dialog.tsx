// 'use client'

"use client"

import { useState } from "react"
import { useMeeting } from "@/context/meeting-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export default function JoinDialog() {
  const { meetingId, completeJoin } = useMeeting()
  const [name, setName] = useState(typeof window !== "undefined" ? localStorage.getItem("displayName") || "" : "")

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm grid place-items-center z-50">
      <div className={cn("w-[92%] max-w-md rounded-lg border border-border bg-background")}>
        <div className="p-4 border-b border-border">
          <h3 className="font-medium">Join meeting</h3>
          <p className="text-xs text-muted-foreground">ID: {meetingId}</p>
        </div>
        <div className="p-4 space-y-3">
          <div className="space-y-1">
            <label className="text-sm">Your name</label>
            <Input placeholder="Enter your name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <p className="text-xs text-muted-foreground">
            Your name is stored locally and used for chat and participant labels.
          </p>
        </div>
        <div className="p-4 border-t border-border flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={() => completeJoin(null)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (name.trim().length === 0) return
              completeJoin(name.trim())
            }}
          >
            Join
          </Button>
        </div>
      </div>
    </div>
  )
}
