import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <h1 className="text-6xl text-highlight">404</h1>
      <p className="max-w-md text-center">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link href="/" className="btn-spark">
        Back home
      </Link>
    </div>
  )
}
