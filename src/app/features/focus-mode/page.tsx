import { MarketingPage } from "@/components/ui/marketing-page"

export const metadata = {
  title: "Focus Mode — Distraction-Free AI Chat",
  description:
    "Simplicity's Focus mode dims distractions, runs a session timer, and adapts its tone across Light, Deep, and Study levels — an AI assistant built for deep work.",
  alternates: { canonical: "/features/focus-mode" },
}

const FAQ = [
  {
    q: "What is Focus mode in Simplicity?",
    a: "Focus mode is a distraction-reduction layer built into the chat interface. It dims the surrounding UI, keeps a visible session timer running, and shifts Simplicity's own tone and pacing to match how deep you want to go — Light for a quick task, Deep for extended concentration, or Study for structured learning sessions.",
  },
  {
    q: "How do I turn on Focus mode?",
    a: "Open the command palette (Ctrl/Cmd+K) in chat and choose Focus mode, or toggle it from the chat toolbar. You can pick Light, Deep, or Study, and switch levels mid-session without losing your conversation.",
  },
  {
    q: "Does Focus mode change how Simplicity responds?",
    a: "Yes. In Deep and Study modes, Simplicity trims filler, favors concise and structured answers, and avoids side conversations — the goal is to keep you moving on the task at hand rather than chatting.",
  },
  {
    q: "Can I adjust dimming and animation intensity?",
    a: "Yes — the Settings page has separate dimming and animation-speed controls for normal mode and Focus mode, so you can tune exactly how much the interface recedes when you're concentrating.",
  },
]

export default function FocusModePage() {
  return (
    <MarketingPage
      eyebrow="Features · Focus mode"
      title="Distraction-free AI, built for deep work."
      intro="Most AI chat apps look the same whether you're casually asking a question or trying to get three hours of real work done. Simplicity's Focus mode changes that — it recognizes when you need to concentrate and reshapes itself around that goal."
      faq={FAQ}
    >
      <div>
        <h2 className="text-xl font-semibold text-foreground">Three levels, one goal: less friction</h2>
        <p className="mt-3">
          Focus mode in Simplicity has three levels — <strong className="text-foreground">Light</strong> for a
          quick, low-friction task; <strong className="text-foreground">Deep</strong> for long, uninterrupted
          concentration; and <strong className="text-foreground">Study</strong> for structured learning sessions
          with a built-in dictionary lookup for unfamiliar terms. Each level dims the ambient shader
          background further and slows its animation, so the visual noise around your conversation
          fades the deeper you go.
        </p>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-foreground">A visible timer keeps you honest</h2>
        <p className="mt-3">
          Every Focus session runs a live timer in the chat toolbar. It's a small thing, but it turns
          an open-ended AI conversation into something closer to a Pomodoro session — you can see
          exactly how long you've been working, without switching to a separate timer app.
        </p>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-foreground">Simplicity adapts, not just the UI</h2>
        <p className="mt-3">
          Dimming the screen is easy; changing how an AI assistant talks to you is the harder part.
          In Deep and Study modes, Simplicity's responses get shorter, more direct, and less
          conversational — it behaves like a tool you're using to finish something, not a chatbot
          you're chatting with. Switch back to normal mode any time and the tone opens back up.
        </p>
      </div>
    </MarketingPage>
  )
}
