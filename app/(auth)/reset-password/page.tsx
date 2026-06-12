import type { Metadata } from 'next'
import { Suspense } from 'react'
import ResetPasswordForm from '@/components/reset-password-form'

export const metadata: Metadata = {
  title: 'Reset Password',
}

const Page = () => {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  )
}

export default Page
