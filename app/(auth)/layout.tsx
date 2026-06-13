import { isAuthenticated } from '@/lib/actions/auth';
import { redirect } from 'next/navigation';
import { ReactNode } from 'react';

const AuthLayout = async ({ children }: { children: ReactNode }) => {
  const authenticated = await isAuthenticated();
  if (authenticated) redirect('/dashboard');

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      {children}
    </div>
  );
};

export default AuthLayout;
