import { EnhancedVectorStorage } from './vectorStorage';
import { OpenAIEmbeddings } from '@langchain/openai';

interface DevelopmentContext {
  timestamp: string;
  section: string;
  description: string;
  codeChanges?: string[];
  dependencies?: string[];
  nextSteps?: string[];
  challenges?: string[];
}

export class DevelopmentContextManager {
  private vectorStorage: EnhancedVectorStorage;
  private readonly namespace = 'development_context';

  constructor() {
    this.vectorStorage = new EnhancedVectorStorage();
  }

  async initialize() {
    await this.vectorStorage.initialize();
  }

  async storeContext(context: DevelopmentContext) {
    const textContent = `
      Section: ${context.section}
      Timestamp: ${context.timestamp}
      Description: ${context.description}
      ${context.codeChanges ? `Code Changes:\n${context.codeChanges.join('\n')}` : ''}
      ${context.dependencies ? `Dependencies:\n${context.dependencies.join('\n')}` : ''}
      ${context.nextSteps ? `Next Steps:\n${context.nextSteps.join('\n')}` : ''}
      ${context.challenges ? `Challenges:\n${context.challenges.join('\n')}` : ''}
    `;

    await this.vectorStorage.addDocument(textContent, {
      sourceType: 'development_context',
      title: `Development Context - ${context.section}`,
      timestamp: context.timestamp,
      section: context.section
    });
  }

  async queryContext(section: string, topK: number = 5) {
    return await this.vectorStorage.semanticSearch(
      `Development context for section: ${section}`,
      { sourceType: ['development_context'] },
      topK
    );
  }

  async getRelatedContexts(currentContext: string, topK: number = 3) {
    return await this.vectorStorage.semanticSearch(
      currentContext,
      { sourceType: ['development_context'] },
      topK
    );
  }
}
