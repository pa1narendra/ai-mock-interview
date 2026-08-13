import { getCurrentUser } from '@/lib/actions/auth';
import { isOwner } from '@/lib/permissions';
import { redirect } from 'next/navigation';
import { ReactNode } from 'react';
import Link from 'next/link';
import { ShieldCheck, User } from 'lucide-react';
import Logo from '@/components/logo';
import BackButton from '@/components/back-button';
import ThemeToggle from '@/components/theme-toggle';
import SignOutButton from '@/components/sign-out-button';

const AppLayout = async ({ children }: { children: ReactNode }) => {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');
  const owner = isOwner(user.email);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-12 px-6 py-8 max-sm:px-4">
      <nav className="no-print flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BackButton />
          <Logo href="/dashboard" />
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {owner && (
            <Link href="/admin" className="btn-outline !px-4 !py-2 text-xs">
              <ShieldCheck className="size-3.5" /> Admin
            </Link>
          )}
          <Link href="/profile" className="btn-outline !px-4 !py-2 text-xs">
            <User className="size-3.5" /> Profile
          </Link>
          <SignOutButton />
        </div>
      </nav>
      {children}
    </div>
  );
};

export default AppLayout;
