import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title="Aruna Documentation"
      description="Variance cover for Uniswap v3 LPs on Arbitrum. Protocol documentation.">

      {/* Hero */}
      <header className="hero--aruna">
        <div className="container" style={{maxWidth: '900px'}}>
          <Heading as="h1" className="hero__title">
            Aruna Documentation
          </Heading>
          <p className="hero__subtitle">
            VARIANCE COVER · UNISWAP V3 · ARBITRUM
          </p>
          <div style={{marginTop: '2rem', display: 'flex', gap: '12px', flexWrap: 'wrap'}}>
            <Link
              className="button button--primary button--md"
              to="/docs/intro">
              Get started
            </Link>
            <Link
              className="button button--secondary button--md"
              to="/docs/contracts/overview">
              Contract reference
            </Link>
          </div>
        </div>
      </header>

      {/* Cards */}
      <main style={{background: '#0e0f12'}}>
        <div style={{maxWidth: '1100px', margin: '0 auto', padding: '48px 24px'}}>
          <div className="aruna-cards">

            <Link className="aruna-card" to="/docs/intro">
              <div className="aruna-card__eyebrow">01 · Overview</div>
              <div className="aruna-card__title">What is Aruna?</div>
              <p className="aruna-card__body">
                Parametric cover against impermanent loss - priced on realized variance, not price direction. Learn the problem it solves and how it works.
              </p>
            </Link>

            <Link className="aruna-card" to="/docs/how-it-works/for-lps">
              <div className="aruna-card__eyebrow">02 · LP Guide</div>
              <div className="aruna-card__title">Protect a Position</div>
              <p className="aruna-card__body">
                Step-by-step: select your Uniswap v3 position, get a quote, confirm three transactions, and monitor cover through settlement.
              </p>
            </Link>

            <Link className="aruna-card" to="/docs/how-it-works/for-underwriters">
              <div className="aruna-card__eyebrow">03 · Underwriter Guide</div>
              <div className="aruna-card__title">Underwrite a Vault</div>
              <p className="aruna-card__body">
                Deposit USDC into a pool's vault for one cohort cycle. Earn premiums from every LP who buys cover. Roll or withdraw at settlement.
              </p>
            </Link>

            <Link className="aruna-card" to="/docs/contracts/overview">
              <div className="aruna-card__eyebrow">04 · Protocol</div>
              <div className="aruna-card__title">Smart Contracts</div>
              <p className="aruna-card__body">
                Architecture overview, per-contract function reference, ABI, events, errors, and deployed addresses on Arbitrum Sepolia.
              </p>
            </Link>

            <Link className="aruna-card" to="/docs/how-it-works/oracle-math">
              <div className="aruna-card__eyebrow">05 · Math</div>
              <div className="aruna-card__title">Oracle & Settlement</div>
              <p className="aruna-card__body">
                How the TWAP accumulator samples Uniswap v3, the cumulativeSumSq formula, payout calculation, and why a flash-loan wick can't manufacture variance.
              </p>
            </Link>

            <Link className="aruna-card" to="/docs/indexer/graphql">
              <div className="aruna-card__eyebrow">06 · Indexer</div>
              <div className="aruna-card__title">GraphQL API</div>
              <p className="aruna-card__body">
                Query vaults, cohorts, policies, underwriter positions, and TWAP samples from the Ponder-based indexer. Schema, queries, and examples.
              </p>
            </Link>

          </div>
        </div>
      </main>

    </Layout>
  );
}
