---
sidebar_position: 1
title: GraphQL API
---

# GraphQL API

Aruna's indexer is a [Ponder](https://ponder.sh)-based service that indexes vault events and TWAP samples into a queryable GraphQL API. The frontend uses this to display markets, positions, cohort stats, and settlement history.

**Endpoint:** `http://localhost:42069` (local development) or your hosted indexer URL.

---

## Schema Overview

| Entity                | Description                                      |
| --------------------- | ------------------------------------------------ |
| `Vault`               | One vault contract - one (pool, tenor) market    |
| `Cohort`              | One fixed-duration cycle within a vault          |
| `Policy`              | One LP's cover purchase                          |
| `UnderwriterPosition` | One underwriter's deposit record in a cohort     |
| `StrikeBucket`        | Aggregate stats per strike level within a cohort |
| `Sample`              | One TWAP variance sample from the accumulator    |

---

## Queries

### `Vaults` - All Active Markets

Fetches all production vaults (filtered by `isTest: false`) with their recent cohort history. Used by the Markets page.

```graphql
query Vaults {
  vaults(where: { isTest: false }) {
    items {
      address
      pool
      accumulator
      settlementToken
      tenor
      anchor
      maxUtilizationBps
      maxExcessVariance
      isTest
      cohorts(orderBy: "cohortId", orderDirection: "desc", limit: 8) {
        items {
          cohortId
          startsAt
          endsAt
          totalCapital
          reserved
          premiumsCollected
          claimsPaid
          totalVarNotional
          totalMaxPayout
          policyCount
          settledCount
          paidCount
          noPayoutCount
          hitCapCount
          underwriterCount
          finalized
          startIndex
          endIndex
          finalSumSq
          finalizedAt
        }
      }
    }
  }
}
```

**Notes:**

- `isTest: false` filters out short-tenor vaults used for testing
- `limit: 8` on cohorts covers the 6-cohort history plus current and next (which are always the highest IDs)

---

### `VaultByAddress` - Single Vault

Fetches one vault by address. Unlike `Vaults`, this is **not filtered by `isTest`** - a page reached by direct address (e.g., an underwriter's own vault) must resolve regardless of public listing status.

```graphql
query VaultByAddress($address: String!) {
  vault(address: $address) {
    address
    pool
    accumulator
    settlementToken
    tenor
    anchor
    maxUtilizationBps
    maxExcessVariance
    isTest
    cohorts(orderBy: "cohortId", orderDirection: "desc", limit: 8) {
      items {
        cohortId
        startsAt
        endsAt
        totalCapital
        reserved
        premiumsCollected
        claimsPaid
        totalVarNotional
        totalMaxPayout
        policyCount
        settledCount
        paidCount
        noPayoutCount
        hitCapCount
        underwriterCount
        finalized
        startIndex
        endIndex
        finalSumSq
        finalizedAt
      }
    }
  }
}
```

**Variables:**

```json
{ "address": "0x7E14ef9E5eF153c3f0420bB80d13c1c7f7DDA44F" }
```

---

### `PoliciesByOwner` - LP's Cover History

Fetches all policies owned by a wallet address. Used on the LP's "Active / History" page.

```graphql
query PoliciesByOwner($owner: String!) {
  policys(
    where: { owner: $owner }
    orderBy: "boughtAt"
    orderDirection: "desc"
  ) {
    items {
      vault
      policyId
      cohortId
      owner
      positionTokenId
      premium
      maxPayout
      varNotional
      strikeAnnualized
      coveredSeconds
      startIndex
      startSumSq
      settled
      payout
      payoutParked
      boughtAt
      settledAt
      cohortRef {
        startsAt
        endsAt
        finalized
        finalSumSq
      }
    }
  }
}
```

**Variables:**

```json
{ "owner": "0xYourWalletAddress" }
```

**Notes:**

- `cohortRef` is a joined reference to the parent cohort - use `finalized` and `finalSumSq` to compute the settlement outcome client-side
- `payoutParked` is `true` if the automatic settlement transfer failed; the LP must call `claimUnclaimed()`

---

### `PoliciesByPosition` - History for an NFT Token

Fetches all policies that covered a specific Uniswap v3 position NFT. Useful for the settlement proof page.

```graphql
query PoliciesByPosition($positionTokenId: BigInt!) {
  policys(
    where: { positionTokenId: $positionTokenId }
    orderBy: "cohortId"
    orderDirection: "desc"
  ) {
    items {
      vault
      policyId
      cohortId
      owner
      positionTokenId
      premium
      maxPayout
      varNotional
      strikeAnnualized
      coveredSeconds
      startIndex
      startSumSq
      settled
      payout
      payoutParked
      boughtAt
      settledAt
      cohortRef {
        startsAt
        endsAt
        finalized
        finalSumSq
      }
    }
  }
}
```

**Variables:**

```json
{ "positionTokenId": "12345" }
```

---

### `UnderwriterPositionsByWallet` - Underwriter Dashboard

Fetches all underwriter deposit records for a wallet across all vaults and cohorts.

```graphql
query UnderwriterPositionsByWallet($wallet: String!) {
  underwriterPositions(where: { wallet: $wallet }) {
    items {
      vault
      cohortId
      wallet
      deposit
      principal
      rolledIn
      rolledOut
      withdrawnNet
      cohortRef {
        startsAt
        endsAt
        totalCapital
        premiumsCollected
        claimsPaid
        finalized
      }
    }
  }
}
```

**Variables:**

```json
{ "wallet": "0xYourWalletAddress" }
```

**Field reference:**

| Field          | Description                              |
| -------------- | ---------------------------------------- |
| `deposit`      | Original USDC deposited                  |
| `principal`    | Current principal (may change if rolled) |
| `rolledIn`     | Amount rolled in from a previous cohort  |
| `rolledOut`    | Amount rolled out to a subsequent cohort |
| `withdrawnNet` | Net USDC withdrawn (after settlement)    |

---

### `CohortDetail` - Full Cohort State

Fetches a single cohort's aggregates, strike-bucket book, underwriter positions, and all policies. Used for the settlement dashboard and underwriter detail view.

```graphql
query CohortDetail($vault: String!, $cohortId: Float!) {
  cohort(vault: $vault, cohortId: $cohortId) {
    startsAt
    endsAt
    totalCapital
    reserved
    premiumsCollected
    claimsPaid
    totalVarNotional
    totalMaxPayout
    policyCount
    settledCount
    paidCount
    noPayoutCount
    hitCapCount
    finalized
    finalSumSq
    finalizedAt
    strikeBuckets {
      items {
        strikeAnnualized
        policyCount
        totalVarNotional
        totalMaxPayout
        totalPremium
      }
    }
    positions {
      items {
        wallet
        principal
        deposit
        rolledIn
        rolledOut
        withdrawnNet
      }
    }
    policies {
      items {
        policyId
        owner
        premium
        maxPayout
        varNotional
        strikeAnnualized
        coveredSeconds
        startIndex
        startSumSq
        settled
        payout
      }
    }
  }
}
```

**Variables:**

```json
{
  "vault": "0x7E14ef9E5eF153c3f0420bB80d13c1c7f7DDA44F",
  "cohortId": 1
}
```

**Cohort statistics:**

| Field              | Description                                 |
| ------------------ | ------------------------------------------- |
| `policyCount`      | Total policies purchased                    |
| `settledCount`     | Policies settled so far                     |
| `paidCount`        | Policies that received a payout             |
| `noPayoutCount`    | Policies that expired worthless             |
| `hitCapCount`      | Policies where payout reached `maxPayout`   |
| `underwriterCount` | Distinct underwriter addresses              |
| `finalized`        | Whether `keeperFinalize` has been called    |
| `finalSumSq`       | `cumulativeSumSq` at the cohort's end index |

---

### `Samples` - TWAP Variance History

Fetches variance samples from the accumulator. Used for the settlement proof page and the variance chart.

```graphql
query Samples($accumulator: String!, $limit: Int) {
  samples(
    where: { accumulator: $accumulator }
    orderBy: "index"
    orderDirection: "asc"
    limit: $limit
  ) {
    items {
      index
      timestamp
      avgTick
      cumulativeSumSq
      increment
    }
  }
}
```

**Variables:**

```json
{
  "accumulator": "0xcEF5c3CdF6dd303b522E047ff1376a0F78885c47",
  "limit": 500
}
```

**Field reference:**

| Field             | Description                                                               |
| ----------------- | ------------------------------------------------------------------------- |
| `index`           | Sequential sample number (0-based)                                        |
| `timestamp`       | Unix timestamp of the sample                                              |
| `avgTick`         | Mean tick over the interval since the previous sample                     |
| `cumulativeSumSq` | Running sum of squared `avgTick` increments                               |
| `increment`       | `(avgTick[i] − avgTick[i−1])²` - the squared log-return for this interval |

---

## Running the Indexer Locally

```bash
cd indexer
pnpm install
pnpm dev
```

The indexer starts on `http://localhost:42069`. The GraphQL playground is available at `http://localhost:42069/graphql`.

The indexer reads its watched contracts from `ponder.config.ts`. Add a new vault by extending the `contracts` array there and restarting.
