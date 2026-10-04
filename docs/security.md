---
sidebar_position: 7
title: Security & Trust Model
---

# Security & Trust Model

This page documents the security properties Aruna guarantees by design, the known limitations and risks, and the audit status.

---

## Core Security Properties

### 1. Full Collateralization

Every policy's maximum payout (`maxPayout`) is reserved from actual underwriter capital at the moment `buyCover` confirms. The vault cannot sell more cover than it has capital to back.

**Invariant:** `sum(maxPayout for all active policies) ≤ reserved ≤ totalCapital × maxUtilizationBps / 10000`

This invariant holds on every transaction that modifies `reserved`. There is no scenario where a payout is owed but capital is absent.

---

### 2. Flash-Loan Resistant Oracle

The settlement oracle uses Uniswap v3's on-chain **TWAP** (Time-Weighted Average Price), not the spot price from `slot0`.

**Why this matters:** The spot price in `slot0` can be pushed in a single block using a flash loan with no sustained capital cost. An attacker could spike the spot price, trigger an apparent variance event, and claim a fraudulent payout - all in one atomic transaction.

**Why TWAP resists this:**

- The TWAP accumulates over every second of every block. Inflating it requires holding a manipulated price for a sustained period (many minutes or hours), paying real swap fees and opportunity cost throughout.
- Samples are taken as the mean tick over the entire 30-minute interval, not the spot tick at the moment of sampling. A spike lasting only a few seconds is diluted proportionally to its duration.
- A price spike that lasts one block out of 60 × 30 = 1800 blocks in a 30-minute interval contributes less than 0.06% to that sample's `avgTick`.

The cost to materially inflate the TWAP-measured variance is essentially the cost of being a high-variance pool - which is exactly what the product pays out on.

---

### 3. NFT Escrow Prevents Double-Dipping

When an LP buys cover, their position NFT is transferred into the vault's escrow. It stays there until settlement (or cancel).

**Why this matters:** Without escrow, an LP could:

1. Buy cover for a position
2. Observe that realized variance is above their strike
3. Remove their liquidity entirely (realizing the loss without needing the position active)
4. Collect a variance payout on a position that no longer bears any risk

Escrow prevents this. The LP cannot modify or withdraw the position's liquidity while covered. Their trading fees remain accessible via `collectFees(policyId, recipient)`, but the underlying position is locked.

---

### 4. Payout Cap

Every policy's payout is bounded by `maxPayout` - a number fixed at purchase time and backed by reserved capital. The LP cannot receive more than `maxPayout`, regardless of how violent the actual variance was.

**From the LP's perspective:** maximum gain is `maxPayout − premium`. Maximum loss is `premium`.

**From the underwriter's perspective:** maximum loss per policy is bounded by `maxPayout` which is bounded by `reserved`, which is bounded by `totalCapital × maxUtilizationBps`. At the worst possible outcome (every policy hits its cap simultaneously), underwriters absorb at most their proportional share of total claims.

---

### 5. Settlement is Permissionless

`finalize(cohortId)` and `settleBatch(cohortId, n)` can be called by anyone. Aruna runs keeper bots as a convenience, but settlement does not depend on any privileged address. If Aruna's infrastructure goes offline:

1. Anyone can call `finalize` after `cohort.endsAt`
2. Anyone can call `settleBatch` repeatedly until all policies are settled
3. LPs can also call `settlePolicy(cohortId, policyId)` individually
4. Unclaimed payouts and NFTs are parked in the contract and retrievable via `claimPosition` and `claimUnclaimed` - they do not expire

---

### 6. Predictable Calendar

Cohort start times are derived from a fixed formula anchored at vault creation. No on-chain entity can delay or accelerate a cohort. The calendar is fully known in advance and computable by anyone from the vault's `anchor`, `tenor`, and `gap` parameters.

---

## Known Limitations

### Basis Risk

Aruna's oracle measures **realized tick variance** on the Uniswap v3 pool's TWAP. This is a proxy for LP loss, not a direct measurement of it.

Actual LP loss depends on:

- The specific range of your position (in vs. out of range)
- The path of price within the range
- Gas costs and timing of rebalances

A policy with a given `strikeVariance` and `varNotional` may over- or under-compensate depending on your exact position geometry and the specific price path. **Aruna does not guarantee full hedge effectiveness.**

### TWAP Smoothing Bias

Because the TWAP averages tick values over 30-minute intervals, **short-duration high-variance events are smoothed out**. A 5-minute flash crash that fully recovers within the sample window contributes much less variance to the measurement than a sustained 30-minute move of the same magnitude.

This is conservative for LPs (you receive less payout than the spot-measured event would imply) but is an intentional property for manipulation resistance.

### Degraded Mode

If keeper bots fail to sample for an extended period, the measurement window may be too small for accurate settlement. Policies with fewer than 2 valid return intervals are refunded (not settled), but degraded policies (some gaps, still measurable) proceed with an underestimated variance. Degraded payouts are lower than expected. The `degraded` flag is visible in all UI views.

### v0 Bug (SC-01)

The v0 deployment has a known bug where `withdraw` during FUNDING does not correctly reduce `totalCapital`. This was fixed in v2. All v0 addresses are deprecated; never use them for live interaction.

---

## Audit Status

:::warning
Aruna is currently on testnet and has **not been audited**. Do not use testnet contracts to draw conclusions about mainnet security. All contracts are subject to change before mainnet launch.
:::

An audit is planned prior to mainnet deployment. This page will be updated with the audit report and any findings once available.

---

## Admin Keys

The current v2 deployment has **no admin keys and no upgrade proxy**. Contracts are immutable once deployed. The factory's `ReleaseGuard` prevents deploying contracts with modified bytecode. There is no governance token, no multisig with upgrade authority, and no pause function.

This means:

- No one can modify the settlement logic after deployment
- No one can freeze or drain the vault
- No one can change the oracle source

It also means that if a critical bug is found, **the contracts cannot be patched in place**. Migration to a new deployment is the only remedy.
