import InterviewCard from '@/components/InterviewCard'
import { Button } from '@/components/ui/button'
import { getCurrentUser } from '@/lib/actions/auth.action'
import { getInterviewByUserId, getLatestInterviews } from '@/lib/actions/general.action'

import Image from 'next/image'
import Link from 'next/link'
import React from 'react'

const page = async () => {
  const user = await getCurrentUser();

  const [userInterviews, latestInterviews] = await Promise.all([
    await getInterviewByUserId(user?.id!),
    await getLatestInterviews({userId: user?.id!})
  ]);
  const hasPastInterviews = userInterviews?.length > 0;

  const hasUpComingInterviews = latestInterviews?.length > 0;
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
        
      {hasPastInterviews ? (
          userInterviews?.map((interview) => (
            <InterviewCard {...interview} key={interview.id}/>
          ))
        ) : (
          <p>No past interviews found</p>
        )    
      }
      </div>
    </section>

    <section className="flex flex-col gap-6 mt-8">
      <h2>Take a mock interview</h2>
      <div className="interviews-section">
      {hasUpComingInterviews ? (
          latestInterviews?.map((interview) => (
            <InterviewCard {...interview} key={interview.id}/>
          ))
        ) : (
          <p>No upcoming interviews found</p>
        )    
      }
      </div>
      
    </section>
    </>
  )
}

export default page