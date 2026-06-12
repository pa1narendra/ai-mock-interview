"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Sparkles } from "lucide-react"
import { createReport } from "@/lib/actions/reports"

const GenerateReportButton = ({ transcriptId, interviewId }: { transcriptId: string; interviewId: string }) => {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function handleClick() {
    setPending(true)
    const result = await createReport(transcriptId)
    if (result.success) {
      toast.success("Report generated!")
      router.push(`/interviews/${interviewId}/report?attempt=${result.attempt}`)
      router.refresh()
    } else {
      toast.error("The AI service is still busy - try again in a minute. Your answers are safe.")
      setPending(false)
    }
  }

  return (
    <button className="btn-spark" onClick={handleClick} disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" /> Generating report
        </>
      ) : (
        <>
          <Sparkles className="size-4" /> Generate report
        </>
      )}
    </button>
  )
}

export default GenerateReportButton
