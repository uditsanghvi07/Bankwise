"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { BookOpen, Home, MessageSquare, Sparkles, Wand2 } from "lucide-react";

const ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/advisor", label: "Advisor", icon: Wand2 },
  { href: "/docs", label: "How it works", icon: BookOpen },
] as const;

/** Midnight nav: dark glass + visible indigo/violet glow (active pill + track). */
export function AppNav({ variant = "light" }: { variant?: "light" | "dark" }) {
  const pathname = usePathname() || "/";
  const boost = variant === "dark";

  return (
    <nav
      className={`sticky top-0 z-30 w-full border-b backdrop-blur-xl ${
        boost
          ? "border-indigo-400/25 bg-slate-950/95 text-slate-100 shadow-[0_8px_40px_rgba(0,0,0,0.55),0_0_60px_rgba(79,70,229,0.18)]"
          : "border-indigo-500/20 bg-slate-950/[0.94] text-slate-100 shadow-[0_6px_32px_rgba(0,0,0,0.5),0_0_48px_rgba(99,102,241,0.16)]"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-semibold tracking-tight text-white [-webkit-tap-highlight-color:transparent] outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-[0_0_20px_rgba(129,140,248,0.55),0_0_36px_rgba(167,139,250,0.25)]">
            <Sparkles className="h-5 w-5" />
          </span>
          BankWise AI
        </Link>
        <div
          className={`hidden items-center gap-1 rounded-full p-1 md:flex ${
            boost
              ? "border border-indigo-400/35 bg-slate-950/90 shadow-[inset_0_2px_12px_rgba(0,0,0,0.65),0_0_28px_rgba(99,102,241,0.35),0_0_56px_rgba(124,58,237,0.2)]"
              : "border border-indigo-500/30 bg-slate-950/85 shadow-[inset_0_2px_10px_rgba(0,0,0,0.55),0_0_24px_rgba(99,102,241,0.28),0_0_48px_rgba(79,70,229,0.15)]"
          }`}
        >
          {ITEMS.map((it) => {
            const active = pathname === it.href || (it.href !== "/" && pathname.startsWith(it.href));
            const Icon = it.icon;
            return (
              <Link
                key={it.href}
                href={it.href}
                className={`relative inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-150 [-webkit-tap-highlight-color:transparent] outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
                  active ? "text-white" : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-100"
                }`}
              >
                {active ? (
                  <motion.span
                    layoutId="navpill"
                    className={`absolute inset-0 -z-10 rounded-full bg-gradient-to-r from-indigo-500 via-indigo-500 to-violet-600 ${
                      boost
                        ? "shadow-[0_0_24px_rgba(165,180,252,0.85),0_0_48px_rgba(139,92,246,0.45),0_4px_14px_rgba(0,0,0,0.45)]"
                        : "shadow-[0_0_20px_rgba(165,180,252,0.75),0_0_40px_rgba(139,92,246,0.38),0_4px_12px_rgba(0,0,0,0.4)]"
                    }`}
                    transition={{ type: "spring", stiffness: 520, damping: 38 }}
                  />
                ) : null}
                <Icon className="h-4 w-4" />
                {it.label}
              </Link>
            );
          })}
        </div>
        <Link
          href="/chat"
          className={`rounded-full border px-4 py-2 text-xs font-semibold text-white transition-shadow duration-200 [-webkit-tap-highlight-color:transparent] outline-none md:text-sm ${
            boost
              ? "border-fuchsia-400/35 bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 shadow-[0_0_28px_rgba(167,139,250,0.55),0_0_48px_rgba(99,102,241,0.35)] hover:shadow-[0_0_36px_rgba(196,181,253,0.65),0_0_56px_rgba(129,140,248,0.4)]"
              : "border-indigo-400/40 bg-gradient-to-r from-indigo-600 to-violet-600 shadow-[0_0_22px_rgba(129,140,248,0.5),0_0_40px_rgba(124,58,237,0.25)] hover:shadow-[0_0_30px_rgba(196,181,253,0.55),0_0_48px_rgba(99,102,241,0.35)]"
          } focus-visible:ring-2 focus-visible:ring-indigo-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950`}
        >
          Open console
        </Link>
      </div>
    </nav>
  );
}
