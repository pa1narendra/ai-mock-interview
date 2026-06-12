import type { Metadata } from 'next'
import AuthForm from '@/components/auth-form'

export const metadata: Metadata = {
  title: 'Sign Up',
}

const Page = () => {
  return <AuthForm type="sign-up"/>
}

export default Page
