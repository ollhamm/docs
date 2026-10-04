---
sidebar_position: 6
title: Deployed Addresses
---

# Deployed Addresses

All contracts are deployed on **Arbitrum Sepolia** (chain ID `421614`).

:::warning Testnet Only
Aruna is currently in testnet. These addresses are for the sandbox deployment on Arbitrum Sepolia. No mainnet deployment exists yet.
:::

---

## v2 Sandbox - Market 0 (mWETH/mUSDC 0.05%)

This is the current active deployment. ABI is frozen at the v2 release.

| Contract                     | Address                                      |
| ---------------------------- | -------------------------------------------- |
| `ArunaFactory`               | `0xA3547B68205794969e8A5229Ab55c2212F6eA472` |
| `CoverVault`                 | `0x7E14ef9E5eF153c3f0420bB80d13c1c7f7DDA44F` |
| `VarianceAccumulator`        | `0xcEF5c3CdF6dd303b522E047ff1376a0F78885c47` |
| `PremiumPricer`              | `0xd2e17AcD143a2Bea3b678d9d110Fe5f2443246FC` |
| `PositionValuer`             | `0xef7022e17c5c26dB9273AfCD0E22A552c41198e2` |
| Uniswap v3 Pool              | `0x0ae57A2751E50597c8a3C183AEbCF115F057d408` |
| Settlement Token (mUSDC)     | `0x29Fccf6C04D4d02c9ea4336c75F84145299c82cA` |
| `NonfungiblePositionManager` | `0x6b2937Bde17889EDCf8fbD8dE31C3C2a70Bc4d65` |

**Market parameters:**

- Tenor: `3600` seconds (1 hour, sandbox short-tenor for testing)
- Max utilization: `80%`
- Sample interval: `30 minutes` (1800 seconds)
- Chain: Arbitrum Sepolia (421614)

:::note Data disclaimer
Data on this vault is shared with the smart-contract team's own RC test scenarios. Do not treat any number read from it as a meaningful demo figure.
:::

---

## v0 Legacy (deprecated)

The v0 deployment has a known bug (`SC-01`: `withdraw` during FUNDING does not reduce `totalCapital`). It is kept read-only so already-indexed v0 data can resolve pool labels. **Never use v0 addresses for live read/write.**

| Contract                    | Address                                      |
| --------------------------- | -------------------------------------------- |
| `ArunaFactory` (v0)         | `0xcbd7D8bDCe3c8D1e9605A647607505e1F88bE7F5` |
| `CoverVault` (v0)           | `0x13368645dF72572d0b7a5A75D56E36d6632f8c7c` |
| `VarianceAccumulator` (v0)  | `0xc373585Fd3f8d033DA37A2496eB721F990982aa0` |
| `PremiumPricer` (v0)        | `0x1395d984eca016e42Fc1C03a78c73cA6C92b95fd` |
| `PositionValuer` (v0)       | `0x44E2555A90F9460669fe099C566cDC99d95B9D2C` |
| Settlement Token v0 (mUSDC) | `0x07B5d700adE197C6c04802D56Cdc93EADCED0f50` |

---

## Verifying Addresses

To verify a vault is a legitimate factory deployment:

```javascript
const factory = getContract({ address: factoryAddress, abi: arunaFactoryAbi });
const allVaults = await factory.read.allVaults();
console.log(allVaults.includes(vaultAddress)); // should be true
```

Or check the `VaultDeployed` event log on [Arbiscan](https://sepolia.arbiscan.io/address/0xA3547B68205794969e8A5229Ab55c2212F6eA472#events) for the factory address.

---

## ABI Source

The v2 ABI is derived from the smart contract commit `01dc2fbfe3a4f2c34e3ba8813a130ff7002ad928` (branch `rc/sandbox-1`). The ABI is frozen - only addresses change between deployments.

ABIs are available in the frontend source at:

- `lib/contracts/abis/coverVault.ts`
- `lib/contracts/abis/varianceAccumulator.ts`
