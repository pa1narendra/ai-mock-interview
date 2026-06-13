import Link from "next/link";
import { redirect } from "next/navigation";
import { AudioLines, FileText, Sparkles, TrendingUp, Mic } from "lucide-react";
import Logo from "@/components/logo";
import { getCurrentUser } from "@/lib/actions/auth";

const features = [
  {
    icon: Mic,
    title: "Real voice interviews",
    body: "Talk through questions out loud with an AI interviewer that listens, follows up, and adapts - not a text box.",
  },
  {
    icon: FileText,
    title: "Grounded in your JD + resume",
    body: "Paste the job description and upload your resume. Questions target exactly what the role needs and probe your real experience.",
  },
  {
    icon: TrendingUp,
    title: "Scored feedback that compounds",
    body: "Per-question scoring, a full transcript, and progress tracking across three attempts so you can see yourself improving.",
  },
];

const Page = async () => {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-6 max-sm:px-4">
      <nav className="flex items-center justify-between">
        <Logo href="/" />
        <div className="flex items-center gap-2">
          <Link href="/sign-in" className="btn-outline !px-4 !py-2 text-xs">Sign in</Link>
          <Link href="/sign-up" className="btn-spark !px-4 !py-2 text-xs">Get started</Link>
        </div>
      </nav>

      <section className="relative flex flex-col items-center gap-6 py-24 text-center max-sm:py-16 fade-up">
        <div
          className="pointer-events-none absolute -top-10 left-1/2 size-[28rem] -translate-x-1/2 rounded-full opacity-20 blur-3xl"
          style={{ background: "radial-gradient(circle, #10b981, transparent 65%)" }}
        />
        <span className="status-pill relative">
          <AudioLines className="size-3.5 text-spark-400" /> Voice-first mock interviews
        </span>
        <h1 className="relative max-w-3xl text-6xl font-semibold leading-[1.05] max-sm:text-4xl">
          Rehearse interviews <span className="text-spark-gradient">out loud</span>. Get scored.
        </h1>
        <p className="relative max-w-xl text-lg text-mist-300">
          Mockstar runs realistic voice interviews tailored to the exact job you&apos;re targeting,
          then tells you precisely what to improve - question by question.
        </p>
        <div className="relative flex items-center gap-3 max-sm:flex-col">
          <Link href="/sign-up" className="btn-spark">
            <Sparkles className="size-4" /> Start practicing free
          </Link>
          <Link href="/sign-in" className="btn-outline">I already have an account</Link>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-5 pb-24 max-md:grid-cols-1">
        {features.map((feature) => (
          <div key={feature.title} className="panel flex flex-col gap-3 p-6">
            <feature.icon className="size-6 text-spark-400" />
            <h3 className="text-lg">{feature.title}</h3>
            <p className="text-sm">{feature.body}</p>
          </div>
        ))}
      </section>

      <footer className="mt-auto border-t border-white/[0.06] py-6 text-center text-sm text-mist-500">
        Mockstar - AI voice mock interviews
      </footer>
    </main>
  );
};

export default Page;
