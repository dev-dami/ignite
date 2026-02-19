const docs = [
  {
    title: 'Getting Started',
    href: '../getting-started.md',
    desc: 'Install Ignite, create your first service, and run secure execution paths quickly.',
    tags: ['guides', 'onboarding', 'cli'],
  },
  {
    title: 'Walkthrough',
    href: '../walkthrough.md',
    desc: 'Build a realistic service, execute with audit mode, and expose it over HTTP.',
    tags: ['guides', 'examples'],
  },
  {
    title: 'API Reference',
    href: '../api.md',
    desc: 'Full CLI and HTTP contracts with request/response and runtime behavior notes.',
    tags: ['reference', 'api', 'cli'],
  },
  {
    title: 'Architecture',
    href: '../architecture.md',
    desc: 'Package structure, execution pipeline, and component boundaries.',
    tags: ['reference', 'design'],
  },
  {
    title: 'Preflight Checks',
    href: '../preflight.md',
    desc: 'Threshold semantics, status resolution, and tuning guidance for preflight.',
    tags: ['reference', 'operations'],
  },
  {
    title: 'Threat Model',
    href: '../threat-model.md',
    desc: 'Security assumptions, trust boundaries, and explicit non-goals.',
    tags: ['operations', 'security'],
  },
  {
    title: 'Research Notes',
    href: '../research.md',
    desc: 'Reproducibility methodology, benchmark interpretation, and study guidance.',
    tags: ['operations', 'research'],
  },
  {
    title: 'Contributing',
    href: '../../CONTRIBUTING.md',
    desc: 'Local workflow, verification steps, and CI/release contribution requirements.',
    tags: ['operations', 'workflow'],
  },
];

const quickCommands = [
  {
    name: 'Full Verification',
    description: 'Run the same checks expected before merge and release.',
    cmd: 'bun run lint && bun run typecheck && bun run test',
  },
  {
    name: 'Build Release Archives',
    description: 'Compile binaries and generate SHA256 checksums in dist/.',
    cmd: 'bun run scripts/build-binaries.ts',
  },
  {
    name: 'Verify Release Artifacts',
    description: 'Validate archive integrity against published checksum file.',
    cmd: 'cd dist && sha256sum -c SHA256SUMS',
  },
  {
    name: 'Inspect Runtime Matrix',
    description: 'Print supported runtimes and versions from CLI output.',
    cmd: 'ignite env --runtimes',
  },
];

const bestPractices = [
  {
    title: 'Search and Navigation',
    items: [
      'Keep search visible above the fold with immediate feedback.',
      'Provide clear no-results state with suggestion to broaden query.',
      'Highlight active section so readers always know their location.',
    ],
  },
  {
    title: 'Accessibility Defaults',
    items: [
      'Use semantic heading hierarchy (h1 -> h2 -> h3) without skipping levels.',
      'Ensure keyboard access for navigation, tabs, and accordion controls.',
      'Preserve minimum contrast ratio of 4.5:1 for body text in light mode.',
    ],
  },
  {
    title: 'Release Readiness',
    items: [
      'Document exact verification commands for reproducibility.',
      'Keep API docs synchronized with actual response contracts.',
      'Publish and verify SHA256 checksums with release archives.',
    ],
  },
];

const sectionLinks = [
  { id: 'hero-title', label: 'Search' },
  { id: 'docs-title', label: 'Documentation Library' },
  { id: 'quick-title', label: 'Quick Commands' },
  { id: 'practice-title', label: 'Best Practices' },
];

const docsGrid = document.getElementById('docs-grid');
const searchInput = document.getElementById('doc-search');
const clearSearchBtn = document.getElementById('clear-search');
const emptyState = document.getElementById('empty-state');
const status = document.getElementById('result-status');
const sectionNav = document.getElementById('section-nav');
const commandList = document.getElementById('command-list');
const accordion = document.getElementById('practice-accordion');
const filterButtons = [...document.querySelectorAll('.pill')];
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');

let activeFilter = 'all';
let searchTerm = '';

function buildSectionNav() {
  sectionNav.innerHTML = '';

  sectionLinks.forEach((section) => {
    const li = document.createElement('li');
    const link = document.createElement('a');
    link.href = `#${section.id}`;
    link.textContent = section.label;
    li.appendChild(link);
    sectionNav.appendChild(li);
  });
}

function createTag(tagText) {
  const tag = document.createElement('span');
  tag.className = 'tag';
  tag.textContent = tagText;
  return tag;
}

function renderDocs() {
  const filtered = docs.filter((doc) => {
    const byFilter = activeFilter === 'all' || doc.tags.includes(activeFilter);
    const term = searchTerm.trim().toLowerCase();

    if (!term) return byFilter;

    const corpus = `${doc.title} ${doc.desc} ${doc.tags.join(' ')}`.toLowerCase();
    return byFilter && corpus.includes(term);
  });

  docsGrid.innerHTML = '';

  const template = document.getElementById('doc-card-template');
  filtered.forEach((doc) => {
    const node = template.content.cloneNode(true);
    const link = node.querySelector('.doc-link');
    const title = node.querySelector('h3');
    const desc = node.querySelector('.doc-desc');
    const tagRow = node.querySelector('.tag-row');

    link.href = doc.href;
    title.textContent = doc.title;
    desc.textContent = doc.desc;

    doc.tags.forEach((tagText) => tagRow.appendChild(createTag(tagText)));

    docsGrid.appendChild(node);
  });

  emptyState.hidden = filtered.length !== 0;
  status.textContent = `${filtered.length} result${filtered.length === 1 ? '' : 's'} shown`;
}

function renderCommands() {
  commandList.innerHTML = '';
  const template = document.getElementById('command-template');

  quickCommands.forEach((entry) => {
    const node = template.content.cloneNode(true);
    node.querySelector('h3').textContent = entry.name;
    node.querySelector('p').textContent = entry.description;
    node.querySelector('code').textContent = entry.cmd;

    const copyBtn = node.querySelector('.copy-btn');
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(entry.cmd);
        copyBtn.textContent = 'Copied';
        window.setTimeout(() => {
          copyBtn.textContent = 'Copy';
        }, 1200);
      } catch {
        copyBtn.textContent = 'Copy failed';
      }
    });

    commandList.appendChild(node);
  });
}

function renderAccordion() {
  accordion.innerHTML = '';
  const template = document.getElementById('accordion-template');

  bestPractices.forEach((section) => {
    const node = template.content.cloneNode(true);
    const trigger = node.querySelector('.accordion-trigger');
    const title = node.querySelector('.title');
    const content = node.querySelector('.accordion-content');
    const list = node.querySelector('ul');

    title.textContent = section.title;

    section.items.forEach((item) => {
      const li = document.createElement('li');
      li.textContent = item;
      list.appendChild(li);
    });

    trigger.addEventListener('click', () => {
      const expanded = trigger.getAttribute('aria-expanded') === 'true';
      trigger.setAttribute('aria-expanded', String(!expanded));
      content.hidden = expanded;
    });

    accordion.appendChild(node);
  });
}

function bindSearch() {
  searchInput.addEventListener('input', () => {
    searchTerm = searchInput.value;
    renderDocs();
  });

  clearSearchBtn.addEventListener('click', () => {
    searchTerm = '';
    searchInput.value = '';
    searchInput.focus();
    renderDocs();
  });
}

function bindFilters() {
  filterButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterButtons.forEach((item) => {
        item.classList.remove('active');
        item.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      activeFilter = btn.dataset.filter;
      renderDocs();
    });
  });
}

function bindSidebarToggle() {
  sidebarToggle.addEventListener('click', () => {
    const isOpen = sidebar.classList.toggle('open');
    sidebarToggle.setAttribute('aria-expanded', String(isOpen));
  });
}

function bindActiveSectionObserver() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const id = entry.target.id;
        const links = sectionNav.querySelectorAll('a');
        links.forEach((link) => link.classList.toggle('active', link.getAttribute('href') === `#${id}`));
      });
    },
    { rootMargin: '-35% 0px -55% 0px', threshold: 0 }
  );

  sectionLinks.forEach((section) => {
    const el = document.getElementById(section.id);
    if (el) observer.observe(el);
  });
}

buildSectionNav();
renderDocs();
renderCommands();
renderAccordion();
bindSearch();
bindFilters();
bindSidebarToggle();
bindActiveSectionObserver();
