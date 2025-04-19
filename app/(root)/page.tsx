import InterviewCard from '@/components/InterviewCard'
import { Button } from '@/components/ui/button'
import { dummyInterviews } from '@/constants'
import Image from 'next/image'
import Link from 'next/link'
import React from 'react'

const page = () => {
  return (
    <>
    <section className="card-cta">
      <div className="flex flex-col gap-6 max-w-lg">
        <h2>Get Interview Ready with AI</h2>
        <p className="text-lg">
          Practice on your own with AI guiding you.
        </p>
        <Button asChild className="btn-primary max-sm:w-full">
          <Link href="/interview">Get Started with the Interview</Link>
        </Button>
      </div>

      <Image src="/robot.png" alt="robot" width={400} height={400} className="max-sm:hidden" />
    </section>

    <section className="flex flex-col gap-6 mt-8">
      <h2>Your Interviews</h2>

      <div className="interviews-section">
      {dummyInterviews.map((interview) =>(
        <InterviewCard {...interview} key={interview.id}/>
      ))}
      </div>
    </section>

    <section className="flex flex-col gap-6 mt-8">
      <h2>Take a mock interview</h2>
      <div className="interviews-section">
      {dummyInterviews.map((interview) =>(
        <InterviewCard {...interview} key={interview.id}/>
      ))}
      </div>
      
    </section>
    </>
  )
}

export default page