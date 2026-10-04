---
sidebar_position: 4
title: For Underwriters
---

# For Underwriters

Underwriters provide the capital that backs LP cover. In return, they collect premiums from every LP who buys cover in that cycle.

---

## The Role of an Underwriter

When an LP buys cover, the vault must have enough free capital to back the payout cap. Underwriters supply that capital. They are the collective counterparty to every LP in the vault for the duration of one cohort.

At settlement:

- If LPs had a quiet week (low variance): underwriters keep all premiums. Capital returns intact.
- If LPs had a violent week (high variance): claims are deducted from capital. Underwriters may lose more than they earned in premiums.

**This is a carry business.** Most weeks, realized variance finishes below the average strike and underwriters profit. Occasionally it doesn't.

:::danger Losses are real
In a violent week, claims can exceed premiums by a wide margin. Your maximum loss is your entire deposited capital × your vault share, not zero. Deposit only what you can afford to leave for the full cohort duration.
:::

---

## Prerequisites

- **USDC** in your wallet (the settlement token for all current vaults)
- The cohort must be in **FUNDING** status (deposits close when the ACTIVE phase begins)

---

## Step 1 - Choose a Vault

Navigate to **Underwrite** to see all available vaults. For each vault, the app shows:

| Field                | Meaning                                                                     |
| -------------------- | --------------------------------------------------------------------------- |
| Pool                 | The Uniswap v3 pool this vault covers (e.g., mWETH/mUSDC 0.05%)             |
| Total capital        | USDC already deposited by underwriters for this cohort                      |
| Utilization          | Reserved / total capital (how much is already committed to active policies) |
| Premiums, this cycle | Premiums collected so far                                                   |
| Cycle history        | Net result % for prior cohorts                                              |

---

## Step 2 - Deposit

Enter the USDC amount you want to commit. The app shows:

- Your resulting share of the vault (your deposit / total capital after deposit)
- Estimated premiums at current cycle pace
- Worst-case outcome (if every active policy hits its full cap)
- Lock-until date (the cohort's `endsAt` + settlement gap)

Confirm two transactions:

### Transaction 1 - Approve USDC

```
IERC20(settlementToken).approve(vaultAddress, amount)
```

### Transaction 2 - Deposit

```solidity
CoverVault.deposit(cohortId, amount)
```

Emits `Deposited`. Your deposit is recorded in `deposits[cohortId][msg.sender]`.

:::info Lock-up
Once deposited, capital is locked until the cohort is fully settled. There is no early withdrawal. Policies are sold against your capital; it cannot leave while those policies are live.
:::

---

## Step 3 - Monitor

While the cohort is ACTIVE, the **Dashboard** shows:

| Stat                   | What it means                        |
| ---------------------- | ------------------------------------ |
| Capital committed      | Your deposit                         |
| Premiums earned so far | Your share × premiums collected      |
| Claims at current pace | Your share × claims paid so far      |
| Mark if it ends here   | Net if settlement happened right now |

The dashboard also shows the full **book** you are backing: a breakdown by strike bucket of how many policies exist and how much capacity is written at each strike level.

**Scenario table:** the app computes your net outcome at a range of realized vol finishes (e.g., 25%, 35%, 50%, 75%, every-cap-hit).

---

## Step 4 - Withdraw or Roll

After the cohort settles, you have two options:

### Withdraw

```solidity
CoverVault.withdraw(cohortId) → net
```

Returns `capital + premiums − claims` net of your share. Emits `Withdrawn`.

### Roll to next cohort

```solidity
CoverVault.rollTo(fromCohort, toCohort)
```

Moves your net settlement amount directly into the next cohort's deposit without needing a separate transaction. The target cohort must still be in FUNDING.

If settlement of cohort `n` completes after cohort `n+1` has already started, you cannot roll into `n+1` - it will revert with `NotFunding`. Roll into `n+2` or withdraw instead.

**Rolling is never automatic.** Capital never re-enters a cohort without your explicit on-chain action.

---

## Risk Summary

| Scenario                                     | Your outcome                                                           |
| -------------------------------------------- | ---------------------------------------------------------------------- |
| All policies expire worthless (low vol week) | Capital returned + all premiums collected                              |
| Mixed week - some payouts                    | Capital returned + (premiums − partial claims)                         |
| Severe week - heavy payouts                  | Capital returned − net claims (can be negative if claims > premiums)   |
| Every policy hits its cap                    | Your share of `totalCapital × maxUtilizationBps / 10000` could be lost |

The **hard floor** is when every single policy pays its full `maxPayout`. Because `maxUtilizationBps` limits how much of total capital can ever be reserved (e.g., 80%), and the sum of all `maxPayout` values never exceeds `reserved`, your absolute worst case is a fraction of your deposit - not your entire deposit.

---

## Proportional Share Mechanics

Your share of any given cohort is:

```
share = deposits[cohortId][you] / cohort.totalCapital
```

At settlement, both premiums and claims are divided proportionally by this share. If you hold 10% of the vault's capital, you receive 10% of all premiums and absorb 10% of all claims.

**Shares are fixed** for the entire cohort. No new deposits or withdrawals can change the denominator during ACTIVE/SETTLING/SETTLED phases. This fixed-share property is what makes batch settlement possible in O(1) per policy - each policy's proportional split is deterministic at finalization time.

---

## Keeper Budget

The vault maintains a `keeperBudget` - a USDC balance used to incentivize bots that call `keeperPoke` (sampling variance) and `keeperFinalize`. A fraction of each cohort's premiums (`keeperShareBps`) is routed to this budget.

If the keeper budget runs dry, sampling may stop and policies could be marked degraded or unmeasured (triggering premium refunds). Underwriters benefit from keeping the keeper budget funded via `fundKeeperBudget(amount)`.
