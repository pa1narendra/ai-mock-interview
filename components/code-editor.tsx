"use client"

import dynamic from "next/dynamic"
import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import type { Extension } from "@codemirror/state"

// CodeMirror touches the DOM, so it loads client-only. This whole component is
// itself loaded only on DSA rounds (see voice-session.tsx).
const CodeMirror = dynamic(() => import("@uiw/react-codemirror"), {
  ssr: false,
  loading: () => <div className="h-full min-h-[360px] animate-pulse rounded-xl border border-border bg-surface-raised" />,
})

// Only the round's own language pack is downloaded.
async function loadLanguage(language: string): Promise<Extension[]> {
  switch (language) {
    case "python":
      return [(await import("@codemirror/lang-python")).python()]
    case "javascript":
      return [(await import("@codemirror/lang-javascript")).javascript({ typescript: true })]
    case "java":
      return [(await import("@codemirror/lang-java")).java()]
    case "cpp":
      return [(await import("@codemirror/lang-cpp")).cpp()]
    default:
      return []
  }
}

const CodeEditor = ({
  language,
  value,
  onChange,
  readOnly = false,
}: {
  language: string
  value: string
  onChange?: (value: string) => void
  readOnly?: boolean
}) => {
  const { resolvedTheme } = useTheme()
  const [extensions, setExtensions] = useState<Extension[]>([])

  useEffect(() => {
    let cancelled = false
    void loadLanguage(language).then((ext) => {
      if (!cancelled) setExtensions(ext)
    })
    return () => {
      cancelled = true
    }
  }, [language])

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      readOnly={readOnly}
      editable={!readOnly}
      extensions={extensions}
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      height="100%"
      minHeight="360px"
      maxHeight="70vh"
      basicSetup={{ lineNumbers: true, highlightActiveLine: !readOnly, tabSize: 4, autocompletion: false }}
      aria-label={`Code editor (${language})`}
      className="overflow-hidden rounded-xl border border-border text-sm"
    />
  )
}

export default CodeEditor
