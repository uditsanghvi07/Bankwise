# NACH / e-mandate (educational)

## KB:nach-001

**NACH (National Automated Clearing House)** is the NPCI-operated rail used for recurring debits across Indian banks. It powers loan EMIs, mutual fund SIPs, insurance premiums, utility bills, and salary credits at scale. A failed NACH debit (insufficient balance, frozen account, mandate mismatch) usually attracts a bounce charge — typically ₹250–₹500 per failed presentation — and a repeat failure may damage your credit profile if the lender reports it.

## KB:nach-002

**Switching banks while keeping running EMIs / SIPs**:

1. Set up the new salary account at least one full salary cycle before the switch.
2. Register fresh e-mandates from the new account *before* cancelling the old ones.
3. Keep a buffer (2–3x the largest debit) in the old account for one extra cycle to absorb any in-flight presentations.
4. Confirm with each lender / AMC that the new mandate is "active", not just "submitted".

A debit can fail simply because the lender presented it on the *old* mandate one last time after you stopped funding the old account.

## KB:nach-003

**Common NACH failure codes** customers see and what they typically mean:

* `Insufficient Funds` — most common, fix with a balance buffer 2–3 days before the debit date.
* `Account Blocked / Frozen` — KYC issue or court attachment; resolve with the bank, not the lender.
* `Mandate Not Active / Cancelled` — lender hasn't received an active mandate; re-register.
* `Signature Mismatch` (paper mandates) — replaced by e-NACH for most retail products since 2018.

## KB:nach-004

**E-NACH vs paper NACH** — e-NACH is the Aadhaar / net-banking authorised digital flow that activates within minutes; paper NACH is the older signed form that takes 7–15 working days for banker verification. New retail loans are almost universally e-NACH today.
