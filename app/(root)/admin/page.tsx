import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/actions/auth";
import { isOwner } from "@/lib/permissions";
import { listUsersForAdmin } from "@/lib/actions/referral";
import ProToggle from "@/components/pro-toggle";
import ProBadge from "@/components/pro-badge";

export const metadata: Metadata = { title: "Admin" };

const Page = async () => {
  const user = await getCurrentUser();
  if (!isOwner(user?.email)) redirect("/dashboard");

  const users = await listUsersForAdmin();

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 fade-up">
      <div className="flex flex-col gap-1">
        <h1>Users</h1>
        <p className="text-sm text-muted-foreground">
          Toggle grants Pro manually. Users also earn Pro automatically once a referral completes an interview.
        </p>
      </div>

      <div className="panel divide-y divide-border">
        {users.length === 0 ? (
          <p className="px-6 py-10 text-center text-muted-foreground">
            No users yet (or the referral migration hasn&apos;t been applied).
          </p>
        ) : (
          users.map((u) => {
            const effectivePro = u.isPro || u.referralCount >= 1;
            return (
              <div key={u.id} className="flex items-center justify-between gap-4 px-6 py-4">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 truncate font-medium text-foreground">
                    {u.name}
                    {effectivePro && <ProBadge />}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">{u.email}</p>
                </div>
                <div className="flex items-center gap-5">
                  <span className="text-xs text-muted-foreground">
                    {u.referralCount} referral{u.referralCount === 1 ? "" : "s"}
                  </span>
                  <ProToggle userId={u.id} isPro={u.isPro} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};

export default Page;
