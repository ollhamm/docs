---
sidebar_position: 3
title: For LPs - Buying Cover
---

# For LPs - Buying Cover

Step-by-step guide to protecting your Uniswap v3 position with Aruna.

---

## Prerequisites

- A **Uniswap v3 position** (NFT from `NonfungiblePositionManager`) in a pool that has an Aruna vault
- **USDC** in your wallet to pay the premium
- The pool's current cohort must be in **ACTIVE** status

---

## Overview

Buying cover takes **three on-chain transactions**:

1. `approve` USDC (allow the vault to pull the premium)
2. `approve` your position NFT (allow the vault to escrow the NFT)
3. `buyCover` (pays premium, moves NFT into escrow, reserves vault capacity, mints the policy)

Your position NFT moves into the vault's escrow for the duration of the cover. **This is intentional** - it prevents you from withdrawing liquidity while holding a variance payout, which would turn cover into a naked variance bet.

---

## Step 1 - Select Your Position

Connect your wallet and navigate to **Protect → Select a position**. The app reads all `NonfungiblePositionManager` positions owned by your wallet and filters them against known Aruna vaults.

For each position, the app shows:

- Pool pair and fee tier (e.g., mWETH/mUSDC 0.05%)
- Whether the position is in-range
- Token amounts and fees owed

Select the position you want to cover. If your position ID is not listed (e.g., it was recently minted), paste the token ID directly.

:::info
Cover attaches to **one position NFT owned by you**. The contract verifies `NonfungiblePositionManager.ownerOf(tokenId) == msg.sender` at purchase time. Positions owned by a different address cannot be covered.
:::

---

## Step 2 - Get a Quote

Call `CoverVault.quote(cohortId, positionTokenId, strikeAnnualized)` to see the premium and payout parameters for a given strike.

The app shows this as a slider or set of buttons for common strike levels (e.g., 25%, 35%, 50% annualized vol).

**Quote outputs:**

| Field            | Meaning                                                            |
| ---------------- | ------------------------------------------------------------------ |
| `premium`        | USDC you pay now - also your maximum possible loss                 |
| `varNotional`    | Variance notional derived from your position's liquidity and range |
| `maxPayout`      | Maximum USDC you can receive at settlement                         |
| `coveredSeconds` | How many seconds of the cohort you're covered for                  |

**Choosing a strike:**

- Lower strike → cover starts paying at a lower variance level → higher premium, earlier payout
- Higher strike → cover only pays at high variance → lower premium, payout only in violent weeks

The breakeven vol is the realized volatility at which your payout exactly equals the premium paid. The cap-reached vol is the volatility at which you receive the full `maxPayout`.

:::warning
The quote is computed live from the current cohort state. The premium can change between the quote screen and your `buyCover` transaction if the EWMA or cohort timing changes. The contract enforces `premium ≤ maxPremium` (your slippage tolerance); if it exceeds your tolerance, the transaction reverts with `PremiumTooHigh`.
:::

**Purchase is rejected** if fewer than 5 sample intervals remain in the cohort (`TooLateToBuy`). There is not enough time to build a meaningful measurement window.

---

## Step 3 - Confirm and Sign

Review the terms on the confirmation screen. The app shows:

- Position being covered
- Vault address
- Strike (annualized vol)
- Maximum payout cap
- Cohort settlement date
- Oracle: Pool TWAP

**Read the acknowledgement carefully:**

> _I understand the premium is non-refundable, the payout is capped at [X] USDC, my position moves into the vault while covered, and settlement uses the pool's TWAP rather than spot price._

Check the box, then execute three transactions in sequence:

### Transaction 1 - Approve USDC

```
IERC20(settlementToken).approve(vaultAddress, premium)
```

Authorizes the vault to pull exactly the premium amount.

### Transaction 2 - Approve Position NFT

```
NonfungiblePositionManager.approve(vaultAddress, tokenId)
```

Authorizes the vault to pull this one specific NFT into escrow. This approval is **position-specific** - it does not grant the vault access to any other NFT.

### Transaction 3 - Buy Cover

```solidity
CoverVault.buyCover(
    cohortId,
    positionTokenId,
    strikeAnnualized,  // uint64, scaled to 1e18
    maxPremium,        // your slippage tolerance
    deadline           // unix timestamp
)
```

Returns `policyId` - the ID of your policy. Emits `CoverBought` and `PositionEscrowed`.

---

## While Cover Is Active

Your position NFT is now inside the vault. You can:

- **Collect trading fees**: `CoverVault.collectFees(policyId, recipient)` - sends accumulated Uniswap pool fees to any address you specify. Your fees are always 100% yours.
- **Cancel the cover**: `CoverVault.cancel(policyId)` - returns the NFT to you immediately. The premium is **not refunded**; it stays with the cohort. The reserved vault capacity is released and can be sold to other LPs.

You cannot modify the position's liquidity range or amounts while it is escrowed.

The **Active** page shows:

- Current realized vol vs your strike (live)
- Indicative mark-to-settlement (not a guarantee)
- Samples taken / missed
- Time until settlement

---

## Settlement

When the cohort tenor ends, keeper bots call `finalize` and then `settleBatch`. Your policy is settled automatically - **no action is required from you**.

If realized variance finished **above your strike:**

- Your payout is computed: `payout = varNotional × (realizedVariance − strikeVariance)`, capped at `maxPayout`
- Net result: `payout − premium`
- The payout (and your position NFT) are returned to your wallet

If realized variance finished **at or below your strike:**

- Payout is zero
- Your loss = premium (exactly what you paid, no more)
- Your position NFT is returned to your wallet

If the measurement window was too short (fewer than 2 valid returns after your purchase - an extremely rare edge case):

- Payout is zero
- **Premium is fully refunded**
- Your position NFT is returned

In all cases, the NFT returns to you. If the automatic transfer fails (e.g., a contract wallet rejects it), the NFT and any payout are parked and claimable later via `claimPosition(policyId)` and `claimUnclaimed()`.

---

## Key Invariants

1. **Premium = maximum loss.** Always. From the moment `buyCover` confirms.
2. **Payout is capped** at `maxPayout`, a number fixed at purchase time and backed by real vault capital.
3. **No surprise liabilities.** LPs can never owe more than the premium - not at settlement, not on early exit.
4. **Trading fees are untouched.** Cover never affects your Uniswap fee earnings.
