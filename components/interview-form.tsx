"use client"

import { useRef, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import dayjs from "dayjs"
import { FileText, Loader2, Sparkles, Upload, X } from "lucide-react"

import TextField from "./form/text-field"
import SelectField from "./form/select-field"
import TextareaField from "./form/textarea-field"
import { interviewFormSchema, VOICE_OPTIONS, type InterviewFormValues } from "@/lib/schemas"
import { cn } from "@/lib/utils"

const levelOptions = [
  { value: "junior", label: "Junior" },
  { value: "mid", label: "Mid-level" },
  { value: "senior", label: "Senior" },
] as const

const typeOptions = [
  { value: "technical", label: "Technical" },
  { value: "behavioural", label: "Behavioural" },
  { value: "mixed", label: "Mixed" },
] as const

type Mode = "targeted" | "quick"

interface InterviewFormProps {
  savedResume: { fileName: string; updatedAt: string } | null
}

const InterviewForm = ({ savedResume }: InterviewFormProps) => {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>("targeted")
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [useSaved, setUseSaved] = useState(Boolean(savedResume))
  const fileInputRef = useRef<HTMLInputElement>(null)

  const form = useForm<InterviewFormValues>({
    resolver: zodResolver(interviewFormSchema),
    defaultValues: {
      role: "",
      level: "junior",
      type: "mixed",
      techstack: "",
      amount: 5,
      jd: "",
      voice: "Aoede",
    },
  })

  function handleFileChange(file: File | null) {
    if (!file) return
    if (file.type !== "application/pdf") {
      toast.error("Resume must be a PDF file.")
      return
    }
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Resume must be under 4MB.")
      return
    }
    setResumeFile(file)
    setUseSaved(false)
  }

  async function onSubmit(values: InterviewFormValues) {
    const targeted = mode === "targeted"

    if (targeted && !values.jd.trim()) {
      form.setError("jd", { message: "Paste the job description you're targeting" })
      return
    }
    if (!targeted && !values.techstack.trim()) {
      form.setError("techstack", { message: "Add at least one technology" })
      return
    }

    try {
      const fd = new FormData()
      fd.set("role", values.role)
      fd.set("level", values.level)
      fd.set("type", values.type)
      fd.set("amount", String(values.amount))
      fd.set("techstack", values.techstack)
      fd.set("voice", values.voice)
      if (targeted) {
        fd.set("jd", values.jd)
        if (resumeFile) fd.append("resume", resumeFile)
        else if (savedResume && useSaved) fd.set("useSavedResume", "true")
      }

      const res = await fetch("/api/interviews/generate", { method: "POST", body: fd })
      const data = await res.json().catch(() => ({}))

      if (!res.ok || !data.success) {
        toast.error(data.message ?? "Failed to generate the interview. Please try again.")
        return
      }

      toast.success("Interview ready. Good luck!")
      router.push(`/interviews/${data.interviewId}`)
    } catch {
      toast.error("Something went wrong. Please check your connection and try again.")
    }
  }

  const targeted = mode === "targeted"
  const hasResumeContext = targeted && (resumeFile || (savedResume && useSaved))

  return (
    <div className="panel w-full max-w-xl p-10 fade-up">
      <div className="mb-7 grid grid-cols-2 gap-2 rounded-full border border-white/10 bg-white/[0.04] p-1">
        {([
          { key: "targeted", label: "Target a job" },
          { key: "quick", label: "Quick practice" },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setMode(tab.key)}
            className={cn(
              "rounded-full py-2 text-sm font-semibold transition-colors",
              mode === tab.key ? "bg-spark-500 text-ink-950" : "text-mist-300 hover:text-mist-100"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <TextField
          control={form.control}
          name="role"
          label="Job role"
          placeholder="e.g. Frontend Developer"
        />

        <SelectField control={form.control} name="voice" label="Interviewer voice" options={VOICE_OPTIONS} />

        <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
          <SelectField control={form.control} name="level" label="Experience level" options={levelOptions} />
          <SelectField control={form.control} name="type" label="Interview style" options={typeOptions} />
        </div>

        {targeted && (
          <>
            <TextareaField
              control={form.control}
              name="jd"
              label="Job description"
              placeholder="Paste the job description here - requirements, responsibilities, anything from the posting."
            />

            <div className="flex flex-col gap-2">
              <span className="field-label">Resume (PDF, optional but recommended)</span>
              {resumeFile ? (
                <div className="flex items-center justify-between rounded-xl border border-spark-500/25 bg-spark-500/10 px-4 py-3">
                  <span className="flex items-center gap-2 text-sm text-mist-100">
                    <FileText className="size-4 text-spark-300" /> {resumeFile.name}
                  </span>
                  <button type="button" aria-label="Remove resume" onClick={() => setResumeFile(null)}
                    className="text-mist-500 hover:text-mist-300">
                    <X className="size-4" />
                  </button>
                </div>
              ) : savedResume && useSaved ? (
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
                  <span className="flex items-center gap-2 text-sm text-mist-300">
                    <FileText className="size-4 text-spark-300" />
                    Using saved resume: <span className="text-mist-100">{savedResume.fileName}</span>
                    <span className="text-mist-500">· {dayjs(savedResume.updatedAt).format("MMM D")}</span>
                  </span>
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    className="text-sm font-semibold text-spark-300 hover:text-spark-400">
                    Replace
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-5 text-sm text-mist-400 transition-colors hover:border-spark-500/40 hover:text-mist-200">
                  <Upload className="size-4" /> Upload your resume (PDF, max 4MB)
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
              />
            </div>

            <TextField
              control={form.control}
              name="techstack"
              label="Tech stack (optional - we'll infer it from the JD)"
              placeholder="e.g. React, TypeScript, Node.js"
            />
          </>
        )}

        {!targeted && (
          <TextField
            control={form.control}
            name="techstack"
            label="Tech stack"
            placeholder="e.g. React, TypeScript, Node.js (comma separated)"
          />
        )}

        <TextField
          control={form.control}
          name="amount"
          label="Number of questions (1-20)"
          type="number"
        />

        <button className="btn-spark w-full mt-2" type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {hasResumeContext ? "Reading your resume and generating questions" : "Generating your questions"}
            </>
          ) : (
            <>
              <Sparkles className="size-4" /> Create interview
            </>
          )}
        </button>
      </form>
    </div>
  )
}

export default InterviewForm
