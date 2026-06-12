import type { Metadata } from 'next'
import ForgotPasswordForm from '@/components/forgot-password-form'

export const metadata: Metadata = {
  title: 'Forgot Password',
}

const Page = () => {
  return <ForgotPasswordForm />
}

export default Page
