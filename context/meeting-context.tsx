// 'use client'

"use client"

/*
  Frontend-only meeting context using PeerJS.

  Architecture:
  - First participant to load /meeting/:id becomes HOST (Peer ID = meetingId).
  - Others become GUESTS (random Peer ID), connect to HOST via data channel.
  - HOST relays: peer list, join/leave events, chat messages.
  - Media: full mesh; each GUEST calls all known peers with local stream.
  - Active speaker: Web Audio API analyser per participant; track highest volume.
*/

import type React from "react"
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import Peer, { type DataConnection, type MediaConnection } from "peerjs"
import { createVolumeMeter } from "@/lib/audio"

type ChatMessage = {
  id: string
  senderId: string
  senderName: string
  text: string
  timestamp: number
}

type Participant = {
  id: string
  name: string
  stream?: MediaStream
}

type MeetingContextValue = {
  meetingId: string
  connected: boolean
  isHost: boolean
  self: { id: string; name: string; stream?: MediaStream } | null
  participants: Participant[]
  activeSpeakerId: string | null
  messages: ChatMessage[]
  sendMessage: (text: string) => void

  // Controls
  micEnabled: boolean
  camEnabled: boolean
  isScreenSharing: boolean
  toggleMic: () => void
  toggleCam: () => void
  startScreenShare: () => Promise<void>
  stopScreenShare: () => void
  leaveMeeting: () => void

  // Join flow
  joinRequested: boolean
  completeJoin: (name: string | null) => void

  // Error
  roomFull: boolean

  presenterId: string | null
  compactView: boolean
  toggleCompactView: () => void
}

const MeetingContext = createContext<MeetingContextValue | null>(null)

export function useMeeting() {
  const ctx = useContext(MeetingContext)
  if (!ctx) throw new Error("useMeeting must be used within MeetingProvider")
  return ctx
}

export function MeetingProvider({ meetingId, children }: { meetingId: string; children: React.ReactNode }) {
  const [connected, setConnected] = useState(false)
  const [isHost, setIsHost] = useState(false)
  const [self, setSelf] = useState<{ id: string; name: string; stream?: MediaStream } | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null)
  const [micEnabled, setMicEnabled] = useState(true)
  const [camEnabled, setCamEnabled] = useState(true)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [joinRequested, setJoinRequested] = useState(true)
  const [roomFull, setRoomFull] = useState(false)
  const [presenterId, setPresenterId] = useState<string | null>(null)
  const [compactView, setCompactView] = useState<boolean>(false)

  const peerRef = useRef<Peer | null>(null)
  const hostConnRef = useRef<DataConnection | null>(null) // for guests
  const dataConnsRef = useRef<Map<string, DataConnection>>(new Map()) // host -> clients
  const callsRef = useRef<Map<string, MediaConnection>>(new Map())
  const volumesRef = useRef<Map<string, { getVolume: () => number; dispose: () => void }>>(new Map())
  const originalCameraTrackRef = useRef<MediaStreamTrack | null>(null)
  const latestSelfRef = useRef<typeof self | null>(null)

  const MAX_PARTICIPANTS = 20

  const broadcastHost = useCallback((payload: any) => {
    for (const [, conn] of dataConnsRef.current) {
      if (conn.open) conn.send(payload)
    }
  }, [])

  useEffect(() => {
    let disposed = false

    async function init() {
      const name = localStorage.getItem("displayName") || ""
      if (!name) {
        setJoinRequested(true)
        return
      }
      setJoinRequested(false)

      let localStream: MediaStream | undefined
      try {
        localStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        })
      } catch (err) {
        try {
          localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true })
          setCamEnabled(false)
        } catch {
          localStream = undefined
        }
      }

      const peer = new Peer(meetingId)
      peerRef.current = peer

      let opened = false

      function setupCommon(peerSelfId: string) {
        setSelf({ id: peerSelfId, name, stream: localStream })
        setConnected(true)

        peer.on("call", (call) => {
          call.answer(localStream || undefined)
          callsRef.current.set(call.peer, call)
          call.on("stream", (remoteStream) => {
            addOrUpdateParticipant(call.peer, undefined, remoteStream)
          })
          call.on("close", () => {
            removeParticipant(call.peer)
          })
          call.on("error", () => {
            removeParticipant(call.peer)
          })
        })

        const interval = setInterval(() => {
          let topId: string | null = null
          let topVol = 0
          for (const [pid, meter] of volumesRef.current) {
            const v = meter.getVolume()
            if (v > 20) {
              topVol = v
              topId = pid
            }
          }
          setActiveSpeakerId(topVol > 20 ? topId : null)
        }, 250)
        ;(peer as any).__volTimer = interval

        if (localStream) attachVolumeMeter(peerSelfId, localStream)
      }

      function addOrUpdateParticipant(id: string, name?: string, stream?: MediaStream) {
        setParticipants((prev) => {
          const exists = prev.find((p) => p.id === id)
          if (exists) {
            const updated = prev.map((p) =>
              p.id === id ? { ...p, name: name ?? p.name, stream: stream ?? p.stream } : p,
            )
            return updated
          }
          return [...prev, { id, name: name ?? "Guest", stream }]
        })
        if (stream) attachVolumeMeter(id, stream)
      }

      function removeParticipant(id: string) {
        setParticipants((prev) => prev.filter((p) => p.id !== id))
        const call = callsRef.current.get(id)
        if (call) call.close()
        callsRef.current.delete(id)
        const meter = volumesRef.current.get(id)
        if (meter) meter.dispose()
        volumesRef.current.delete(id)
      }

      function attachVolumeMeter(id: string, stream: MediaStream) {
        const meter = createVolumeMeter(stream)
        if (meter) {
          volumesRef.current.set(id, meter)
        }
      }

      peer.on("open", (id) => {
        if (disposed) return
        opened = true
        setIsHost(true)
        setupCommon(id)

        peer.on("connection", (conn) => {
          if (dataConnsRef.current.size + 1 >= MAX_PARTICIPANTS) {
            conn.on("open", () => {
              conn.send({ type: "room-full" })
              setRoomFull(true)
              conn.close()
            })
            return
          }

          dataConnsRef.current.set(conn.peer, conn)

          conn.on("data", (data: any) => {
            if (!data) return
            switch (data.type) {
              case "join":
                addOrUpdateParticipant(data.id, data.name)

                // Build peer list using live refs (avoids stale closure of `participants`/`self`)
                const peersForList = [...(participants || []), ...(self ? [self] : [])]

                conn.send({
                  type: "peer-list",
                  peers: peersForList,
                })

                // If we don't have a local stream, use an empty MediaStream to open the RTCPeerConnection.
                if (!callsRef.current.has(data.id)) {
                  const streamToSend = localStream ?? new MediaStream()
                  const c = peer.call(data.id, streamToSend)
                  callsRef.current.set(data.id, c)
                  c.on("stream", (remoteStream) => addOrUpdateParticipant(data.id, data.name, remoteStream))
                  c.on("close", () => removeParticipant(data.id))
                  c.on("error", () => removeParticipant(data.id))
                }

                broadcastHost({ type: "peer-joined", peer: { id: data.id, name: data.name } })
                break
              case "chat":
                const msg: ChatMessage = {
                  id: crypto.randomUUID(),
                  senderId: data.senderId,
                  senderName: data.senderName,
                  text: data.text,
                  timestamp: Date.now(),
                }
                setMessages((prev) => [...prev, msg])
                broadcastHost({ type: "chat", message: msg })
                break
              case "presenter": {
                setPresenterId(data.id ?? null)
                broadcastHost({ type: "presenter", id: data.id ?? null })
                break
              }
              default:
                break
            }
          })

          conn.on("close", () => {
            removeParticipant(conn.peer)
            broadcastHost({ type: "peer-left", id: conn.peer })
            dataConnsRef.current.delete(conn.peer)
          })
        })
      })

      peer.on("error", (err: any) => {
        if (disposed) return
        if ((err?.type || err?.name) === "unavailable-id") {
          const guest = new Peer()
          peerRef.current = guest
          guest.on("open", (myId) => {
            setIsHost(false)
            setupCommon(myId)
            const conn = guest.connect(meetingId)
            hostConnRef.current = conn
            conn.on("open", () => {
              conn.send({ type: "join", id: myId, name })
            })
            conn.on("data", (data: any) => {
              if (!data) return
              switch (data.type) {
                case "room-full":
                  setRoomFull(true)
                  break
                case "peer-list": {
                  const list: { id: string; name?: string }[] = data.peers || []
                  for (const p of list) {
                    if (p.id !== guest.id) {
                      addOrUpdateParticipant(p.id, p.name)
                      if (!callsRef.current.has(p.id)) {
                        const c = guest.call(p.id, localStream ?? new MediaStream())
                        callsRef.current.set(p.id, c)
                        c.on("stream", (remoteStream) => addOrUpdateParticipant(p.id, p.name, remoteStream))
                        c.on("close", () => removeParticipant(p.id))
                        c.on("error", () => removeParticipant(p.id))
                      }
                    }
                  }
                  break
                }
                case "peer-joined": {
                  const p = data.peer
                  if (!p) break
                  if (p.id === selfRefCurrent()?.id) break
                  addOrUpdateParticipant(p.id, p.name)
                  if (!callsRef.current.has(p.id)) {
                    const c = guest.call(p.id, localStream ?? new MediaStream())
                    callsRef.current.set(p.id, c)
                    c.on("stream", (remoteStream) => addOrUpdateParticipant(p.id, p.name, remoteStream))
                    c.on("close", () => removeParticipant(p.id))
                    c.on("error", () => removeParticipant(p.id))
                  }
                  break
                }
                case "peer-left":
                  removeParticipant(data.id)
                  break
                case "chat": {
                  const msg = data.message as ChatMessage
                  setMessages((prev) => [...prev, msg])
                  break
                }
                case "presenter": {
                  setPresenterId(data.id ?? null)
                  break
                }
                default:
                  break
              }
            })
            conn.on("close", () => {
              hostConnRef.current = null
            })
          })

          guest.on("call", (call) => {
            call.answer(localStream)
            callsRef.current.set(call.peer, call)
            call.on("stream", (remoteStream) => {
              addOrUpdateParticipant(call.peer, undefined, remoteStream)
            })
            call.on("close", () => {
              removeParticipant(call.peer)
            })
            call.on("error", () => {
              removeParticipant(call.peer)
            })
          })

          guest.on("disconnected", () => {
            setConnected(false)
          })
          guest.on("close", () => {
            setConnected(false)
          })
        }
      })

      peer.on("disconnected", () => setConnected(false))
      peer.on("close", () => setConnected(false))

      const participantsStateRef = { current: [] as { id: string; name?: string }[] }
      const selfStateRef = { current: { id: "", name: "" } as { id: string; name: string } | null }

      const unsub1 = subscribeParticipants((list) => {
        participantsStateRef.current = list.map((p) => ({ id: p.id, name: p.name }))
      })
      const unsub2 = subscribeSelf((me) => {
        selfStateRef.current = me ? { id: me.id, name: me.name } : null
      })

      if (localStream) {
        originalCameraTrackRef.current = localStream.getVideoTracks()[0] || null
      }

      return () => {
        unsub1()
        unsub2()
      }
    }

    const cleanup = init()

    return () => {
      disposed = true
      try {
        const timer = (peerRef.current as any).__volTimer as any
        if (timer) clearInterval(timer)
      } catch {}
      hostConnRef.current?.close()
      for (const [, conn] of dataConnsRef.current) conn.close()
      dataConnsRef.current.clear()
      for (const [, call] of callsRef.current) call.close()
      callsRef.current.clear()
      for (const [, meter] of volumesRef.current) meter.dispose()
      volumesRef.current.clear()
      peerRef.current?.destroy()
      setConnected(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId, joinRequested])

  const subs = useRef<Set<(ps: Participant[]) => void>>(new Set())
  const subsSelf = useRef<Set<(s: { id: string; name: string; stream?: MediaStream } | null) => void>>(new Set())
  useEffect(() => {
    for (const cb of subs.current) cb(participants)
  }, [participants])
  useEffect(() => {
    for (const cb of subsSelf.current) cb(self)
  }, [self])
  function subscribeParticipants(cb: (p: Participant[]) => void) {
    subs.current.add(cb)
    return () => subs.current.delete(cb)
  }
  function subscribeSelf(cb: (s: { id: string; name: string; stream?: MediaStream } | null) => void) {
    subsSelf.current.add(cb)
    return () => subsSelf.current.delete(cb)
  }

  const sendMessage = useCallback(
    (text: string) => {
      const me = self
      if (!me) return
      const msg: ChatMessage = {
        id: crypto.randomUUID(),
        senderId: me.id,
        senderName: me.name,
        text,
        timestamp: Date.now(),
      }
      setMessages((prev) => [...prev, msg])

      if (isHost) {
        for (const [, conn] of dataConnsRef.current) {
          if (conn.open) conn.send({ type: "chat", message: msg })
        }
      } else {
        const conn = hostConnRef.current
        if (conn?.open) conn.send({ type: "chat", senderId: me.id, senderName: me.name, text })
      }
    },
    [isHost, self],
  )

  const toggleMic = useCallback(() => {
    const stream = self?.stream
    if (!stream) return
    const track = stream.getAudioTracks()[0]
    if (!track) return
    track.enabled = !track.enabled
    setMicEnabled(track.enabled)
  }, [self?.stream])

  const toggleCam = useCallback(() => {
    const stream = self?.stream
    if (!stream) return
    const track = stream.getVideoTracks()[0]
    if (!track) return
    const enabled = !track.enabled
    track.enabled = enabled
    setCamEnabled(enabled)
  }, [self?.stream])

  const replaceVideoTrackOnAll = useCallback(
    (newTrack: MediaStreamTrack | null) => {
      for (const [, call] of callsRef.current) {
        const pc = (call as any).peerConnection as RTCPeerConnection | undefined
        if (!pc) continue
        const sender = pc.getSenders().find((s) => s.track && s.track.kind === "video")
        if (sender) {
          sender.replaceTrack(newTrack).catch(() => {})
        }
      }
      if (self?.stream) {
        const stream = self.stream
        const old = stream.getVideoTracks()[0]
        if (old) stream.removeTrack(old)
        if (newTrack) stream.addTrack(newTrack)
        setSelf({ ...self, stream })
      }
    },
    [self],
  )

  const startScreenShare = useCallback(async () => {
    try {
      const scr = await (navigator.mediaDevices as any).getDisplayMedia({ video: true, audio: false })
      const track: MediaStreamTrack | undefined = scr.getVideoTracks()[0]
      if (!track) return
      replaceVideoTrackOnAll(track)
      setIsScreenSharing(true)
      const me = selfRefCurrent()
      if (me) {
        if (isHost) {
          setPresenterId(me.id)
          broadcastHost({ type: "presenter", id: me.id })
        } else {
          const conn = hostConnRef.current
          if (conn?.open) conn.send({ type: "presenter", id: me.id })
        }
      }
      track.onended = () => {
        if (originalCameraTrackRef.current) {
          replaceVideoTrackOnAll(originalCameraTrackRef.current)
        }
        setIsScreenSharing(false)
        if (isHost) {
          setPresenterId(null)
          broadcastHost({ type: "presenter", id: null })
        } else {
          const conn = hostConnRef.current
          if (conn?.open) conn.send({ type: "presenter", id: null })
        }
      }
    } catch {}
  }, [broadcastHost, isHost, replaceVideoTrackOnAll])

  const stopScreenShare = useCallback(() => {
    if (originalCameraTrackRef.current) {
      replaceVideoTrackOnAll(originalCameraTrackRef.current)
    }
    setIsScreenSharing(false)
    if (isHost) {
      setPresenterId(null)
      broadcastHost({ type: "presenter", id: null })
    } else {
      const conn = hostConnRef.current
      if (conn?.open) conn.send({ type: "presenter", id: null })
    }
  }, [broadcastHost, isHost, replaceVideoTrackOnAll])

  const leaveMeeting = useCallback(() => {
    try {
      peerRef.current?.destroy()
    } catch {}
    window.location.href = "/"
  }, [])

  const completeJoin = useCallback((name: string | null) => {
    if (!name) {
      window.location.href = "/"
      return
    }
    localStorage.setItem("displayName", name)
    setJoinRequested(false)
  }, [])

  const toggleCompactView = useCallback(() => setCompactView((v) => !v), [])

  const selfRefCurrent = useCallback(() => latestSelfRef.current || null, [])

  useEffect(() => {
    latestSelfRef.current = self
  }, [self])

  const value = useMemo<MeetingContextValue>(() => {
    return {
      meetingId,
      connected,
      isHost,
      self,
      participants,
      activeSpeakerId,
      messages,
      sendMessage,
      micEnabled,
      camEnabled,
      isScreenSharing,
      toggleMic,
      toggleCam,
      startScreenShare,
      stopScreenShare,
      leaveMeeting,
      joinRequested,
      completeJoin,
      roomFull,
      presenterId,
      compactView,
      toggleCompactView,
    }
  }, [
    meetingId,
    connected,
    isHost,
    self,
    participants,
    activeSpeakerId,
    messages,
    sendMessage,
    micEnabled,
    camEnabled,
    isScreenSharing,
    toggleMic,
    toggleCam,
    startScreenShare,
    stopScreenShare,
    leaveMeeting,
    joinRequested,
    completeJoin,
    roomFull,
    presenterId,
    compactView,
    toggleCompactView,
  ])

  return <MeetingContext.Provider value={value}>{children}</MeetingContext.Provider>
}
