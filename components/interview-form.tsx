"use client"

import { useRef, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import dayjs from "dayjs"
import { FileText, Loader2, Sparkles, Upload, X } from "lucide-react"

import TextField from "./form/text-field"
import SelectField from "./form/select-field"
import TextareaField from "./form/textarea-field"
import ConfirmDialog from "./confirm-dialog"
import {
  CODE_LANGUAGES,
  DIFFICULTIES,
  DIFFICULTY_OPTIONS,
  interviewFormSchema,
  LANGUAGE_OPTIONS,
  ROUND_FORMATS,
  ROUND_LIMITS,
  ROUND_OPTIONS,
  roundCountMessage,
  VOICE_OPTIONS,
  type InterviewFormValues,
  type RoundFormat,
} from "@/lib/schemas"
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

interface InterviewTemplate {
  role: string
  level: string
  type: string
  techstack: string[]
  voice: string | null
  format?: string
  difficulty?: string | null
  language?: string | null
}

interface InterviewFormProps {
  savedResume: { fileName: string; updatedAt: string } | null
  template?: InterviewTemplate | null
  canChooseVoice?: boolean
}

const LEVELS = ["junior", "mid", "senior"] as const
const TYPES = ["technical", "behavioural", "mixed"] as const
const VOICES = ["Aoede", "Kore", "Puck", "Charon"] as const
const pick = <T extends string>(options: readonly T[], value: string | null | undefined, fallback: T): T =>
  value && (options as readonly string[]).includes(value) ? (value as T) : fallback

const InterviewForm = ({ savedResume, template = null, canChooseVoice = false }: InterviewFormProps) => {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>("targeted")
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [useSaved, setUseSaved] = useState(Boolean(savedResume))
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Validated values waiting on the confirmation dialog.
  const [pendingValues, setPendingValues] = useState<InterviewFormValues | null>(null)
  const [generating, setGenerating] = useState(false)

  const initialFormat = pick(ROUND_FORMATS, template?.format, "standard")
  const form = useForm<InterviewFormValues>({
    resolver: zodResolver(interviewFormSchema),
    defaultValues: {
      format: initialFormat,
      difficulty: pick(DIFFICULTIES, template?.difficulty, "medium"),
      language: pick(CODE_LANGUAGES, template?.language, "python"),
      role: template?.role ?? "",
      level: template && (LEVELS as readonly string[]).includes(template.level) ? (template.level as typeof LEVELS[number]) : "junior",
      type: template && (TYPES as readonly string[]).includes(template.type) ? (template.type as typeof TYPES[number]) : "mixed",
      techstack: template?.techstack.join(", ") ?? "",
      amount: ROUND_LIMITS[initialFormat].default,
      jd: "",
      voice: template?.voice && (VOICES as readonly string[]).includes(template.voice) ? (template.voice as typeof VOICES[number]) : "Aoede",
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

  const format = useWatch({ control: form.control, name: "format" })
  const isRound = format !== "standard"
  const limits = ROUND_LIMITS[format]

  function chooseFormat(next: RoundFormat) {
    if (next === format) return
    form.setValue("format", next)
    form.setValue("amount", ROUND_LIMITS[next].default)
    form.clearErrors()
  }

  function onSubmit(values: InterviewFormValues) {
    const targeted = mode === "targeted" && values.format === "standard"
    const { min, max } = ROUND_LIMITS[values.format]
    if (values.amount < min || values.amount > max) {
      form.setError("amount", { message: roundCountMessage(values.format) })
      return
    }
    if (values.format !== "standard") {
      setPendingValues(values)
      return
    }

    if (targeted && !values.jd.trim()) {
      form.setError("jd", { message: "Paste the job description you're targeting" })
      return
    }
    if (!targeted && !values.techstack.trim()) {
      form.setError("techstack", { message: "Add at least one technology" })
      return
    }

    setPendingValues(values)
  }

  async function generate(values: InterviewFormValues) {
    const targeted = mode === "targeted" && values.format === "standard"
    setGenerating(true)
    try {
      const fd = new FormData()
      fd.set("role", values.role)
      fd.set("level", values.level)
      fd.set("type", values.type)
      fd.set("amount", String(values.amount))
      fd.set("techstack", values.techstack)
      fd.set("voice", values.voice)
      fd.set("format", values.format)
      if (values.format === "dsa") {
        fd.set("difficulty", values.difficulty)
        fd.set("language", values.language)
      }
      if (targeted) {
        fd.set("jd", values.jd)
        if (resumeFile) fd.append("resume", resumeFile)
        else if (savedResume && useSaved) fd.set("useSavedResume", "true")
      }

      const res = await fetch("/api/interviews/generate", { method: "POST", body: fd })
      const data = await res.json().catch(() => ({}))

      if (!res.ok || !data.success) {
        toast.error(data.message ?? "Failed to generate the interview. Please try again.")
        setGenerating(false)
        return
      }

      toast.success("Interview ready. Good luck!")
      // replace: the submitted form shouldn't be a Back target.
      router.replace(`/interviews/${data.interviewId}`)
    } catch {
      toast.error("Something went wrong. Please check your connection and try again.")
      setGenerating(false)
    }
  }

  const targeted = mode === "targeted" && !isRound
  const hasResumeContext = targeted && (resumeFile || (savedResume && useSaved))
  const itemNoun = limits.noun

  return (
    <div className="panel w-full max-w-xl p-10 fade-up">
      {template && (
        <div className="mb-6 rounded-xl border border-spark-500/25 bg-spark-500/10 px-4 py-3 text-sm text-mist-200">
          Personalizing the <span className="font-semibold capitalize text-spark-300">{template.role}</span> {isRound ? "round for you - you'll get fresh problems at the same level." : "interview for you - add your resume below so the questions match your experience."}
        </div>
      )}
      <div className="mb-5 flex flex-col gap-2">
        <span className="field-label">Round</span>
        <div className="grid grid-cols-3 gap-2 max-sm:grid-cols-1" role="radiogroup" aria-label="Round">
          {ROUND_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={format === option.value}
              onClick={() => chooseFormat(option.value)}
              className={cn(
                "rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors",
                format === option.value
                  ? "border-spark-500/60 bg-spark-500/10 text-foreground"
                  : "border-border text-mist-300 hover:text-mist-100"
              )}
            >
              {option.label.replace(/ round$/, "").replace(" interview", "")}
            </button>
          ))}
        </div>
      </div>

      {!isRound && (
      <div className="mb-7 grid grid-cols-2 gap-2 rounded-full border border-border bg-surface-raised p-1">
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
      )}

      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <TextField
          control={form.control}
          name="role"
          label="Job role"
          placeholder="e.g. Frontend Developer"
        />

        {canChooseVoice && (
          <SelectField control={form.control} name="voice" label="Interviewer voice" options={VOICE_OPTIONS} />
        )}

        <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
          <SelectField control={form.control} name="level" label="Experience level" options={levelOptions} />
          {isRound ? (
            format === "dsa" && <SelectField control={form.control} name="difficulty" label="Difficulty" options={DIFFICULTY_OPTIONS} />
          ) : (
            <SelectField control={form.control} name="type" label="Interview style" options={typeOptions} />
          )}
        </div>

        {format === "dsa" && (
          <SelectField control={form.control} name="language" label="Coding language" options={LANGUAGE_OPTIONS} />
        )}

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
                <div className="flex items-center justify-between rounded-xl border border-border bg-surface-raised px-4 py-3">
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
                  className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-raised px-4 py-5 text-sm text-mist-400 transition-colors hover:border-primary/40 hover:text-mist-200">
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

        {!targeted && !isRound && (
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
          label={`Number of ${itemNoun}s (${limits.min}-${limits.max})`}
          type="number"
        />

        <button className="btn-highlight w-full mt-2" type="submit" disabled={generating}>
          {generating ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {hasResumeContext ? "Reading your resume and generating questions" : `Generating your ${itemNoun}s`}
            </>
          ) : (
            "Create interview"
          )}
        </button>
      </form>

      <ConfirmDialog
        open={pendingValues !== null}
        icon={<Sparkles className="size-4" />}
        title="Create this interview?"
        description={
          pendingValues && (
            pendingValues.format !== "standard" ? (
              <>
                {pendingValues.amount}{pendingValues.format === "dsa" ? ` ${pendingValues.difficulty} coding` : " system design"}{" "}
                {ROUND_LIMITS[pendingValues.format].noun}{Number(pendingValues.amount) === 1 ? "" : "s"} for a{" "}
                {levelOptions.find((o) => o.value === pendingValues.level)?.label.toLowerCase()} {pendingValues.role}
                {pendingValues.format === "dsa" ? `, solved in ${LANGUAGE_OPTIONS.find((o) => o.value === pendingValues.language)?.label}` : ""}.
                This counts toward your interview limit.
              </>
            ) : (
            <>
              {pendingValues.amount} {pendingValues.type} question{Number(pendingValues.amount) === 1 ? "" : "s"} for
              a {levelOptions.find((o) => o.value === pendingValues.level)?.label.toLowerCase()} {pendingValues.role}
              {hasResumeContext ? ", tailored to your resume and the job description" : targeted ? ", based on the job description" : ""}.
              This counts toward your interview limit.
            </>
            )
          )
        }
        confirmLabel="Create interview"
        onCancel={() => setPendingValues(null)}
        onConfirm={() => {
          const values = pendingValues
          setPendingValues(null)
          if (values) void generate(values)
        }}
      />
    </div>
  )
}

export default InterviewForm
