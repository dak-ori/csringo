export type ProblemType = 'fill_blank' | 'drag_order' | 'logic_flow'
export type LeagueType = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'

export interface Course {
  id: string
  slug: string
  title: string
  description: string | null
  icon: string | null
  order_index: number
}

export interface Chapter {
  id: string
  course_id: string
  slug: string
  title: string
  order_index: number
}

export interface Card {
  title: string
  content: string
}

export interface Lesson {
  id: string
  chapter_id: string
  slug: string
  title: string
  cards: Card[]
  concept_tags: string[]
  order_index: number
  xp_reward: number
  estimated_minutes: number
}

export interface FillBlankContent {
  question: string
  blank_count: number
}

export interface DragOrderContent {
  question: string
  items: string[]
}

export interface LogicFlowContent {
  question: string
  steps: string[]
  blank_index: number
  options: string[]
}

export type ProblemContent = FillBlankContent | DragOrderContent | LogicFlowContent

export interface Problem {
  id: string
  lesson_id: string
  type: ProblemType
  content: ProblemContent
  correct_answer: string[]
  hint: string | null
  concept_tags: string[]
  order_index: number
  xp_reward: number
}

export interface UserProfile {
  id: string
  username: string
  hearts: number
  hearts_last_refill: string
  streak: number
  last_lesson_date: string | null
  total_xp: number
  league: LeagueType
  created_at: string
}

export interface UserProgress {
  id: string
  user_id: string
  lesson_id: string
  status: 'completed'
  completed_at: string | null
}

export interface WrongAnswer {
  id: string
  user_id: string
  problem_id: string
  user_answer: string[] | null
  wrong_count: number
  last_wrong_at: string
}

export interface ReviewQueueItem {
  id: string
  user_id: string
  problem_id: string
  priority: number
  added_at: string
  reviewed_at: string | null
  problem?: Problem
}

export interface SubmitResult {
  correct: boolean
  xp_earned?: number
  hearts_remaining?: number
}

export interface CompleteResult {
  xp_earned: number
  total_xp: number
  streak: number
  leveled_up: boolean
  new_level: number
}
