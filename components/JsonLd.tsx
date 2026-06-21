const SITE_URL = 'https://quemonesum.site';
const SITE_NAME = 'DeepUM';

// JSON.stringify alone does not escape <, >, & which can break out of <script> tags.
function safeJsonLd(data: object): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

export function WebSiteJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    description:
      'El foro anónimo de los estudiantes de la Universidad de Montemorelos, Nuevo León, México.',
    inLanguage: 'es-MX',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/buscar?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(data) }}
    />
  );
}

interface PostJsonLdProps {
  id: string;
  content: string;
  category: string;
  createdAt: string;
  updatedAt?: string | null;
  commentCount?: number;
}

export function PostJsonLd({
  id,
  content,
  category,
  createdAt,
  updatedAt,
  commentCount,
}: PostJsonLdProps) {
  const postUrl = `${SITE_URL}/posts/${id}`;

  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'DiscussionForumPosting',
    '@id': postUrl,
    url: postUrl,
    headline: content.slice(0, 110),
    text: content,
    datePublished: createdAt,
    inLanguage: 'es-MX',
    keywords: `quemones, ${category}, Universidad de Montemorelos, UM, Montemorelos`,
    isPartOf: {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: SITE_URL,
    },
    author: {
      '@type': 'Person',
      name: 'Anónimo',
    },
  };

  if (updatedAt) data.dateModified = updatedAt;
  if (commentCount !== undefined) data.commentCount = commentCount;

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(data) }}
    />
  );
}
