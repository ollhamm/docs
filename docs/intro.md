---
slug: /intro
sidebar_position: 1
title: Introduction
---

# What is Aruna?

**Aruna is parametric cover for Uniswap v3 liquidity providers against impermanent loss - measured and priced on realized variance, not price direction.**

It runs on **Arbitrum** and settles against the pool's own TWAP oracle. Every payout is backed by capital already in the vault before you buy. Your maximum loss is the premium you paid - nothing more, ever.

---

## The Problem

LP'ing on Uniswap v3 exposes you to **impermanent loss** - the cost of being continuously rebalanced against you as price moves. But IL at the endpoint only captures the spread between your entry and exit price. The real cost is larger.

Every time price moves, your concentrated liquidity position is forced to sell what's rising and buy what's falling. This **path-dependent cost** - loss-versus-rebalancing (LVR) - accumulates over the entire duration of your position and is **proportional to realized variance: how wildly price moved, not which direction it ended up**.

**The key insight:** two tokens can start at $1.00 and end at $1.03 in a week. One drifts smoothly. The other swings violently - up to $1.10, down to $0.95, back to $1.08 - and happens to stop at the same $1.03 endpoint. IL-at-the-endpoint is nearly identical for both. But the LP's actual rebalancing losses that week are _vastly_ different. The whipsaw path drained the position on every swing.

**Existing strike-price options don't help here.** They pay on direction - only if price finishes above or below a threshold. That's an indirect proxy for variance. A quiet drift and a violent whipsaw to the same endpoint produce the same strike-price payout: zero.

Aruna settles on the accumulated variance itself.

---

## How Aruna Solves It

Aruna uses a **parametric contract** that:

1. Reads realized variance directly from the pool's Uniswap v3 TWAP oracle - sampled every 30 minutes throughout the cohort
2. Computes `cumulativeSumSq`: the sum of squared log-return increments from the mean tick
3. At cohort end, compares realized variance to the LP's chosen **strike** - the volatility level above which cover starts paying
4. Transfers payout proportional to the excess variance, up to the LP's **payout cap** (a number fixed at purchase and backed by real vault capital)

The LP's loss is **capped at the premium from the moment they sign**. It cannot grow at settlement or on early exit.

---

## Key Properties

| Property                          | How Aruna implements it                                            |
| --------------------------------- | ------------------------------------------------------------------ |
| **Capped LP loss**                | Premium = maximum loss, locked at purchase time                    |
| **Variance-based pricing**        | EWMA of realized variance across prior cohorts                     |
| **Manipulation-resistant oracle** | Uniswap v3 TWAP, not spot price                                    |
| **Fully collateralized**          | Payout cap is reserved from real capital before cover is sold      |
| **Two-sided market**              | Zero-sum between LPs and underwriters - no third-party subsidy     |
| **Fixed cycles**                  | 7/14/28-day cohorts settle all policies simultaneously             |
| **Position-attached**             | Cover is tied to a specific NFT, not a speculative bet on variance |

---

## Two Sides of the Market

**LPs (Hedgers)** pay a premium to protect a specific Uniswap v3 position. The premium is their floor. If realized variance finishes above their strike, they receive a payout up to the cap. If it doesn't, they lose the premium - and nothing more.

**Underwriters** deposit USDC into a pool's vault for one cohort. Their capital backs all policies written that cycle. They collect all premiums proportional to their share; they absorb all claims the same way. At settlement they receive capital + premiums − claims, and choose to roll into the next cohort or withdraw.

Neither side depends on a third-party subsidy or emissions. It is zero-sum.

---

## Network & Status

| Field                | Value                                       |
| -------------------- | ------------------------------------------- |
| **Network**          | Arbitrum Sepolia (testnet, chain ID 421614) |
| **Settlement token** | mUSDC (testnet mock)                        |
| **Current market**   | mWETH / mUSDC 0.05%                         |
| **Cohort tenor**     | 7 days (3600s sandbox)                      |
| **Oracle**           | Uniswap v3 TWAP, 30-min sample interval     |

See [Deployed Addresses →](/docs/contracts/addresses)

---

## Next Steps

- [Impermanent Loss & Variance](/docs/how-it-works/impermanent-loss) - the math behind the problem
- [For LPs](/docs/how-it-works/for-lps) - step-by-step guide to buying cover
- [For Underwriters](/docs/how-it-works/for-underwriters) - depositing and earning premiums
- [Smart Contracts](/docs/contracts/overview) - architecture and contract reference
