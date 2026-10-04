---
sidebar_position: 8
title: FAQ & Glossary
---

# FAQ & Glossary

---

## FAQ

### What does Aruna protect against?

Aruna pays out when a Uniswap v3 pool's realized variance (accumulated squared price movements) exceeds your chosen strike level over a fixed period. It is specifically designed to compensate for the **Loss-Versus-Rebalancing (LVR)** cost that LPs bear - the path-dependent drag that occurs even when the pool's price returns to its starting point.

It does **not** pay out based on where the price ends up (directional loss), whether your position went out of range, or any external price feed.

---

### How is the premium calculated?

The premium is computed from:

1. Your position's `varNotional` (derived from your liquidity amount and tick range)
2. The EWMA (Exponentially Weighted Moving Average) of recent realized variance on the pool
3. Your chosen strike level
4. How much time remains in the current cohort

An LP joining halfway through a cohort pays roughly half the premium of one joining at the start, because they are exposed to half the variance accumulation window.

---

### Can I lose more than my premium?

No. The premium is your maximum loss, always. This is a structural guarantee enforced by the contract.

---

### What happens to my Uniswap trading fees while covered?

Your fees are untouched. You can collect them at any time via `collectFees(policyId, recipient)`. Aruna never touches your fee earnings.

---

### Why does my NFT move into the vault?

Escrow prevents you from removing your liquidity while holding a variance payout that is uncorrelated with your actual current position. Without escrow, you could hedge, remove your liquidity, and collect a payout on a position that no longer bears any variance risk - turning the cover into a naked variance bet at the underwriters' expense.

---

### What if I want to exit before the cohort ends?

Call `cancel(policyId)`. Your NFT is returned immediately. The premium is not refunded. The reserved vault capacity is released and becomes available for other LPs.

---

### What happens if the keeper bot goes offline?

Settlement is permissionless - anyone can call `finalize` and `settleBatch`. If the Aruna keeper bots are offline:

1. Call `VarianceAccumulator.poke()` yourself every ~30 minutes to keep sampling
2. After `cohort.endsAt`, call `CoverVault.finalize(cohortId)` then `settleBatch(cohortId, n)` repeatedly
3. If sampling stopped early, some policies may be degraded or unmeasurable

Unmeasurable policies (fewer than 2 valid return intervals) receive full premium refunds. Degraded policies (some gaps, still measurable) proceed with the available samples.

---

### What is the gap between cohorts?

After a cohort's tenor ends, there is a fixed settlement gap before the next cohort begins. During this gap, **LP positions are not covered**. This is by design - if you paid for 7 days of cover, you receive exactly 7 days, not 7 days plus settlement overhead. Plan your cover purchases to account for the gap.

---

### Can underwriters withdraw early?

No. Capital is locked from `deposit` until the cohort's final SETTLED state. There is no early withdrawal. Policies are sold against your capital, and it must remain available to back potential payouts for the entire duration.

---

### Is Aruna audited?

Not yet. Aruna is currently on testnet. An audit is planned before mainnet launch. See [Security & Trust Model](/docs/security) for full details.

---

### What chain is Aruna on?

Currently Arbitrum Sepolia (testnet, chain ID 421614). No mainnet deployment exists yet.

---

## Glossary

### Annualized Variance

The realized variance of an asset's log-returns, scaled to a one-year equivalent. Aruna computes this as `(realizedSumSq / N) × PPY` where `PPY = 17,520` (for 30-minute samples). A pool with 63.7% annualized volatility has annualized variance of `0.637² ≈ 0.406`.

### Basis Risk

The risk that Aruna's payout does not perfectly match your actual LP loss in a given period. The oracle measures TWAP-based tick variance, which is a proxy for LP drag - not a direct measurement of your position's specific profit and loss.

### Cohort

A fixed-duration insurance cycle within a vault. All policies in a cohort settle simultaneously at the end of the tenor. LPs can join at any point during the ACTIVE phase and pay a pro-rata premium for the remaining time.

### cumulativeSumSq

The running sum of `(avgTick[i] − avgTick[i−1])²` stored in each `Sample`. A policy's realized variance is derived from the difference in `cumulativeSumSq` between its start and end sample indices.

### Degraded

A cohort or policy where sampling gaps exist but the measurement window is still large enough to proceed. Degraded measurements bias toward underwriters (variance is underestimated). No refund is issued.

### EWMA (Exponentially Weighted Moving Average)

The smoothed variance estimate used for premium pricing. Updated at each sample: `ewma[i] = α × increment[i] + (1 − α) × ewma[i−1]`. Used for pricing only - not for settlement.

### Gap

The period between a cohort's tenor end and the next cohort's start. LP positions are not covered during the gap.

### Keeper

A bot (or any external caller) that calls `keeperPoke` and `keeperFinalize`. Keepers are incentivized by a budget funded from cohort premiums. Settlement functions are permissionless - keepers are a convenience, not a dependency.

### LVR (Loss-Versus-Rebalancing)

The path-dependent cost of providing liquidity in an AMM. Unlike impermanent loss (which measures only start-vs-end price change), LVR captures the drag from every small price movement while the position is active. LVR is proportional to variance and independent of price direction. See [Impermanent Loss & LVR](/docs/how-it-works/impermanent-loss) for the full explanation.

### maxPayout

The maximum USDC an LP can receive at settlement. Fixed at purchase time. Backed by reserved vault capital. Cannot exceed the available vault capacity at the time of purchase.

### maxUtilizationBps

A vault parameter limiting how much of total underwriter capital can ever be reserved for active policies. E.g., 8000 = 80%. Ensures a buffer of uncommitted capital always exists.

### Policy

One LP's cover purchase within a cohort. Identified by `policyId`. Contains `varNotional`, `strikeAnnualized`, `maxPayout`, `premium`, `startIndex`, and `startSumSq` - all fixed at purchase time.

### PPY (Periods Per Year)

The number of sample intervals in a year. For 30-minute samples: `365 × 24 × 2 = 17,520`. Used to annualize realized variance.

### Premium

The USDC an LP pays upfront to buy cover. Also their maximum possible loss. Non-refundable except in the unmeasurable case.

### Realized Variance

The sum of squared log-return increments measured over the cohort window, annualized. Computed from `cumulativeSumSq` delta over the policy's measurement window.

### Reserved

The portion of vault capital committed to back active (unsettled) policies. `reserved = sum(maxPayout for all active policies)`.

### StrikeAnnualized

The annualized volatility threshold chosen by the LP. Cover only pays when realized variance exceeds `strike²`. Scaled to 1e18 in contract storage (e.g., 35% annualized = `350000000000000000`).

### Sample

One TWAP measurement point stored by `VarianceAccumulator`. Contains `timestamp`, `avgTick`, `cumulativeSumSq`, and `increment`.

### Tenor

The duration of a cohort's active coverage period in seconds. Current production tenors: 7, 14, or 28 days. The current sandbox uses 3600 seconds (1 hour) for testing.

### TWAP (Time-Weighted Average Price)

The time-average of a pool's tick over a window, derived from Uniswap v3's on-chain `tickCumulative` accumulator. Used by the oracle because it cannot be manipulated with a flash loan (unlike spot price).

### Unmeasurable

A policy whose measurement window contains fewer than 2 valid return intervals (an extreme case, usually from sustained keeper outage). Settlement outcome: payout = 0, premium fully refunded, NFT returned.

### varNotional

The sensitivity of an LP position's value to realized variance. Derived from the position's liquidity amount `L` and tick range: `varNotional ≈ L × (√tickUpper − √tickLower)`. Computed by `PositionValuer` at purchase time.
