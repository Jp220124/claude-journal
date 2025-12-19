import Link from 'next/link'
import { BookOpen, CheckCircle, Calendar, BarChart3, ArrowRight } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <header className="border-b border-[var(--border)]">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="p-2 bg-[var(--primary)]/10 rounded-lg">
              <BookOpen className="w-5 h-5 text-[var(--primary)]" />
            </div>
            <span className="font-semibold text-lg">Daily Journal</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary)]/90 transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Your Daily Companion for
            <span className="text-[var(--primary)]"> Mindful Living</span>
          </h1>
          <p className="text-xl text-[var(--muted-foreground)] mb-8 max-w-2xl mx-auto">
            Track your daily tasks, journal your thoughts, and build better habits.
            A simple, beautiful way to organize your day.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-md text-base font-medium h-12 px-6 bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary)]/90 transition-colors"
            >
              Start Free
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-md text-base font-medium h-12 px-6 border border-[var(--border)] hover:bg-[var(--muted)] transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Preview */}
      <section className="py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-2xl overflow-hidden">
            <div className="p-6 md:p-8">
              {/* Sample daily view */}
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold">Today&apos;s Journal</h3>
                  <span className="text-sm text-[var(--muted-foreground)]">December 17, 2024</span>
                </div>

                {/* Sample section */}
                <div className="border border-[var(--border)] rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-2xl">☀️</span>
                    <div>
                      <h4 className="font-semibold text-[#FFA500]">Morning</h4>
                      <p className="text-xs text-[var(--muted-foreground)]">2/3 tasks completed</p>
                    </div>
                  </div>
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded border-2 border-yellow-500 bg-[var(--primary)] flex items-center justify-center">
                        <CheckCircle className="w-3 h-3 text-white" />
                      </div>
                      <span className="text-sm line-through text-[var(--muted-foreground)]">Wake up early</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded border-2 border-yellow-500 bg-[var(--primary)] flex items-center justify-center">
                        <CheckCircle className="w-3 h-3 text-white" />
                      </div>
                      <span className="text-sm line-through text-[var(--muted-foreground)]">Morning routine</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded border-2 border-yellow-500"></div>
                      <span className="text-sm">Plan the day</span>
                    </div>
                  </div>
                  <div className="border-t border-[var(--border)] pt-4">
                    <p className="text-sm text-[var(--muted-foreground)]">Journal Entry</p>
                    <p className="text-sm mt-1">Had a great morning! Woke up feeling refreshed...</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 bg-[var(--muted)]/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            Everything you need to stay organized
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <FeatureCard
              icon={<CheckCircle className="w-6 h-6" />}
              title="Daily Tasks"
              description="Create recurring tasks for each section of your day"
            />
            <FeatureCard
              icon={<BookOpen className="w-6 h-6" />}
              title="Rich Journaling"
              description="Write detailed reflections with formatting and mood tracking"
            />
            <FeatureCard
              icon={<Calendar className="w-6 h-6" />}
              title="Calendar View"
              description="Browse your past entries and track your progress"
            />
            <FeatureCard
              icon={<BarChart3 className="w-6 h-6" />}
              title="Statistics"
              description="See your streaks, completion rates, and mood trends"
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">
            Start your journaling journey today
          </h2>
          <p className="text-[var(--muted-foreground)] mb-8">
            Free to use. No credit card required.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-md text-base font-medium h-12 px-8 bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary)]/90 transition-colors"
          >
            Create Free Account
            <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] py-8 px-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[var(--primary)]" />
            <span className="text-sm text-[var(--muted-foreground)]">Daily Journal</span>
          </div>
          <p className="text-sm text-[var(--muted-foreground)]">
            Built with Next.js and Supabase
          </p>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="p-6 bg-[var(--card)] rounded-lg border border-[var(--border)]">
      <div className="p-2 bg-[var(--primary)]/10 rounded-lg w-fit mb-4 text-[var(--primary)]">
        {icon}
      </div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm text-[var(--muted-foreground)]">{description}</p>
    </div>
  )
}
