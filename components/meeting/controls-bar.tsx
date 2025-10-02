"use client"

import { useCallback } from "react"
import { useMeeting } from "@/context/meeting-context"
import { Button } from "@/components/ui/button"

export default function ControlsBar({ onToggleChat, chatOpen }: { onToggleChat: () => void; chatOpen: boolean }) {
  const {
    micEnabled,
    camEnabled,
    toggleMic,
    toggleCam,
    startScreenShare,
    stopScreenShare,
    isScreenSharing,
    leaveMeeting,
    compactView,
    toggleCompactView,
  } = useMeeting()

  const onShare = useCallback(() => {
    if (isScreenSharing) stopScreenShare()
    else startScreenShare()
  }, [isScreenSharing, startScreenShare, stopScreenShare])

  return (
    <div className="px-3 md:px-4 py-3 flex items-center justify-between gap-3">
      <div className="text-sm text-muted-foreground">Meeting controls</div>
      <div className="flex items-center gap-2">
        <Button variant={compactView ? "default" : "secondary"} onClick={toggleCompactView}>
          {compactView ? "Comfortable" : "Compact"}
        </Button>
        <Button variant={micEnabled ? "secondary" : "destructive"} onClick={toggleMic}>
          {micEnabled ? "Mute" : "Unmute"}
        </Button>
        <Button variant={camEnabled ? "secondary" : "destructive"} onClick={toggleCam}>
          {camEnabled ? "Camera off" : "Camera on"}
        </Button>
        <Button variant={isScreenSharing ? "secondary" : "default"} onClick={onShare}>
          {isScreenSharing ? "Stop sharing" : "Share screen"}
        </Button>
        <Button variant="secondary" onClick={onToggleChat}>
          {chatOpen ? "Hide chat" : "Show chat"}
        </Button>
        <Button variant="destructive" onClick={leaveMeeting}>
          Leave
        </Button>
      </div>
    </div>
  )
}
