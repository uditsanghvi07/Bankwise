"use client";

import { BookOpen } from "lucide-react";

import { WidgetHelpModal } from "@/components/widgets/WidgetHelpModal";

const FOIR_TABLE = [
  { type: "Home loan",     band: "40 – 50%",  note: "Banks comfortable up to 50% for higher incomes" },
  { type: "Car loan",      band: "45 – 50%",  note: "Vehicle is collateral, slightly higher cap allowed" },
  { type: "Personal loan", band: "30 – 40%",  note: "Unsecured — banks tighten the FOIR cap" },
  { type: "Business loan", band: "35 – 45%",  note: "Depends on cash-flow proof" },
];

export function EligibilityHelpModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <WidgetHelpModal
      open={open}
      onClose={onClose}
      Icon={BookOpen}
      title="How banks check your loan eligibility"
      subtitle="The 3 numbers every lender looks at — explained simply."
      steps={[
        {
          index: 1,
          title: "FOIR — your debt cap",
          tone: "indigo",
          body: (
            <>
              <p>
                <strong className="text-ink">FOIR</strong> (Fixed Obligations to Income Ratio) is the share of
                your monthly income that goes to all loan EMIs combined. Banks set a ceiling on this — they
                won't lend you more if it pushes total EMIs past their comfort line.
              </p>
              <div className="mt-3 overflow-hidden rounded-lg border border-indigo-200/60">
                <table className="w-full text-xs">
                  <thead className="bg-indigo-100/70 text-indigo-900">
                    <tr>
                      <th className="px-3 py-1.5 text-left font-semibold">Loan type</th>
                      <th className="px-3 py-1.5 text-left font-semibold">Typical FOIR cap</th>
                      <th className="px-3 py-1.5 text-left font-semibold">Why</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-indigo-100 bg-white">
                    {FOIR_TABLE.map((r) => (
                      <tr key={r.type}>
                        <td className="px-3 py-1.5 font-medium text-ink">{r.type}</td>
                        <td className="px-3 py-1.5 font-semibold text-brand-indigo">{r.band}</td>
                        <td className="px-3 py-1.5 text-text-secondary">{r.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ),
        },
        {
          index: 2,
          title: "Calculate your maximum EMI",
          tone: "emerald",
          body: (
            <p>
              The bank works out the largest EMI you can take on top of any existing ones. The formula sits below
              this section.
            </p>
          ),
        },
        {
          index: 3,
          title: "Reverse-EMI to a loan amount",
          tone: "amber",
          body: (
            <p>
              Once they know your max EMI, the bank uses the rate &amp; tenure you can support to back-calculate
              the largest principal that fits — that's your <strong className="text-ink">eligible loan</strong>.
            </p>
          ),
        },
      ]}
      formula={
        <>
          Max EMI = (Monthly income × FOIR%) − Existing EMIs
          <br />
          <span className="text-slate-400">Eligible loan = reverse-EMI(Max EMI, rate, tenure)</span>
        </>
      }
      example={{
        lines: [
          <>Income <strong>₹80,000/mo</strong>, existing EMIs <strong>₹5,000</strong>, home loan @ <strong>8.5% × 20yr</strong>, FOIR cap <strong>50%</strong></>,
          <><strong>Step 1 ·</strong> Income × FOIR cap = ₹80,000 × 50% = <strong className="text-ink">₹40,000</strong></>,
          <><strong>Step 2 ·</strong> Max EMI = ₹40,000 − ₹5,000 = <strong className="text-emerald-700">₹35,000/mo</strong></>,
          <><strong>Step 3 ·</strong> EMI ₹35,000 @ 8.5% × 240mo ≈ <strong className="text-emerald-700">~₹40.5 L eligible</strong></>,
        ],
      }}
      tips={[
        <><strong>CIBIL 750+</strong> unlocks the best rates &amp; tenures; sub-650 may face rejections.</>,
        <><strong>Stable income proof</strong> — 3 months' salary slips, or 2-year ITR if self-employed.</>,
        <><strong>Closing a small EMI</strong> before applying directly boosts headroom.</>,
        <><strong>Co-applicant</strong> — adding a working spouse can effectively double the income input.</>,
      ]}
      footnote="Educational only. Final eligibility is decided by each bank's underwriting policy and may vary based on profession, employer, age, and credit history."
    />
  );
}
