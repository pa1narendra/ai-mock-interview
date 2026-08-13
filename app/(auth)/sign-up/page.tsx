import type { Metadata } from 'next'
import AuthForm from '@/components/auth-form'

export const metadata: Metadata = {
  title: 'Sign Up',
}

const Page = async ({ searchParams }: { searchParams: Promise<{ ref?: string }> }) => {
  const { ref } = await searchParams
  return <AuthForm type="sign-up" referralCode={ref} />
}

export default Page
