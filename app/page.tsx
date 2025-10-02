// 'use client' for interactive landing
"use client"

import { useRouter } from "next/navigation"
import { useCallback, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { ThemeToggle } from "@/components/theme-toggle"

function generateMeetingId() {
  // Simple frontend-only random ID (10-char base36)
  return Math.random().toString(36).slice(2, 12)
}

export default function HomePage() {
  const router = useRouter()
  const [meetingId, setMeetingId] = useState("")
  const [error, setError] = useState<string | null>(null)

  const onCreate = useCallback(() => {
    const id = generateMeetingId()
    router.push(`/meeting/${id}`)
  }, [router])

  const canJoin = useMemo(() => meetingId.trim().length >= 4, [meetingId])

  const onJoin = useCallback(() => {
    if (!canJoin) {
      setError("Please enter a valid meeting ID")
      return
    }
    router.push(`/meeting/${meetingId.trim()}`)
  }, [canJoin, meetingId, router])

  return (
    <main className="min-h-[100svh] flex flex-col">
      <header className="w-full border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-md bg-primary" aria-hidden />
            <span className="font-semibold">Meet Lite</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <section className="flex-1">
        <div className="mx-auto max-w-6xl px-4 py-12 md:py-20 grid md:grid-cols-2 gap-8 items-center">
          <div className="space-y-6">
            <h1 className="text-4xl md:text-5xl font-semibold text-balance">
              Simple, private video meetings in your browser.
            </h1>
            <p className="text-muted-foreground text-pretty">
              Start or join a meeting instantly. No accounts. No servers. Built with WebRTC + PeerJS, all in your
              browser.
            </p>
            <div className="flex items-center gap-3">
              <Button onClick={onCreate} className="h-11 px-6">
                Create meeting
              </Button>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Enter meeting ID"
                  value={meetingId}
                  onChange={(e) => setMeetingId(e.target.value)}
                  className="h-11 w-44"
                />
                <Button variant="secondary" className="h-11" onClick={onJoin} disabled={!canJoin}>
                  Join
                </Button>
              </div>
            </div>
            {error && <p className="text-destructive-foreground/90 text-sm">{error}</p>}
          </div>

          <Card className={cn("p-4 md:p-6 bg-card/60 border-border")}>
            <div className="aspect-video rounded-lg bg-muted grid place-items-center text-muted-foreground">
              <div className="text-center">
                <div className="animate-in fade-in-0 zoom-in-95 duration-500">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <div className="size-2 rounded-full bg-primary animate-pulse" />
                    <div className="size-2 rounded-full bg-primary/70 animate-pulse [animation-delay:120ms]" />
                    <div className="size-2 rounded-full bg-primary/50 animate-pulse [animation-delay:240ms]" />
                  </div>
                  <p className="text-sm">Preview area</p>
                  <p className="text-xs">Your camera and mic permissions are requested after joining</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-muted-foreground flex items-center justify-between">
          <span>Made with ❤️ by Arsalan Aftab </span>
          <span>© 2025 Meet Lite. All rights reserved</span>
        </div>
      </footer>
    </main>
  )
}
