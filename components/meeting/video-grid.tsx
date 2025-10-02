// 'use client'

"use client"

import { useEffect, useMemo, useRef } from "react"
import { useMeeting } from "@/context/meeting-context"
import { cn } from "@/lib/utils"

function useAttachStream(stream?: MediaStream, muted?: boolean) {
  const ref = useRef<HTMLVideoElement | null>(null)
  useEffect(() => {
    if (ref.current && stream) {
      ref.current.srcObject = stream
      ref.current.muted = !!muted
      ref.current.play().catch(() => {
        // Autoplay might be blocked on some browsers
      })
    }
  }, [stream, muted])
  return ref
}

export default function VideoGrid() {
  const { self, participants, activeSpeakerId } = useMeeting()

  const items = useMemo(() => {
    const list = []
    if (self) {
      list.push({
        id: self.id,
        name: self.name ?? "You",
        stream: self.stream,
        isSelf: true,
      })
    }
    for (const p of participants) {
      list.push({
        id: p.id,
        name: p.name,
        stream: p.stream,
        isSelf: false,
      })
    }
    return list
  }, [participants, self])

  // Compute grid columns based on count (max 4 columns)
  const columns = useMemo(() => {
    const n = Math.max(1, Math.min(4, Math.ceil(Math.sqrt(items.length))))
    return n
  }, [items.length])

  return (
    <div className="p-3 md:p-4 h-full overflow-hidden">
      <div className="grid gap-3 md:gap-4 h-full" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {items.map((tile) => (
          <VideoTile
            key={tile.id}
            id={tile.id}
            name={tile.name}
            stream={tile.stream}
            isSelf={tile.isSelf}
            isActive={activeSpeakerId === tile.id}
          />
        ))}
      </div>
    </div>
  )
}

function VideoTile({
  id,
  name,
  stream,
  isSelf,
  isActive,
}: {
  id: string
  name: string
  stream?: MediaStream
  isSelf?: boolean
  isActive?: boolean
}) {
  const ref = useAttachStream(stream, isSelf)

  return (
    <div
      className={cn(
        "relative rounded-lg overflow-hidden bg-muted border transition-shadow",
        isActive ? "ring-2 ring-primary shadow-[0_0_0_3px_var(--color-primary)]" : "border-border",
      )}
    >
      <video ref={ref} className="w-full h-full object-cover bg-black" playsInline autoPlay />
      <div className="absolute bottom-2 left-2 text-xs px-2 py-1 rounded-md bg-background/60 backdrop-blur border border-border">
        {name}
        {isSelf && <span className="ml-1 text-muted-foreground">(You)</span>}
      </div>
    </div>
  )
}
