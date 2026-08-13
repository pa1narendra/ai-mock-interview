import type { Metadata } from 'next'
import AuthForm from '@/components/auth-form'

export const metadata: Metadata = {
  title: 'Sign In',
}

const Page = async ({ searchParams }: { searchParams: Promise<{ ref?: string }> }) => {
  const { ref } = await searchParams
  return <AuthForm type="sign-in" referralCode={ref} />
}

export default Page
