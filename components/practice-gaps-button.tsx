"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Target } from "lucide-react"
import { createFocusedInterview } from "@/lib/actions/interviews"

const PracticeGapsButton = ({ interviewId }: { interviewId: string }) => {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function handleClick() {
    setPending(true)
    const res = await createFocusedInterview(interviewId)
    if (res.success && res.interviewId) {
      toast.success("Focused practice round ready!")
      router.push(`/interviews/${res.interviewId}`)
    } else {
      toast.error(res.message ?? "Could not create a practice round. Please try again.")
      setPending(false)
    }
  }

  return (
    <button className="btn-spark" onClick={handleClick} disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" /> Building your round
        </>
      ) : (
        <>
          <Target className="size-4" /> Practice my weak areas
        </>
      )}
    </button>
  )
}

export default PracticeGapsButton
