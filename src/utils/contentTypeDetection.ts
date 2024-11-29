interface ContentTypeDetectionOptions {
  preferredLanguage?: string;
}

export function detectContentType(
  input: string | { mimetype?: string }, 
  options: ContentTypeDetectionOptions = {}
): string {
  // If input is an object with mimetype, use that first
  const mimeType = typeof input === 'object' ? input.mimetype : null;
  const text = typeof input === 'string' ? input : '';

  // Mime type detection
  if (mimeType) {
    if (mimeType.includes('text/plain')) return 'text';
    if (mimeType.includes('application/pdf')) return 'document';
    if (mimeType.includes('application/msword') || 
        mimeType.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document')) 
      return 'document';
  }

  // Content-based detection
  const lowercaseText = text.toLowerCase();

  // Technical content detection
  const technicalKeywords = [
    'algorithm', 'function', 'class', 'interface', 
    'implementation', 'architecture', 'framework'
  ];
  const technicalScore = technicalKeywords.filter(keyword => 
    lowercaseText.includes(keyword)
  ).length;

  if (technicalScore > 2) return 'technical';

  // Scientific content detection
  const scientificKeywords = [
    'research', 'hypothesis', 'experiment', 'methodology', 
    'statistical', 'analysis', 'conclusion'
  ];
  const scientificScore = scientificKeywords.filter(keyword => 
    lowercaseText.includes(keyword)
  ).length;

  if (scientificScore > 2) return 'scientific';

  // Language-specific detection if preferred language is provided
  if (options.preferredLanguage) {
    const languageSpecificKeywords: {[key: string]: string[]} = {
      'python': ['def', 'class', 'import', 'from'],
      'javascript': ['const', 'let', 'function', 'import'],
      'spanish': ['el', 'la', 'de', 'que'],
      'french': ['le', 'la', 'de', 'qui']
    };

    const languageKeywords = languageSpecificKeywords[options.preferredLanguage.toLowerCase()] || [];
    const languageScore = languageKeywords.filter(keyword => 
      lowercaseText.includes(keyword)
    ).length;

    if (languageScore > 1) return options.preferredLanguage.toLowerCase();
  }

  // Default to generic text
  return 'text';
}
