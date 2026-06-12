"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import Link from "next/link"
import { toast } from "sonner"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"

import { authClient } from "@/lib/auth-client"
import TextField from "./form/text-field"
import Logo from "./logo"

const schema = z
  .object({
    password: z.string().min(8, "At least 8 characters"),
    confirm: z.string(),
  })
  .refine((value) => value.password === value.confirm, {
    message: "Passwords don't match",
    path: ["confirm"],
  })

const ResetPasswordForm = () => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirm: "" },
  })

  async function onSubmit(values: z.infer<typeof schema>) {
    if (!token) {
      toast.error("This reset link is invalid. Request a new one.")
      return
    }
    const { error } = await authClient.resetPassword({
      newPassword: values.password,
      token,
    })
    if (error) {
      toast.error(
        error.message ?? "This reset link is invalid or has expired. Request a new one."
      )
      return
    }
    toast.success("Password updated - sign in with your new password.")
    router.push("/sign-in")
  }

  return (
    <div className="panel w-full max-w-md p-10 fade-up">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col items-center gap-3">
          <Logo />
          <p className="text-center text-sm text-mist-500">Choose a new password</p>
        </div>

        {token ? (
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5">
            <TextField control={form.control} name="password" label="New password" placeholder="At least 8 characters" type="password" />
            <TextField control={form.control} name="confirm" label="Confirm password" placeholder="Repeat the password" type="password" />
            <button className="btn-spark w-full" type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="size-4 animate-spin" />}
              Reset password
            </button>
          </form>
        ) : (
          <p className="text-center text-sm">
            This reset link is missing its token.
            <Link href="/forgot-password" className="ml-1.5 font-semibold text-spark-300 hover:text-spark-400">
              Request a new one
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}

export default ResetPasswordForm
