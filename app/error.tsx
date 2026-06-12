'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <h2>Something went wrong</h2>
      <p className="max-w-md text-center">
        An unexpected error occurred. Please try again, and if the problem persists, come back later.
      </p>
      <button className="btn-spark" onClick={() => reset()}>
        Try again
      </button>
    </div>
  )
}
