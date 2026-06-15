import { isAuthenticated, signOut } from '@/lib/actions/auth';
import { redirect } from 'next/navigation';
import { ReactNode } from 'react';
import Link from 'next/link';
import { LogOut, User } from 'lucide-react';
import Logo from '@/components/logo';
import BackButton from '@/components/back-button';

const AppLayout = async ({ children }: { children: ReactNode }) => {
  const authenticated = await isAuthenticated();
  if (!authenticated) redirect('/sign-in');

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-12 px-6 py-8 max-sm:px-4">
      <nav className="no-print flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BackButton />
          <Logo href="/dashboard" />
        </div>
        <div className="flex items-center gap-2">
          <Link href="/profile" className="btn-outline !px-4 !py-2 text-xs">
            <User className="size-3.5" /> Profile
          </Link>
          <form action={signOut}>
            <button type="submit" className="btn-outline !px-4 !py-2 text-xs">
              <LogOut className="size-3.5" /> Sign out
            </button>
          </form>
        </div>
      </nav>
      {children}
    </div>
  );
};

export default AppLayout;
