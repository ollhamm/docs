---
sidebar_position: 4
title: PremiumPricer
---

# PremiumPricer

`PremiumPricer` computes the fair premium for a unit of variance cover given the current realized variance estimate, the strike, and the remaining time in the cohort.

**Current testnet address:** `0xd2e17AcD143a2Bea3b678d9d110Fe5f2443246FC` (Arbitrum Sepolia)

:::info ABI not yet published
The `PremiumPricer` ABI is internal to the vault and is not called directly by end users or bots. It is invoked by `CoverVault.quote()` and `CoverVault.buyCover()`. This page documents the pricing model rather than the call interface.
:::

---

## Pricing Model

The premium is the expected value of the payout, scaled by the remaining time in the cohort.

The key input is the **EWMA (Exponentially Weighted Moving Average) variance** - a smoothed estimate of the pool's recent variance, weighted to give more emphasis to recent observations.

### EWMA Update Rule

At each sample, the EWMA is updated:

```
ewma[i] = α × increment[i] + (1 − α) × ewma[i−1]
```

Where:

- `increment[i]` is the most recent squared log-return `(avgTick[i] − avgTick[i−1])²`
- `α` is the smoothing parameter `ewmaAlphaBps / 10000` (set at vault deployment, e.g., 0.05)
- `ewma[i−1]` is the previous EWMA estimate

`α` is small (0.05 typical) so the estimate reacts slowly to transient spikes but converges over days of data.

### Premium Formula

For a policy with `varNotional` notional, `strikeVariance` strike, and `T` seconds remaining in the cohort:

```
expectedExcessVariance = max(0, ewmaVariance − strikeVariance)

premium = varNotional × expectedExcessVariance × (T / tenorSeconds)
```

The `(T / tenorSeconds)` term is the **time-fraction**. An LP who joins halfway through the cohort pays half the premium of one who joins at the start, because they are exposed to half the total variance accumulation.

### Seed Variance

Before any samples arrive (the first cohort, before the first `poke`), the EWMA is initialized to `seedVariance` - a deployment-time estimate of the pool's baseline variance. This prevents the first quotes from being wildly mispriced.

---

## Price Discovery

Premium prices respond to the market as follows:

| Market condition                     | Effect on EWMA               | Effect on premium           |
| ------------------------------------ | ---------------------------- | --------------------------- |
| Quiet week (low realized variance)   | EWMA drifts down             | Lower premiums              |
| Active week (high realized variance) | EWMA moves up                | Higher premiums             |
| Single spike then quiet              | EWMA elevated, decays slowly | Temporarily higher premiums |
| Sustained high vol                   | EWMA stays elevated          | Sustained higher premiums   |

Because the EWMA smooths over many samples (α = 0.05 → roughly 20-sample memory), a single volatility event does not immediately change prices dramatically.

---

## Slippage Protection

The `maxPremium` parameter in `buyCover` protects against unexpected price increases between the `quote` call and the transaction execution. If the EWMA ticks up (e.g., a volatile block lands between your quote and your transaction), `PremiumPricer` may return a higher premium. If `premium > maxPremium`, the vault reverts with `PremiumTooHigh`.

Best practice: set `maxPremium` to `quote.premium × 1.01` (1% slippage tolerance) for normal conditions, wider during volatile periods.

---

## Relationship to Settlement

The premium is a **pricing input only** - it has no effect on the settlement calculation. Settlement uses the raw `cumulativeSumSq` from the `VarianceAccumulator`, not the EWMA. The EWMA is the market's forward estimate; the realized variance is the backward measurement.

---

## Why EWMA, Not Implied Volatility

Aruna deliberately avoids implied volatility (from on-chain option markets or external feeds) for pricing:

1. **No external dependencies** - EWMA uses only the same Uniswap TWAP data that drives settlement, so the pricing oracle and the settlement oracle are the same.
2. **No manipulation surface** - implied volatility from thin or illiquid on-chain options markets is easier to manipulate than a time-average of the pool's own price history.
3. **Self-consistency** - the premium is computed from the same process it is hedging. When variance is high, premiums rise. When variance is low, premiums fall. The two sides of the market are priced from the same source.
