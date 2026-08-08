import Link from "next/link";
import { lock } from "../actions";

export type Step = 1 | 2 | 3;

/**
 * Step 2 has two doors — `/review` (what the analyzer proposed) and `/sections`
 * (pick by hand) — so its label names the stage, not either page. Both write to
 * the same selection store, which is why `/review` is the safe back-link target
 * from step 3 regardless of which door the user came through.
 */
const STEPS: { n: Step; label: string; href: string }[] = [
  { n: 1, label: "Copy & brand", href: "/" },
  { n: 2, label: "Sections", href: "/review" },
  { n: 3, label: "Build", href: "/build" },
];

/**
 * The stepper on its own, so step 3 (`/build`) can show progress too — it
 * carries its own app bar and can't be wrapped in `HubShell` without stacking
 * two headers.
 *
 * A progress indicator, not navigation into work that hasn't happened yet:
 * only steps at or before the current one are links.
 */
export function FlowSteps({ step, className }: { step: Step; className?: string }) {
  return (
    <nav
      aria-label="Progress"
      className={className ?? "mx-auto max-w-[880px] px-4 pt-6"}
    >
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[11.5px]">
        {STEPS.map((s, i) => {
          const state = s.n === step ? "current" : s.n < step ? "done" : "todo";
          const chip = (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 transition ${
                state === "current"
                  ? "bg-[#1A1540] font-semibold text-[#E8E4F5]"
                  : state === "done"
                  ? "text-[#9B82FF] hover:text-[#c3b4ff]"
                  : "text-[#4A4468]"
              }`}
            >
              <span className="tabular-nums opacity-70">{s.n}</span>
              {s.label}
            </span>
          );
          return (
            <li key={s.n} className="flex items-center gap-2">
              {state === "done" ? <Link href={s.href}>{chip}</Link> : chip}
              {i < STEPS.length - 1 && <span className="text-[#2A2250]">→</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Page chrome for steps 1 and 2.
 */
export function HubShell({
  step,
  title,
  blurb,
  children,
}: {
  step: Step;
  title: string;
  blurb: string;
  children: React.ReactNode;
}) {
  return (
    <main className="relative min-h-[100dvh] overflow-x-hidden bg-[#0D0B1F] text-white">
      <div
        aria-hidden
        className="pointer-events-none fixed left-1/2 top-[-100px] z-0 h-[600px] w-[900px] -translate-x-1/2"
        style={{
          background:
            "radial-gradient(ellipse at 50% 30%, rgba(124,92,252,0.13) 0%, transparent 65%)",
        }}
      />

      <div className="relative z-10">
        <header className="border-b border-[#2A2250]">
          <div className="mx-auto flex max-w-[880px] items-center gap-3 px-4 py-2.5">
            <span
              className="grid h-6 w-6 shrink-0 place-items-center rounded-[6px] bg-[#F5C842] text-[11px] font-bold text-[#0D0B1F]"
              style={{ fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)" }}
            >
              F
            </span>
            <span
              className="truncate text-[12.5px] font-semibold"
              style={{ fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)" }}
            >
              Funnel Section Builder
            </span>
            <form action={lock} className="ml-auto shrink-0">
              <button
                type="submit"
                className="rounded-md border border-[#2A2250] px-3 py-1.5 text-[11.5px] text-[#5A5478] transition hover:border-[#F87171] hover:text-[#F87171]"
              >
                Sign out
              </button>
            </form>
          </div>
        </header>

        <FlowSteps step={step} />

        <div className="mx-auto max-w-[880px] px-4 pb-5 pt-4">
          <h1
            className="text-[24px] font-bold leading-tight"
            style={{ fontFamily: "var(--font-space-grotesk, 'Space Grotesk', sans-serif)" }}
          >
            {title}
          </h1>
          <p className="mt-1.5 max-w-[62ch] text-[13px] leading-[1.6] text-[#A09AB8]">{blurb}</p>
        </div>

        {children}
      </div>
    </main>
  );
}
