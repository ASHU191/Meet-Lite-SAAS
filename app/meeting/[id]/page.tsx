import type { Metadata } from "next"
import MeetingRoom from "@/components/meeting/meeting-room"

export const metadata: Metadata = {
  title: "Meeting | Meet Lite",
}

export default function MeetingPage({ params }: { params: { id: string } }) {
  return <MeetingRoom meetingId={params.id} />
}
