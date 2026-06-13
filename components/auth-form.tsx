"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import Link from "next/link"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

import { authClient } from "@/lib/auth-client"
import TextField from "./form/text-field"
import Logo from "./logo"

const authFormSchema = (type: FormType) => {
  return z.object({
    name: type === "sign-up" ? z.string().min(3).max(30) : z.string().optional(),
    email: z.string().email(),
    password: z.string().min(8),
  })
}

const AuthForm = ({ type }: { type: FormType }) => {
  const router = useRouter()
  const formSchema = authFormSchema(type)
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const { name, email, password } = values;

    if (type === "sign-in") {
      const { error } = await authClient.signIn.email({ email, password });
      if (error) {
        toast.error(
          error.status === 401 || error.code === "INVALID_EMAIL_OR_PASSWORD"
            ? "Invalid email or password."
            : error.message ?? "Failed to sign in. Please try again."
        );
        return;
      }
      toast.success("Welcome back!");
      router.push("/dashboard");
      router.refresh();
    } else {
      const { error } = await authClient.signUp.email({ name: name!, email, password });
      if (error) {
        toast.error(
          error.code === "USER_ALREADY_EXISTS"
            ? "An account with this email already exists. Sign in instead."
            : error.message ?? "Could not create your account. Please try again."
        );
        return;
      }
      toast.success("Account created - welcome to Mockstar!");
      router.push("/dashboard");
      router.refresh();
    }
  }

  const isSignIn = type === "sign-in"

  return (
    <div className="panel w-full max-w-md p-10 fade-up">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col items-center gap-3">
          <Logo />
          <p className="text-center text-sm text-mist-500">
            {isSignIn ? "Sign in to continue practicing" : "Practice interviews out loud, get scored feedback"}
          </p>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5">
          {!isSignIn && (
            <TextField control={form.control} name="name" label="Name" placeholder="Your name" />
          )}
          <TextField control={form.control} name="email" label="Email" placeholder="you@example.com" type="email" />
          <TextField control={form.control} name="password" label="Password" placeholder="At least 8 characters" type="password" />

          {isSignIn && (
            <Link href="/forgot-password" className="-mt-2 self-end text-xs font-medium text-mist-500 hover:text-spark-300">
              Forgot password?
            </Link>
          )}

          <button className="btn-spark w-full" type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && <Loader2 className="size-4 animate-spin" />}
            {isSignIn ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-sm">
          {isSignIn ? "Don't have an account?" : 'Already have an account?'}
          <Link href={isSignIn ? '/sign-up' : '/sign-in'} className="ml-1.5 font-semibold text-spark-300 hover:text-spark-400">
            {isSignIn ? 'Sign up' : 'Sign in'}
          </Link>
        </p>
      </div>
    </div>
  )
}

export default AuthForm
