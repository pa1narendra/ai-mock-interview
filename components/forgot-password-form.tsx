"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import Link from "next/link"
import { toast } from "sonner"
import { Loader2, MailCheck } from "lucide-react"

import { authClient } from "@/lib/auth-client"
import TextField from "./form/text-field"
import Logo from "./logo"

const schema = z.object({
  email: z.string().email(),
})

const ForgotPasswordForm = () => {
  const [sent, setSent] = useState(false)
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  })

  async function onSubmit(values: z.infer<typeof schema>) {
    const { error } = await authClient.requestPasswordReset({
      email: values.email,
      redirectTo: "/reset-password",
    })
    if (error) {
      toast.error(error.message ?? "Could not send the reset email. Please try again.")
      return
    }
    setSent(true)
  }

  return (
    <div className="panel w-full max-w-md p-10 fade-up">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col items-center gap-3">
          <Logo />
          <p className="text-center text-sm text-mist-500">
            {sent
              ? "Check your inbox"
              : "Enter your email and we'll send you a reset link"}
          </p>
        </div>

        {sent ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <MailCheck className="size-10 text-spark-400" />
            <p className="text-sm">
              If an account exists for that email, a password reset link is on its way.
              The link expires in 1 hour.
            </p>
          </div>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5">
            <TextField control={form.control} name="email" label="Email" placeholder="you@example.com" type="email" />
            <button className="btn-spark w-full" type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="size-4 animate-spin" />}
              Send reset link
            </button>
          </form>
        )}

        <p className="text-center text-sm">
          Remembered it?
          <Link href="/sign-in" className="ml-1.5 font-semibold text-spark-300 hover:text-spark-400">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}

export default ForgotPasswordForm
