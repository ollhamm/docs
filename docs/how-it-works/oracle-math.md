---
sidebar_position: 5
title: Oracle & Settlement Math
---

# Oracle & Settlement Math

How Aruna measures realized variance, computes payouts, and why it cannot be gamed with a flash-loan price spike.

---

## The Oracle: Uniswap v3 TWAP

Uniswap v3 maintains an on-chain **tick accumulator** - a running sum of the pool's current tick, updated every block. The pool exposes this via `observe(secondsAgos[])`, which returns the time-weighted average tick over any historical window.

Aruna's `VarianceAccumulator` contract reads this accumulator at regular intervals (every 30 minutes in production) and builds a **sample record** of mean ticks and squared log-return increments.

### Why ticks, not prices?

Uniswap v3 prices are encoded as ticks, where:

```
price = 1.0001^tick
log(price) = tick × log(1.0001)
```

Ticks **are** log prices (up to a constant). This means `Δtick = tick_i − tick_{i-1}` is directly a log-price return. No price conversion is needed. No external price feed is consulted. The computation is entirely self-contained within the pool and accumulator.

---

## Variance Accumulation

At each sample interval, the keeper calls `VarianceAccumulator.poke()` (or `keeperPoke()` on the vault). This reads the pool's `observe()` for the last two intervals and records a new `Sample`:

```solidity
struct Sample {
    uint32  timestamp;
    int56   tickCumulative;
    int24   avgTick;          // mean tick over the interval since last sample
    uint128 cumulativeSumSq;  // running sum of squared increments
    uint16  elapsed;          // seconds since last sample
}
```

The **increment** added to `cumulativeSumSq` at each step is:

```
increment = (avgTick[i] − avgTick[i−1])²
```

This is the squared log-return increment. Summing them gives:

```
cumulativeSumSq[n] = Σᵢ (avgTick[i] − avgTick[i−1])²
```

---

## Realized Variance Formula

For a policy covering from sample index `startIndex` to `endIndex`, the annualized realized variance is:

```
N = endIndex − startIndex          // number of return intervals

realizedSumSq = finalSumSq − startSumSq

realizedVariance = (realizedSumSq / N) × PPY
```

Where `PPY` is the number of sample intervals per year:

```
PPY = 365 × 24 × (3600 / sampleInterval)
    = 365 × 24 × 2   (for 30-minute intervals)
    = 17,520
```

The result is an **annualized variance** in the same units as `strike²`. A realized vol of 63.7% corresponds to realized variance of `0.637² = 0.4058`.

---

## Payout Formula

The payout for a policy is:

```
excessVariance = max(0, realizedVariance − strikeVariance)

payout = min(maxPayout, varNotional × excessVariance)
```

Where `strikeVariance = (strikeAnnualized / 1e18)²` and `varNotional` is derived from the position's geometry.

**Net result for LP:**

```
net = payout − premium
```

The maximum possible net gain is `maxPayout − premium`. The maximum possible loss is `premium`.

---

## varNotional - Connecting Position to Payout

`varNotional` is the sensitivity of the LP's position value to variance. It is derived from the position's **liquidity** and **range width** via the `PositionValuer` contract:

```
varNotional ≈ L × (√(tickUpper) − √(tickLower))
```

Where `L` is the position's Uniswap v3 liquidity amount. A concentrated range (narrow tick spread) has lower `varNotional` than a wide range at the same liquidity - it is more sensitive to going out-of-range but less exposed to continuous in-range variance.

`varNotional` is computed by the contract at `buyCover` time from the live position state. LPs do not choose it directly.

---

## Why TWAP, Not Spot Price

Uniswap v3's spot price (`sqrtPriceX96` in `slot0`) can be pushed for a **single block** using a flash loan, without any sustained capital cost. An attacker could:

1. Flash-borrow a large amount
2. Swap massively in the pool to spike the spot price
3. Trigger an apparent variance event
4. Repay the flash loan in the same transaction
5. Collect a fraudulent payout

**TWAP makes this attack expensive.** The TWAP accumulates over time - it averages the tick across every second of every block. To materially inflate the TWAP, an attacker must hold a manipulated position for a sustained period (many minutes), paying real swap fees and opportunity cost throughout. This is no longer a cheap exploit - it is a genuine high-variance event, which is exactly what the contract is designed to pay out on.

Additionally, samples are taken using the **mean tick over the entire interval since the last sample** (not the spot tick at the sample moment). A spike that lasts only a few seconds is smoothed across the 30-minute interval, reducing its impact proportionally to its duration.

### TWAP Volatility vs Spot Volatility

Because the TWAP smooths out short-lived spikes, the TWAP-measured variance will always be **lower than spot-measured variance** during periods of short-duration shocks. For sustained multi-hour or multi-day volatility regimes, the two converge closely. This is an expected and intentional property of the oracle design - it means a genuine volatile week produces a payout, while a single-block manipulation attempt does not.

---

## Degraded Mode

If sampling gaps occur (keeper misses an interval), the policy's measurement window is shorter than intended. Two rules apply:

1. **Fewer than 2 valid return intervals** in the policy window → policy is **unmeasurable** → payout = 0, **premium refunded in full**, NFT returned.
2. **Some gaps but still ≥ 2 intervals** → cohort is marked **degraded** → measurement proceeds with available samples, no refund, but both parties see the `degraded` flag in all UIs and the settlement proof.

Degraded cohorts bias toward underwriters (fewer data points → likely underestimated variance). This is visible to all participants and does not invalidate the measurement - it informs interpretation.

---

## Settlement Proof

Every settlement is fully verifiable from public chain data. The `/proof` page in the app shows:

- The complete TWAP sample record (timestamp, mean tick, Δtick, squared log return)
- The `startSumSq` and `finalSumSq` values and their on-chain sources
- The number of intervals `N`
- The annualized realized variance computed from the above
- The payout for each policy at that variance

The proof page notes: _"Ticks are already log prices, so no price conversion enters the computation. Nothing here reads spot price at any point."_

Anyone can recompute the settlement from the accumulator's sample log without trusting Aruna's UI.
