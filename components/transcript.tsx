"use client"

import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

interface TranscriptProps {
  messages: SavedMessage[]
  caption: SavedMessage | null
}

const Transcript = ({ messages, caption }: TranscriptProps) => {
  const scrollRef = useRef<HTMLDivElement>(null)
  const pinnedRef = useRef(true) // stick to bottom unless the user scrolls up

  const handleScroll = () => {
    const el = scrollRef.current
    if (el) pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48
  }

  useEffect(() => {
    const el = scrollRef.current
    if (el && pinnedRef.current) el.scrollTop = el.scrollHeight
  }, [messages, caption])

  const bubbles: Array<SavedMessage & { live?: boolean }> = caption
    ? [...messages, { ...caption, live: true }]
    : messages

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="panel flex h-72 w-full max-w-2xl flex-col gap-3 overflow-y-auto px-5 py-4"
      aria-live="polite"
    >
      {bubbles.length === 0 && (
        <p className="m-auto max-w-sm text-center text-mist-500">
          Your conversation will appear here. Speak naturally - you can interrupt the interviewer at any time.
        </p>
      )}
      {bubbles.map((message, index) => (
        <div
          key={index}
          className={cn(
            "max-w-[80%] rounded-2xl border px-4 py-2.5 text-sm leading-relaxed",
            message.role === "user"
              ? "self-end rounded-br-md border-spark-500/25 bg-spark-500/15 text-mist-100"
              : "self-start rounded-bl-md border-white/10 bg-white/[0.06] text-mist-200",
            message.live && "opacity-80"
          )}
        >
          <span className="mb-0.5 block text-[10px] uppercase tracking-widest text-mist-500">
            {message.role === "assistant" ? "Interviewer" : "You"}
          </span>
          {message.content}
        </div>
      ))}
    </div>
  )
}

export default Transcript
