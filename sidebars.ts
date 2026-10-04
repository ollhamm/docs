import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docs: [
    {
      type: 'doc',
      id: 'intro',
      label: 'Introduction',
    },
    {
      type: 'category',
      label: 'How It Works',
      collapsible: true,
      collapsed: false,
      items: [
        'how-it-works/impermanent-loss',
        'how-it-works/cohorts',
        'how-it-works/for-lps',
        'how-it-works/for-underwriters',
        'how-it-works/oracle-math',
      ],
    },
    {
      type: 'category',
      label: 'Smart Contracts',
      collapsible: true,
      collapsed: false,
      items: [
        'contracts/overview',
        'contracts/cover-vault',
        'contracts/variance-accumulator',
        'contracts/premium-pricer',
        'contracts/factory',
        'contracts/addresses',
      ],
    },
    {
      type: 'category',
      label: 'Indexer',
      collapsible: true,
      collapsed: false,
      items: [
        'indexer/graphql',
      ],
    },
    {
      type: 'doc',
      id: 'security',
      label: 'Security',
    },
    {
      type: 'doc',
      id: 'faq-glossary',
      label: 'FAQ & Glossary',
    },
  ],
};

export default sidebars;
