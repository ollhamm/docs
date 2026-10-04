---
sidebar_position: 5
title: ArunaFactory
---

# ArunaFactory

`ArunaFactory` deploys new Aruna markets. Each deployment creates a `(CoverVault, VarianceAccumulator, PremiumPricer, PositionValuer)` tuple for a given Uniswap v3 pool and tenor.

**Current testnet address:** `0xA3547B68205794969e8A5229Ab55c2212F6eA472` (Arbitrum Sepolia)

---

## Design

The factory is **fully permissionless** - anyone can call `deploy()` to create a vault for any Uniswap v3 pool. There is no admin gate, no approval queue, and no whitelist at the contract level.

Curation happens off-chain. The Aruna frontend only displays vaults whose addresses appear in the known-good deployment manifest (or that the indexer returns with `isTest: false`). Unlisted vaults are valid, functional contracts - they just aren't surfaced to users by default.

---

## `deploy`

```solidity
function deploy(
    address pool,
    uint32  tenor,
    uint32  gap,
    uint64  anchor,
    uint16  maxUtilizationBps,
    uint128 maxExcessVariance,
    uint16  ewmaAlphaBps,
    uint128 seedVariance,
    uint32  policyCap,
    uint16  keeperShareBps
) external returns (
    address vault,
    address accumulator,
    address pricer,
    address valuer
)
```

Deploys all four contracts for the given `pool` and `tenor`. The `anchor` timestamp determines the start of cohort 1; all subsequent cohort start times are derived from `anchor + (n−1) × (tenor + gap)`.

Returns the addresses of all four deployed contracts. Emits `VaultDeployed`.

**Parameters:**

| Parameter           | Description                                               |
| ------------------- | --------------------------------------------------------- |
| `pool`              | Uniswap v3 pool to cover (must be a real Uniswap v3 pool) |
| `tenor`             | Cover duration per cohort, in seconds                     |
| `gap`               | Gap between cohorts for settlement, in seconds            |
| `anchor`            | Unix timestamp of cohort 1 start                          |
| `maxUtilizationBps` | Maximum capital utilization (8000 = 80%)                  |
| `maxExcessVariance` | Cap on payable excess variance per policy                 |
| `ewmaAlphaBps`      | EWMA smoothing factor (500 = 5%)                          |
| `seedVariance`      | Initial variance estimate before first samples            |
| `policyCap`         | Maximum simultaneous policies per cohort                  |
| `keeperShareBps`    | Keeper budget allocation from premiums                    |

---

## `allVaults`

```solidity
function allVaults() external view returns (address[] memory)
```

Returns all vault addresses ever deployed via this factory.

---

## `allVaultsLength`

```solidity
function allVaultsLength() external view returns (uint256)
```

Returns the total number of vaults deployed.

---

## Events

```solidity
event VaultDeployed(
    address indexed vault,
    address indexed pool,
    address accumulator,
    address pricer,
    address valuer,
    uint32  tenor,
    uint64  anchor
);
```

---

## ReleaseGuard

The factory includes a `ReleaseGuard` that verifies the bytecode init-code hash of `CoverVault` at deploy time. This ensures:

- Every vault deployed by the factory matches the exact v2 bytecode
- No modified or experimental vault can be deployed through the factory
- Clients (frontend, bots) can trust that any factory-deployed vault has the v2 ABI

This is a one-way ratchet - the factory cannot be updated to allow a different bytecode without deploying a new factory.

---

## Deploying a New Market

To create a new market (e.g., a vault for a different Uniswap v3 pool):

1. Choose a pool address, tenor, and calibration parameters
2. Call `factory.deploy(pool, tenor, gap, anchor, ...)`
3. Register the vault address with the indexer (see the indexer README for instructions)
4. Add the vault address to the frontend's known-good manifest (or contact the Aruna team to list it)

There is no on-chain approval step. Steps 3 and 4 are off-chain curation only.
