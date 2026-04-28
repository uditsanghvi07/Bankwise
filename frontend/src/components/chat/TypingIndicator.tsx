"use client";

import { motion } from "framer-motion";
import { Landmark } from "lucide-react";

export function TypingIndicator() {
  return (
    <div className="flex w-full justify-start">
      <div className="flex max-w-[min(92%,42rem)] items-start gap-2">
        <span
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-sm ring-1 ring-primary/35"
          aria-label="BankWise AI is typing"
        >
          <Landmark className="h-4 w-4" aria-hidden strokeWidth={2} />
        </span>
        <div className="chat-bubble-ai-3d rounded-[20px] rounded-bl-[4px] px-4 py-3">
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="h-2 w-2 rounded-full bg-primary/50"
                animate={{ opacity: [0.35, 1, 0.35] }}
                transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
