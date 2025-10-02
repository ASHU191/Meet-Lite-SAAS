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
  const { self, participants, activeSpeakerId, presenterId, compactView } = useMeeting()

  const items = useMemo(() => {
    const list: { id: string; name: string; stream?: MediaStream; isSelf: boolean }[] = []
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

  const presenter = useMemo(() => items.find((t) => t.id === presenterId), [items, presenterId])
  const others = useMemo(() => items.filter((t) => t.id !== presenterId), [items, presenterId])

  const columns = useMemo(() => {
    if (presenter) return 1
    const base = Math.ceil(Math.sqrt(items.length))
    const maxCols = compactView ? 5 : 4
    return Math.max(1, Math.min(maxCols, base + (compactView ? 1 : 0)))
  }, [items.length, presenter, compactView])

  if (presenter) {
    return (
      <div className="p-3 md:p-4 h-full min-h-0 flex flex-col gap-3 md:gap-4">
        <div className="flex-1 min-h-0 h-full rounded-lg overflow-hidden bg-muted border border-border">
          <VideoTile
            id={presenter.id}
            name={presenter.name}
            stream={presenter.stream}
            isSelf={presenter.isSelf}
            isActive={activeSpeakerId === presenter.id}
            isPresenter
          />
        </div>
        <div className="grid grid-flow-col auto-cols-[140px] md:auto-cols-[160px] gap-3 overflow-x-auto pb-1">
          {others.map((tile) => (
            <div key={tile.id} className="rounded-lg overflow-hidden bg-muted border border-border">
              <VideoTile
                id={tile.id}
                name={tile.name}
                stream={tile.stream}
                isSelf={tile.isSelf}
                isActive={activeSpeakerId === tile.id}
                thumb
              />
            </div>
          ))}
        </div>
      </div>
    )
  }

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
            compact={compactView}
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
  compact,
  thumb,
  isPresenter,
}: {
  id: string
  name: string
  stream?: MediaStream
  isSelf?: boolean
  isActive?: boolean
  compact?: boolean
  thumb?: boolean
  isPresenter?: boolean
}) {
  const ref = useAttachStream(stream, isSelf)

  return (
    <div
      className={cn(
        "relative h-full min-h-0 w-full bg-muted border transition-shadow",
        "rounded-lg overflow-hidden",
        isActive ? "ring-2 ring-primary shadow-[0_0_0_3px_var(--color-primary)]" : "border-border",
        thumb && "aspect-video h-auto w-[140px] md:w-[160px]",
      )}
    >
      <video
        ref={ref}
        className={cn(
          "w-full h-full",
          isPresenter ? "object-contain bg-black" : "object-cover bg-black",
          compact && !thumb && !isPresenter && "scale-[0.96]",
        )}
        playsInline
        autoPlay
      />
      <div className="absolute bottom-2 left-2 text-xs px-2 py-1 rounded-md bg-background/60 backdrop-blur border border-border">
        {name}
        {isSelf && <span className="ml-1 text-muted-foreground">(You)</span>}
      </div>
    </div>
  )
}
