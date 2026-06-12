import type { Metadata } from 'next'
import AuthForm from '@/components/auth-form'

export const metadata: Metadata = {
  title: 'Sign In',
}

const Page = () => {
  return <AuthForm type="sign-in"/>
}

export default Page
