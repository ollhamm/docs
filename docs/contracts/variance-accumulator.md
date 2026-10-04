---
sidebar_position: 3
title: VarianceAccumulator
---

# VarianceAccumulator

`VarianceAccumulator` is the oracle contract. It reads the Uniswap v3 pool's TWAP at fixed intervals, accumulates squared log-return increments, and exposes the cumulative sum to `CoverVault` for settlement.

**Current testnet address:** `0xcEF5c3CdF6dd303b522E047ff1376a0F78885c47` (Arbitrum Sepolia)

---

## Design Philosophy

The accumulator is a **pure data store**. It has no knowledge of policies, cohorts, or insurance logic. It only answers one question: _how much squared log-return has the pool accumulated since index i?_

This separation means:

- Multiple vaults (different tenors) for the same pool share one accumulator
- The accumulator has no admin functions and no mutable configuration
- Settlement math is independently reproducible from the accumulator's on-chain record

---

## Sample Struct

```solidity
struct Sample {
    uint32  timestamp;        // Unix timestamp when the sample was taken
    int56   tickCumulative;   // Raw Uniswap v3 tick accumulator value
    int24   avgTick;          // Mean tick over the interval since the previous sample
    uint128 cumulativeSumSq;  // Running sum of squared avgTick increments
    uint16  elapsed;          // Seconds elapsed since the previous sample
}
```

Each sample adds one squared increment to `cumulativeSumSq`:

```
increment = (avgTick[i] − avgTick[i−1])²
cumulativeSumSq[i] = cumulativeSumSq[i−1] + increment
```

---

## State-Reading Functions

### `sampleCount`

```solidity
function sampleCount() external view returns (uint32)
```

Returns the total number of samples recorded. Samples are indexed from 0; the latest sample is at index `sampleCount() − 1`.

---

### `sampleAt`

```solidity
function sampleAt(uint32 index) external view returns (Sample memory)
```

Returns the sample at `index`. Reverts if `index >= sampleCount()`.

Use this to fetch specific samples for settlement proof construction or off-chain analysis.

---

### `indexAtOrBefore`

```solidity
function indexAtOrBefore(uint32 timestamp) external view returns (uint32 index, bool exact)
```

Binary-searches the sample history and returns the index of the latest sample with `sample.timestamp <= timestamp`.

Used by `CoverVault` during finalization: the vault calls `indexAtOrBefore(cohort.endsAt)` to find the last valid sample within the cohort window.

`exact` is `true` if a sample was taken at exactly `timestamp`, `false` if the returned index is the closest-before.

---

### `gapStats`

```solidity
function gapStats(
    uint32 fromIndex,
    uint32 toIndex
) external view returns (
    uint32 sampleCount_,
    uint32 gapCount,
    uint32 maxGapSeconds
)
```

Returns statistics about the measurement quality between two sample indices:

| Return          | Meaning                                                               |
| --------------- | --------------------------------------------------------------------- |
| `sampleCount_`  | Number of valid samples in `[fromIndex, toIndex]`                     |
| `gapCount`      | Number of intervals where elapsed time exceeded the expected interval |
| `maxGapSeconds` | Longest single gap in the window                                      |

Used by the frontend to display degraded-mode warnings and by the vault to check if a policy is unmeasurable.

---

## Write Functions

### `poke`

```solidity
function poke() external returns (uint32 newIndex)
```

Reads the pool's TWAP via `IUniswapV3Pool.observe(secondsAgos)` for the current and previous interval, computes the mean tick, calculates the squared increment, updates `cumulativeSumSq`, and appends a new `Sample`.

Returns the index of the newly added sample.

**Reverts:**

- `TooEarly` - minimum interval has not elapsed since the last sample
- `InsufficientObservationHistory` - the pool's observation buffer doesn't reach back far enough (rare on active pools)

Anyone can call `poke`. Aruna's keeper bots call it on a timer, but there is no whitelist.

---

### `tryPoke`

```solidity
function tryPoke() external returns (bool success, uint32 newIndex)
```

Same as `poke` but does not revert if called too early. Returns `(false, 0)` if the minimum interval hasn't elapsed, `(true, newIndex)` on success.

Used by keeper contracts that call `tryPoke` in a loop and batch multiple calls without reverting on timing edge cases.

---

## Accumulator Math Verified

Every `cumulativeSumSq` value is independently verifiable:

1. Fetch all samples between two indices with `sampleAt(i)` for each `i`
2. Recompute: `Σ (avgTick[i] − avgTick[i−1])²`
3. Compare against `cumulativeSumSq[endIndex] − cumulativeSumSq[startIndex]`

The results must match exactly. If they don't, the contract has a bug (none known).

The settlement proof page in the Aruna app shows this full reconstruction alongside the on-chain values.

---

## Gap Handling

If `poke` is not called within `2 × minInterval` seconds of the last sample, the gap is recorded when the next `poke` arrives. The elapsed time on that sample will be large (reflecting the true gap), and `gapStats` will count it.

A policy whose measurement window contains too many gaps is treated as **unmeasurable**: the vault refunds the premium and returns the NFT. See [Cohorts & Cycles](/docs/how-it-works/cohorts) for the degraded-mode threshold.

---

## Why One Accumulator Per Pool

Variance is a property of the pool, not of a specific insurance tenor. A 7-day vault and a 28-day vault for the same pool both measure the same underlying price process. Sharing one accumulator means:

- Samples are taken once, regardless of how many vaults reference the pool
- Historical data is never duplicated
- Keeper bots need only one `poke` call per pool per interval
