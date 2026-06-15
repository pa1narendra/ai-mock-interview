interface ResumeProfile {
  summary: string;
  skills: string[];
  yearsOfExperience: string;
  highlights: string[];
  claimsToProbe: string[];
}

interface FitSnapshot {
  matchScore: number;
  verdict: string;
  matchedSkills: string[];
  missingSkills: string[];
  talkingPoints: string[];
}

interface JdMatch {
  coverageScore: number;
  gapsAddressed: string[];
  gapsRemaining: string[];
  comment: string;
}

interface SharedReport {
  role: string;
  totalScore: number;
  categoryScores: Array<{ name: string; score: number; comment: string }>;
  strengths: string[];
  areasForImprovement: string[];
  finalAssessment: string;
  questionFeedback: QuestionFeedback[] | null;
  createdAt: string;
}

interface ScorePoint {
  createdAt: string;
  totalScore: number;
  categoryScores: Array<{ name: string; score: number; comment: string }>;
}

interface QuestionFeedback {
  question: string;
  answerSummary: string;
  score: number;
  feedback: string;
  idealAnswer: string;
}

interface InterviewReport {
  id: string;
  interviewId: string;
  totalScore: number;
  categoryScores: Array<{
    name: string;
    score: number;
    comment: string;
  }>;
  strengths: string[];
  areasForImprovement: string[];
  finalAssessment: string;
  jdMatch?: JdMatch | null;
  questionFeedback?: QuestionFeedback[] | null;
  attempt: number;
  shareId?: string | null;
  createdAt: string;
}

interface Interview {
  id: string;
  role: string;
  level: string;
  questions: string[];
  techstack: string[];
  createdAt: string;
  userId: string;
  type: string;
  jdText?: string | null;
  resumeSnapshot?: ResumeProfile | null;
  fitSnapshot?: FitSnapshot | null;
  voice?: string | null;
}

interface SavedMessage {
  role: "user" | "assistant";
  content: string;
}

interface User {
  name: string;
  email: string;
  id: string;
}

interface RouteParams {
  params: Promise<Record<string, string>>;
  searchParams: Promise<Record<string, string>>;
}

type FormType = "sign-in" | "sign-up";
