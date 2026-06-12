import { isAuthenticated, signOut } from '@/lib/actions/auth';
import { redirect } from 'next/navigation';
import { ReactNode } from 'react';
import { LogOut } from 'lucide-react';
import Logo from '@/components/logo';

const AppLayout = async ({ children }: { children: ReactNode }) => {
  const authenticated = await isAuthenticated();
  if (!authenticated) redirect('/sign-in');

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-12 px-6 py-8 max-sm:px-4">
      <nav className="flex items-center justify-between">
        <Logo />
        <form action={signOut}>
          <button type="submit" className="btn-outline !px-4 !py-2 text-xs">
            <LogOut className="size-3.5" /> Sign out
          </button>
        </form>
      </nav>
      {children}
    </div>
  );
};

export default AppLayout;
