"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Pencil, Loader2, ListChecks } from "lucide-react"
import { updateInterviewQuestions } from "@/lib/actions/interviews"

const EditQuestions = ({
  interviewId,
  questions,
  canEdit,
}: {
  interviewId: string
  questions: string[]
  canEdit: boolean
}) => {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(questions.join("\n"))
  const [pending, setPending] = useState(false)

  async function save() {
    const lines = draft.split("\n").map((l) => l.trim()).filter(Boolean)
    if (lines.length === 0) {
      toast.error("Add at least one question.")
      return
    }
    setPending(true)
    const res = await updateInterviewQuestions(interviewId, lines)
    setPending(false)
    if (res.success) {
      toast.success("Questions updated")
      setEditing(false)
      router.refresh()
    } else {
      toast.error("Could not update questions.")
    }
  }

  return (
    <details className="panel px-6 py-4 group">
      <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-mist-200 marker:content-none">
        <ListChecks className="size-4 text-spark-400" /> Interview questions ({questions.length})
        <span className="ml-auto text-xs text-mist-500 group-open:hidden">Preview</span>
        <span className="ml-auto hidden text-xs text-mist-500 group-open:inline">Hide</span>
      </summary>

      {editing ? (
        <div className="mt-4 flex flex-col gap-3">
          <textarea
            className="field-input min-h-40"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="Edit questions, one per line"
          />
          <p className="text-xs text-mist-500">One question per line.</p>
          <div className="flex gap-2">
            <button className="btn-spark !py-2 text-xs" onClick={save} disabled={pending}>
              {pending ? <Loader2 className="size-3.5 animate-spin" /> : null} Save
            </button>
            <button className="btn-outline !py-2 text-xs" onClick={() => { setDraft(questions.join("\n")); setEditing(false); }} disabled={pending}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-mist-300">
            {questions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ol>
          {canEdit && (
            <button className="btn-outline w-fit !py-2 text-xs" onClick={() => setEditing(true)}>
              <Pencil className="size-3.5" /> Edit questions
            </button>
          )}
        </div>
      )}
    </details>
  )
}

export default EditQuestions
