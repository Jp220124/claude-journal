// Demo mode configuration
// Demo account email for showcasing the app with sample data
export const DEMO_EMAIL = 'demo@journalapp.com'

// Check if user is using demo account
export function isDemoAccount(email: string | null | undefined): boolean {
  if (!email) return false
  return email.toLowerCase() === DEMO_EMAIL.toLowerCase()
}

// Demo data for Dashboard
export const demoDashboardData = {
  wordsWritten: 1240,
  wordsChange: 12,
  focusTime: '4h 20m',
  pendingTasksCount: 4,
  todaysReflection: {
    time: '10:30 AM',
    weather: 'Sunny, 72°F',
    title: 'Tuesday Thoughts: Focus & Clarity',
    content: `Today started with a clear focus on the upcoming product launch. I managed to wake up early and get a run in before the sun fully rose. The quiet morning hours are becoming my favorite time to think.`,
    preview: `I need to remember to follow up with the design team regarding the new assets. It feels like we are slightly behind schedule, but...`
  },
  dailyQuote: {
    text: 'The secret of getting ahead is getting started.',
    author: 'Mark Twain'
  },
  tasks: [
    { id: '1', title: 'Review Project X Proposal', priority: 'high', dueTime: '5:00 PM', completed: false },
    { id: '2', title: 'Call Client about updates', priority: 'medium', dueTime: 'Tomorrow', completed: false },
    { id: '3', title: 'Update Journal Template', priority: 'low', completed: false },
    { id: '4', title: 'Morning Standup Meeting', priority: 'medium', completedAt: '9:30 AM', completed: true },
  ],
  progress: 65
}

// Demo data for Today/Tasks page
export const demoTasksData = [
  {
    id: '1',
    title: 'Review Q4 Marketing Strategy',
    completed: false,
    priority: 'high' as const,
    dueTime: '2:00 PM',
    category: 'Marketing Team',
    notes: 'Need to double check the budget allocation for Q4 before finalizing the slide deck.\n- Confirm with finance\n- Update slide 14\n- Export to PDF'
  },
  {
    id: '2',
    title: 'Update client presentation slides',
    completed: false,
    priority: 'medium' as const,
    recurrence: 'Daily',
  },
  {
    id: '3',
    title: 'Email design team about assets',
    completed: false,
    priority: 'low' as const,
  },
  {
    id: '4',
    title: 'Morning Standup Meeting',
    completed: true,
    priority: 'medium' as const,
  },
]

// Demo data for Calendar page
export const demoCalendarData: { [key: string]: { hasEntry: boolean; hasTask: boolean; activityLevel?: number } } = {
  '2025-12-02': { hasEntry: true, hasTask: false },
  '2025-12-07': { hasEntry: true, hasTask: true, activityLevel: 70 },
  '2025-12-10': { hasEntry: true, hasTask: false },
  '2025-12-12': { hasEntry: true, hasTask: false, activityLevel: 80 },
  '2025-12-15': { hasEntry: true, hasTask: false },
  '2025-12-17': { hasEntry: true, hasTask: true, activityLevel: 40 },
  '2025-12-22': { hasEntry: true, hasTask: false },
}

export const demoCalendarSidebar = {
  streak: 5,
  tasksProgress: 75,
  journal: {
    time: '10:42 AM',
    mood: 'Productive',
    content: `Had a great brainstorming session today regarding the new UI update. We decided to pivot towards a cleaner, more minimalist aesthetic that relies heavily on typography. I'm feeling really optimistic about the direction we're heading.`,
    images: [
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=200&auto=format&fit=crop&q=60',
      'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=200&auto=format&fit=crop&q=60',
    ],
    moreImages: 2
  },
  tasks: [
    { id: '1', title: 'Review design mockups', completed: true },
    { id: '2', title: 'Email client regarding timeline', completed: false },
    { id: '3', title: 'Update system dependencies', completed: false },
  ]
}

// Demo data for Search page
export const demoSearchResults = [
  {
    id: '1',
    type: 'task' as const,
    title: 'Finalize Project Alpha UI Mockups',
    content: 'Review the high-fidelity screens with the design team. Ensure all components use the new design system variables.',
    date: 'Oct 24, 2023',
    priority: 'high' as const,
    tags: ['#ProjectAlpha'],
    completed: false,
  },
  {
    id: '2',
    type: 'journal' as const,
    title: 'Reflection on Team Sync',
    content: 'Had a great idea for the new feature in Project Alpha while discussing the roadmap. We should focus on modularity first...',
    date: 'Oct 22, 2023',
    tags: ['#ProjectAlpha', '#Ideas'],
  },
  {
    id: '3',
    type: 'done' as const,
    title: 'Setup Project Alpha Repo',
    content: 'Initial commit and README setup.',
    date: 'Oct 20, 2023',
    tags: ['#ProjectAlpha', '#Dev'],
    completed: true,
  },
  {
    id: '4',
    type: 'journal' as const,
    title: 'Kickoff Meeting Notes',
    content: 'Met with stakeholders for Project Alpha. Key takeaways include aggressive timeline and need for darker UI mode...',
    date: 'Sep 15, 2023',
    tags: ['#ProjectAlpha', '#Meeting'],
  },
]

// Demo data for Journal page
export const demoJournalEntry = {
  title: 'Reflecting on Progress',
  mood: 'Productive',
  tags: ['#reflection', '#work'],
  content: `<p>Today was unexpectedly productive. I managed to clear out my inbox by 10 AM, which set a really positive tone for the rest of the day. The new project proposal is finally taking shape, and I feel much more confident about the direction we're heading.</p>
<h3>Wins for the day:</h3>
<ul>
<li>Completed the Q3 slide deck draft.</li>
<li>Sent out the meeting invites for the workshop next week.</li>
<li>Finally organized my digital workspace (files, folders, etc.).</li>
</ul>
<blockquote>"The secret of getting ahead is getting started." — Mark Twain</blockquote>
<p>I need to remember this quote when I'm feeling overwhelmed. Just taking that first small step usually breaks the inertia. Tomorrow, the goal is to review the analytics and start outlining the blog post.</p>`,
  image: {
    url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&auto=format&fit=crop&q=60',
    alt: 'Morning misty forest landscape with sunbeams through trees',
    name: 'Morning walk view.jpg',
    size: '2.4 MB'
  },
  stats: {
    words: 342,
    minutes: 4
  }
}

// Demo sidebar data
export const demoSidebarData = {
  streak: 12,
  streakProgress: 75
}
