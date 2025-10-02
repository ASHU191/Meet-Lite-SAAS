"use client"

import { useEffect, useState } from "react"
import { MeetingProvider, useMeeting } from "@/context/meeting-context"
import VideoGrid from "./video-grid"
import ControlsBar from "./controls-bar"
import ChatSidebar from "./chat-sidebar"
import JoinDialog from "./join-dialog"
import { cn } from "@/lib/utils"

export default function MeetingRoom({ meetingId }: { meetingId: string }) {
  return (
    <MeetingProvider meetingId={meetingId}>
      <RoomInner />
    </MeetingProvider>
  )
}

function RoomInner() {
  const { connected, self, participants, messages, isHost, joinRequested, roomFull } = useMeeting()
  const [showChat, setShowChat] = useState(true)

  useEffect(() => {
    if (roomFull) {
      alert("This meeting is full (max 20).")
    }
  }, [roomFull])

  return (
    <main className="h-[100svh] grid grid-rows-[auto,1fr,auto]">
      <header className="border-b border-border px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-6 rounded-md bg-primary" aria-hidden />
          <div className="flex items-center gap-2">
            <h1 className="font-medium">Meet Lite</h1>
            <span className="text-xs text-muted-foreground">({isHost ? "Host" : "Guest"})</span>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">{connected ? "Connected" : "Connecting..."}</div>
      </header>

      <section className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[1fr,360px] gap-0">
        <div className="relative h-full min-h-0">
          <VideoGrid />
          {/* Active speaker glow hint */}
          <div className="pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_top,transparent,black_80%)]" />
        </div>
        <aside className={cn("border-l border-border min-h-0", showChat ? "block" : "hidden lg:block")}>
          <ChatSidebar />
        </aside>
      </section>

      <footer className="border-t border-border">
        <ControlsBar onToggleChat={() => setShowChat((v) => !v)} chatOpen={showChat} />
      </footer>

      {joinRequested && <JoinDialog />}
    </main>
  )
}
