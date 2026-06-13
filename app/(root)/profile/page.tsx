import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/actions/auth";
import { getMyResumeMeta } from "@/lib/actions/resumes";
import ProfileResume from "@/components/profile-resume";

export const metadata: Metadata = {
  title: "Profile",
};

const Page = async () => {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const resume = await getMyResumeMeta();

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-8 fade-up">
      <h1>Profile</h1>

      <div className="panel flex flex-col gap-4 px-8 py-6">
        <h3>Account</h3>
        <div className="grid grid-cols-[120px_1fr] gap-y-3 text-sm max-sm:grid-cols-1 max-sm:gap-y-1">
          <span className="text-mist-500">Name</span>
          <span className="text-mist-100">{user.name}</span>
          <span className="text-mist-500">Email</span>
          <span className="text-mist-100">{user.email}</span>
        </div>
      </div>

      <div className="panel flex flex-col gap-4 px-8 py-6">
        <h3>Saved resume</h3>
        <ProfileResume meta={resume} />
      </div>
    </section>
  );
};

export default Page;
