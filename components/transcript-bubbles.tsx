import { cn } from "@/lib/utils"

// Presentational chat bubbles shared by the live session and the report's
// read-only transcript view.
const TranscriptBubbles = ({
  bubbles,
}: {
  bubbles: Array<SavedMessage & { live?: boolean }>
}) => (
  <>
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
  </>
)

export default TranscriptBubbles
