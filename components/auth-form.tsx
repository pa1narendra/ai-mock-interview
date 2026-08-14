"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import Link from "next/link"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

import { authClient } from "@/lib/auth-client"
import { attachReferrer } from "@/lib/actions/referral"
import TextField from "./form/text-field"
import Logo from "./logo"

const REQUIRE_EMAIL_VERIFICATION = process.env.NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION === "true"

// Record the referral (best-effort, never throws) but never let it stall the
// redirect: cap the wait so a slow/hung attach can't strand the user.
async function recordReferral(code?: string) {
  if (!code) return
  await Promise.race([
    attachReferrer(code),
    new Promise((resolve) => setTimeout(resolve, 2500)),
  ])
}

const authFormSchema = (type: FormType) => {
  return z.object({
    name: type === "sign-up" ? z.string().min(3).max(30) : z.string().optional(),
    email: z.string().email(),
    password: z.string().min(8),
    referralCode: z.string().optional(),
  })
}

const GoogleIcon = () => (
  <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.8Z" />
    <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.1A12 12 0 0 0 12 24Z" />
    <path fill="#FBBC05" d="M5.28 14.29a7.2 7.2 0 0 1 0-4.58v-3.1H1.27a12 12 0 0 0 0 10.78l4.01-3.1Z" />
    <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.98 11.98 0 0 0 12 0 12 12 0 0 0 1.27 6.61l4.01 3.1C6.22 6.88 8.87 4.77 12 4.77Z" />
  </svg>
)

const AuthForm = ({ type, referralCode }: { type: FormType; referralCode?: string }) => {
  const router = useRouter()
  const [googleLoading, setGoogleLoading] = useState(false)
  const formSchema = authFormSchema(type)
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      referralCode: referralCode ?? "",
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const { name, email, password } = values;

    if (type === "sign-in") {
      const { error } = await authClient.signIn.email({ email, password });
      if (error) {
        if (error.code === "EMAIL_NOT_VERIFIED") {
          toast.error("Please verify your email first - we've re-sent you the link.");
          return;
        }
        toast.error(
          error.status === 401 || error.code === "INVALID_EMAIL_OR_PASSWORD"
            ? "Invalid email or password."
            : error.message ?? "Failed to sign in. Please try again."
        );
        return;
      }
      await recordReferral(referralCode);
      // Hard navigation guarantees the just-set session cookie is used and
      // avoids the router.push+refresh race that could strand the user here.
      window.location.assign("/dashboard");
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
      const enteredCode = (values.referralCode ?? "").trim() || referralCode;
      if (REQUIRE_EMAIL_VERIFICATION) {
        toast.success("Account created! Check your email for a verification link, then sign in.");
        router.push(enteredCode ? `/sign-in?ref=${encodeURIComponent(enteredCode)}` : "/sign-in");
        return;
      }
      await recordReferral(enteredCode);
      // Hard navigation: reliable with the freshly-set session cookie, and not
      // cancellable by a router refresh (the cause of the stuck signup screen).
      window.location.assign("/dashboard");
    }
  }

  async function onGoogleSignIn() {
    setGoogleLoading(true);
    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL: "/dashboard",
    });
    // On success the browser redirects to Google, so we only land here on error.
    if (error) {
      toast.error(error.message ?? "Could not sign in with Google. Please try again.");
      setGoogleLoading(false);
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

          {!isSignIn && (
            <TextField
              control={form.control}
              name="referralCode"
              label="Referral code (optional)"
              placeholder="Have a friend's code? Enter it here"
            />
          )}

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

        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-mist-500/25" />
          <span className="text-xs uppercase tracking-wide text-mist-500">or</span>
          <span className="h-px flex-1 bg-mist-500/25" />
        </div>

        <button
          type="button"
          className="btn-outline w-full"
          onClick={onGoogleSignIn}
          disabled={googleLoading}
        >
          {googleLoading ? <Loader2 className="size-4 animate-spin" /> : <GoogleIcon />}
          Continue with Google
        </button>

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
