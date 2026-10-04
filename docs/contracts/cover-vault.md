---
sidebar_position: 2
title: CoverVault
---

# CoverVault

`CoverVault` is the core contract. One vault exists per `(pool, tenor)` market. It manages underwriter capital, sells cover to LPs, accumulates TWAP samples via the `VarianceAccumulator`, and settles all policies at cohort end.

**Current testnet address:** `0x7E14ef9E5eF153c3f0420bB80d13c1c7f7DDA44F` (Arbitrum Sepolia)

---

## Constructor

```solidity
constructor(
    address pool_,
    address accumulator_,
    address pricer_,
    address valuer_,
    address positionManager_,
    address settlementToken_,
    uint32  tenor_,
    uint32  gap_,
    uint64  anchor_,
    uint16  maxUtilizationBps_,
    uint128 maxExcessVariance_,
    uint16  ewmaAlphaBps_,
    uint128 seedVariance_,
    uint32  policyCap_,
    uint16  keeperShareBps_
)
```

Deployed only by `ArunaFactory`. Parameters are immutable once deployed.

| Parameter            | Description                                                           |
| -------------------- | --------------------------------------------------------------------- |
| `pool_`              | Uniswap v3 pool address this vault covers                             |
| `accumulator_`       | `VarianceAccumulator` for this pool                                   |
| `pricer_`            | `PremiumPricer` - computes EWMA-based premiums                        |
| `valuer_`            | `PositionValuer` - reads NFT position and returns `varNotional`       |
| `positionManager_`   | Uniswap v3 `NonfungiblePositionManager`                               |
| `settlementToken_`   | ERC-20 used for premiums and payouts (USDC)                           |
| `tenor_`             | Duration of each cohort in seconds                                    |
| `gap_`               | Settlement gap between cohorts in seconds                             |
| `anchor_`            | Unix timestamp of cohort 1 start                                      |
| `maxUtilizationBps_` | Max fraction of total capital that can be reserved (e.g., 8000 = 80%) |
| `maxExcessVariance_` | Hard cap on payable excess variance                                   |
| `ewmaAlphaBps_`      | Smoothing factor for EWMA variance estimate used in pricing           |
| `seedVariance_`      | Initial variance estimate before any samples arrive                   |
| `policyCap_`         | Maximum policies per cohort                                           |
| `keeperShareBps_`    | Fraction of premiums routed to keeper budget                          |

---

## State-Reading Functions

### `quote`

```solidity
function quote(
    uint32 cohortId,
    uint256 positionTokenId,
    uint64  strikeAnnualized
) external view returns (
    uint256 premium,
    uint128 varNotional,
    uint256 maxPayout,
    uint32  coveredSeconds
)
```

Returns the current pricing for a given position and strike. Does **not** modify state. Call before `buyCover` to preview terms.

| Return           | Description                                                         |
| ---------------- | ------------------------------------------------------------------- |
| `premium`        | USDC to pay - also the maximum loss                                 |
| `varNotional`    | Variance notional from the position's liquidity and tick range      |
| `maxPayout`      | Maximum USDC receivable at settlement (reserved from vault capital) |
| `coveredSeconds` | How many seconds of the cohort the policy will cover                |

The quote is computed from the live EWMA variance, remaining cohort time, and position geometry. It changes as time passes.

**Reverts:**

- `NotActive` - cohort is not in ACTIVE phase
- `TooLateToBuy` - fewer than 5 sample intervals remain

---

### `currentCohortId`

```solidity
function currentCohortId() external view returns (uint32)
```

Returns the ID of the cohort currently open (FUNDING or ACTIVE). Cohort IDs are sequential starting from 1.

---

### `cohortStatus`

```solidity
function cohortStatus(uint32 cohortId) external view returns (CohortStatus)
```

Returns the lifecycle phase of a cohort:

```solidity
enum CohortStatus { FUNDING, ACTIVE, SETTLING, SETTLED }
```

---

### `getCohort`

```solidity
function getCohort(uint32 cohortId) external view returns (Cohort memory)
```

Returns all cohort state:

```solidity
struct Cohort {
    uint32  cohortId;
    uint64  startsAt;
    uint64  endsAt;
    uint256 totalCapital;
    uint256 reserved;
    uint256 premiumsCollected;
    uint256 claimsPaid;
    bool    finalized;
    uint32  startIndex;
    uint32  endIndex;
    uint128 finalSumSq;
}
```

---

## LP Functions

### `buyCover`

```solidity
function buyCover(
    uint32  cohortId,
    uint256 positionTokenId,
    uint64  strikeAnnualized,
    uint256 maxPremium,
    uint32  deadline
) external returns (uint256 policyId)
```

Purchases cover for `positionTokenId` in `cohortId`. Transfers `premium` from `msg.sender`, escrows the position NFT, reserves `maxPayout` from vault capital.

`strikeAnnualized` is the annualized volatility strike, scaled to 1e18. For 35% vol: `350000000000000000` (0.35 × 1e18).

`maxPremium` is your slippage tolerance. If the computed premium exceeds it, the transaction reverts with `PremiumTooHigh`.

**Prerequisites:**

1. `IERC20(settlementToken).approve(vault, premium)` - already called
2. `NonfungiblePositionManager.approve(vault, positionTokenId)` - already called
3. Caller must own the NFT: `ownerOf(positionTokenId) == msg.sender`

**Emits:** `CoverBought`, `PositionEscrowed`

**Reverts:**

- `NotActive` - cohort not in ACTIVE phase
- `TooLateToBuy` - fewer than 5 sample intervals remain
- `CapacityExceeded` - vault is at `maxUtilizationBps`
- `PremiumTooHigh` - computed premium > `maxPremium`
- `DeadlineExpired` - block timestamp > `deadline`

---

### `cancel`

```solidity
function cancel(uint256 policyId) external
```

Cancels an active policy. Returns the escrowed NFT to `msg.sender`. The premium is **not refunded** - it stays with the cohort. Releases the reserved `maxPayout` capacity for other LPs to use.

Only callable by the policy owner while the cohort is ACTIVE.

**Emits:** `PositionReturned`

---

### `collectFees`

```solidity
function collectFees(
    uint256 policyId,
    address recipient
) external returns (uint256 amount0, uint256 amount1)
```

Collects accumulated Uniswap pool fees for the escrowed position NFT and forwards them to `recipient`. Can be called at any time while the policy is active - fees accumulate in the position and are entirely the LP's to claim.

**Emits:** nothing (fee collection is a Uniswap-side event)

---

### `claimPosition`

```solidity
function claimPosition(uint256 policyId) external
```

Claims a post-settlement NFT return that was parked because the automatic transfer failed (e.g., caller was a contract wallet that rejected the transfer). Sends the NFT to the policy owner.

---

### `claimUnclaimed`

```solidity
function claimUnclaimed() external
```

Claims any parked USDC payout for `msg.sender` across all settled policies. Used when the automatic settlement payout transfer failed.

---

## Underwriter Functions

### `deposit`

```solidity
function deposit(uint32 cohortId, uint256 amount) external
```

Deposits `amount` of `settlementToken` into `cohortId`. The caller's deposit is recorded in `deposits[cohortId][msg.sender]`. Their share of premiums and claims is proportional to this amount relative to `cohort.totalCapital`.

Deposits are only accepted while the cohort is in **FUNDING** status.

**Emits:** `Deposited`

**Reverts:** `NotFunding`

---

### `withdraw`

```solidity
function withdraw(uint32 cohortId) external returns (uint256 net)
```

Withdraws the caller's net settlement amount (`capital + premiums − claims`) after the cohort is fully SETTLED. Returns `net` USDC to `msg.sender`.

**Emits:** `Withdrawn`

**Reverts:** `NotSettled`

---

### `rollTo`

```solidity
function rollTo(uint32 fromCohort, uint32 toCohort) external
```

Moves the caller's net settlement from `fromCohort` directly into `toCohort` as a deposit, skipping the manual withdraw-then-deposit flow.

`toCohort` must still be in FUNDING. If it has already started (ACTIVE), the call reverts with `NotFunding` - the underwriter must withdraw and deposit manually into the next eligible cohort.

**Emits:** `Withdrawn` (from source), `Deposited` (into target), `Rolled`

---

### `fundKeeperBudget`

```solidity
function fundKeeperBudget(uint256 amount) external
```

Adds `amount` USDC to the vault's keeper budget. Anyone can call this. The keeper budget pays bots that call `keeperPoke` and `keeperFinalize`. If it runs dry, sampling can stall.

---

## Keeper Functions

### `keeperPoke`

```solidity
function keeperPoke(uint32 cohortId) external returns (uint256 reward)
```

Triggers a TWAP sample on the `VarianceAccumulator` and returns a keeper reward from the vault's `keeperBudget`. Should be called approximately every 30 minutes while the cohort is ACTIVE.

The reward is deducted from the keeper budget (funded from a share of cohort premiums). Reverts if the budget is empty or the accumulator's minimum interval hasn't elapsed.

**Emits:** `KeeperPoked`

---

### `keeperFinalize`

```solidity
function keeperFinalize(uint32 cohortId) external returns (uint256 reward)
```

Triggers finalization after the cohort tenor ends. Snapshots the final `cumulativeSumSq` from the accumulator as of the cohort's end index. Transitions the cohort to SETTLING.

Must be called before `settleBatch`. Returns a keeper reward.

**Emits:** `Finalized`

---

## Settlement Functions

### `finalize`

```solidity
function finalize(uint32 cohortId) external
```

Same as `keeperFinalize` but without a reward. Can be called by anyone after the cohort tenor ends. Permissionless fallback if keeper is offline.

**Emits:** `Finalized`

---

### `settleBatch`

```solidity
function settleBatch(uint32 cohortId, uint32 n) external
```

Settles up to `n` policies in `cohortId`. Computes each policy's realized variance from `startSumSq` to `finalSumSq`, calculates the payout, transfers settlement token and NFT to the owner (or parks them if the transfer fails).

Call repeatedly until `cohort.settledCount == cohort.policyCount`. The `n` parameter bounds gas per transaction; 20–50 policies per call is typical.

**Emits:** `PolicySettled` for each policy settled

---

### `settlePolicy`

```solidity
function settlePolicy(uint32 cohortId, uint256 policyId) external
```

Settles a single specific policy. For targeted settlement (e.g., an LP wants their own policy settled before the batch gets there).

**Emits:** `PolicySettled`

---

## Events

```solidity
event CoverBought(
    uint32 indexed cohortId,
    uint256 indexed policyId,
    address indexed owner,
    uint256 positionTokenId,
    uint64  strikeAnnualized,
    uint256 premium,
    uint256 maxPayout,
    uint128 varNotional,
    uint32  startIndex,
    uint128 startSumSq
);

event Deposited(
    uint32  indexed cohortId,
    address indexed depositor,
    uint256 amount
);

event PolicySettled(
    uint32  indexed cohortId,
    uint256 indexed policyId,
    address indexed owner,
    uint256 payout,
    bool    hitCap,
    bool    unmeasurable
);

event Finalized(uint32 indexed cohortId, uint32 endIndex, uint128 finalSumSq);

event Withdrawn(uint32 indexed cohortId, address indexed depositor, uint256 net);

event Rolled(
    address indexed depositor,
    uint32 fromCohort,
    uint32 toCohort,
    uint256 amount
);

event PositionEscrowed(uint256 indexed policyId, uint256 indexed tokenId, address owner);
event PositionReturned(uint256 indexed policyId, uint256 indexed tokenId, address owner);

event KeeperPoked(uint32 indexed cohortId, uint256 reward);
```

---

## Errors

```solidity
error NotActive();         // cohort is not in ACTIVE phase
error NotFunding();        // cohort is not in FUNDING phase
error NotSettled();        // cohort is not in SETTLED phase
error CapacityExceeded();  // reserved + maxPayout > totalCapital × maxUtilizationBps
error PremiumTooHigh();    // computed premium > maxPremium (slippage)
error TooLateToBuy();      // fewer than 5 sample intervals remain in cohort
error DeadlineExpired();   // block.timestamp > deadline
error NotOwner();          // caller is not the policy owner
error AlreadySettled();    // policy has already been settled
```

---

## Security Notes

- **Capital fully reserved before policies are sold.** `maxPayout` is deducted from `free` capital the moment `buyCover` confirms. There is no scenario where a payout is owed but capital is absent.
- **NFT escrow prevents double-dipping.** While your position is in the vault, you cannot remove liquidity. This prevents the classic hedge-and-exit: buying cover, pulling liquidity (realizing the loss without variance), and claiming a payout on a position that no longer exists.
- **TWAP oracle is flash-loan resistant.** See [Oracle & Settlement Math](/docs/how-it-works/oracle-math) for details.
- **Settlement is permissionless.** Both `finalize` and `settleBatch` can be called by anyone. Aruna's keeper bots call them first, but there is no reliance on any privileged address.
