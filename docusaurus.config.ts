import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Aruna',
  tagline: 'Variance cover for Uniswap v3 LPs on Arbitrum',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://docs.aruna.finance',
  baseUrl: '/',

  organizationName: 'Aruna-Finance',
  projectName: 'aruna',

  onBrokenLinks: 'throw',

  markdown: {
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  themes: ['@docusaurus/theme-mermaid'],

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  stylesheets: [
    {
      href: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap',
      type: 'text/css',
    },
  ],

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: '/docs',
          editUrl: 'https://github.com/Aruna-Finance/aruna/tree/main/docs/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/aruna-social-card.jpg',
    colorMode: {
      defaultMode: 'dark',
      disableSwitch: true,
      respectPrefersColorScheme: false,
    },
    mermaid: {
      theme: {light: 'dark', dark: 'dark'},
      options: {
        themeVariables: {
          fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif",
          fontSize: '14px',
          lineColor: '#98a0ab',
          edgeLabelBackground: '#0e0f12',
        },
      },
    },
    navbar: {
      title: 'Aruna',
      logo: {
        alt: 'Aruna',
        src: 'img/logo.png',
        srcDark: 'img/logo.png',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docs',
          position: 'left',
          label: 'Documentation',
        },
        {
          href: 'https://github.com/Aruna-Finance',
          label: 'GitHub',
          position: 'right',
        },
        {
          type: 'html',
          position: 'right',
          value: '<a class="navbar-launch-btn navbar__item navbar__link" href="https://arunafi.xyz/" target="_blank" rel="noopener noreferrer">Launch App</a>',
        },
      ],
      style: 'dark',
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentation',
          items: [
            { label: 'Introduction', to: '/docs/intro' },
            { label: 'How It Works', to: '/docs/how-it-works/impermanent-loss' },
            { label: 'Smart Contracts', to: '/docs/contracts/overview' },
            { label: 'Indexer / GraphQL', to: '/docs/indexer/graphql' },
          ],
        },
        {
          title: 'Protocol',
          items: [
            { label: 'Launch App', href: 'https://arunafi.xyz/' },
            { label: 'Arbiscan (Testnet)', href: 'https://sepolia.arbiscan.io/address/0x7E14ef9E5eF153c3f0420bB80d13c1c7f7DDA44F' },
            { label: 'GitHub', href: 'https://github.com/Aruna-Finance' },
          ],
        },
      ],
      copyright: `© ${new Date().getFullYear()} Aruna Finance`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.vsDark,
      additionalLanguages: ['solidity', 'typescript', 'bash', 'graphql', 'json'],
    },
    algolia: undefined,
  } satisfies Preset.ThemeConfig,
};

export default config;