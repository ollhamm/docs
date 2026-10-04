---
sidebar_position: 1
title: Impermanent Loss & Variance
---

# Impermanent Loss & Variance

Understanding why direction-based instruments fail to protect LPs - and why variance is the right measure.

---

## What Impermanent Loss Actually Is

When you provide liquidity to a Uniswap v3 pool, your position is continuously rebalanced by the AMM. As price rises, you automatically sell the rising asset and accumulate the falling one. As price falls, the reverse happens.

**IL at the endpoint** measures the difference between holding the two assets vs having them in the pool, compared from your entry price to your current price. This is the number most tools show you.

But it only tells half the story.

---

## The Real Cost: Loss-Versus-Rebalancing (LVR)

Every individual price movement - not just the net displacement - triggers an implicit rebalancing trade. Each rebalancing sells a little of what went up and buys a little of what went down. The cumulative cost of these trades over time is called **loss-versus-rebalancing (LVR)**, and it is:

- **Path-dependent**: it accumulates over the entire history of price movements
- **Proportional to realized variance**: how much price swung, not where it ended up
- **Larger than IL-at-endpoint**: the endpoint view hides all the intermediate damage

The formula for LVR in a continuous setting is:

```
LVR ≈ (1/2) × L × σ² × dt
```

Where `L` is your liquidity depth, `σ²` is the instantaneous variance of price, and `dt` is the time interval. Integrated over a full cohort, this gives total path-dependent cost proportional to **realized variance**.

---

## The Two-Path Example

Consider two tokens, both starting at $1.00 and ending at $1.03 after one week.

**Path A - Calm drift:**

- Price moves smoothly upward
- Variance accumulates slowly
- Few rebalancing events, each small
- IL at endpoint: ~0.01%
- LVR for the week: small

**Path B - Whipsaw:**

- Price swings: $1.00 → $1.10 → $0.95 → $1.08 → $0.97 → $1.03
- Same start, same end, very different path
- Variance accumulates rapidly on every swing
- IL at endpoint: ~0.01% (same as Path A!)
- LVR for the week: **many multiples of Path A**

A strike-price option on this pair pays the same payout for both paths: zero (price ended above start, no downside strike was hit). The option cannot distinguish between them because it only sees the endpoint.

**Aruna pays differently for each path** because it measures the accumulated variance - the area under the squared-return curve - not the net displacement.

---

## Why Variance, Not Volatility

Volatility (`σ`) is the annualized standard deviation of log returns. Variance (`σ²`) is its square. Aruna contracts are denominated in variance because:

1. LVR is linear in variance, not in volatility
2. Variance is **additive** over time - two independent variance contributions sum cleanly
3. Annualized variance is what the strike and payout formulas use directly

When you see "strike 35% vol", that is expressed as annualized volatility for readability. Internally, the contract computes the equivalent variance: `strike_variance = (0.35)² = 0.1225`.

---

## Why Direction Instruments Fall Short

| Instrument   | What it pays on                         | Problem for LPs                           |
| ------------ | --------------------------------------- | ----------------------------------------- |
| Put option   | Price below strike at expiry            | Directional - path A and B look identical |
| Call option  | Price above strike at expiry            | Same problem                              |
| Range option | Price outside band at expiry            | Still endpoint-only                       |
| **Aruna**    | **Accumulated variance above a strike** | **Measures the actual rebalancing cost**  |

Strike-price options are a useful tool, but they measure direction. For an LP, the cost of being in the pool comes from variance - not direction. An LP who sits through a violent week of ranging price movements and ends flat has paid a huge real cost that a directional payout leaves entirely uncompensated.

---

## Basis Risk

Aruna settles on realized variance from the Uniswap v3 pool's TWAP oracle. This is a direct measure of price variance in the pool where your position lives, which makes it the most precise available signal.

However, it is still a **parametric** product, not indemnity insurance. The payout depends on the formula - not on your specific position's dollar loss. Your individual IL depends on where your range is set, your liquidity concentration, how much time you spent in-range, and your fee earnings. The variance payout and your realized IL can differ (this difference is called **basis risk**).

Aruna does not claim to perfectly compensate every LP's exact dollar loss. It pays on the variance signal that drives LVR - and that signal has a direct, measured relationship to the cost of being an LP.

---

## Summary

- IL at the endpoint understates the true cost of providing liquidity
- The real cost (LVR) is path-dependent and proportional to realized variance
- Direction-based instruments pay the same for a calm path and a volatile path to the same endpoint
- Aruna accumulates squared log-return increments (variance) throughout the cohort and pays on the excess above the LP's chosen strike
- Some basis risk exists - the payout is parametric, not an exact match to every LP's individual loss
