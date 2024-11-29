import { NextApiRequest, NextApiResponse } from 'next';
import { Pinecone } from '@pinecone-database/pinecone';
import { env } from '~/env.mjs';

type Category = {
  id: string;
  name: string;
  description?: string;
  parentId?: string;
};

type CategoryResponse = {
  categories: Category[];
  error?: string;
};

// Default categories
const DEFAULT_CATEGORIES = [
  {
    id: 'educational',
    name: 'Educational',
    description: 'Educational content and tutorials',
  },
  {
    id: 'entertainment',
    name: 'Entertainment',
    description: 'Entertainment content',
  },
  {
    id: 'news',
    name: 'News',
    description: 'News and current events',
  },
  {
    id: 'technology',
    name: 'Technology',
    description: 'Technology-related content',
    subcategories: [
      {
        id: 'programming',
        name: 'Programming',
        description: 'Programming and coding content',
      },
      {
        id: 'ai-ml',
        name: 'AI & Machine Learning',
        description: 'Artificial Intelligence and Machine Learning content',
      },
    ],
  },
  {
    id: 'business',
    name: 'Business',
    description: 'Business and entrepreneurship content',
  },
];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CategoryResponse>
) {
  if (req.method === 'GET') {
    try {
      const pinecone = new Pinecone({
        apiKey: env.PINECONE_API_KEY,
      });

      const index = pinecone.Index(env.PINECONE_INDEX);

      // Query for existing categories
      const queryResponse = await index.query({
        vector: new Array(1536).fill(0),
        topK: 1,
        filter: { isCategory: true },
      });

      // If no categories exist, initialize with defaults
      if (!queryResponse.matches?.length) {
        // Create category vectors with minimal embedding (all zeros is fine for categories)
        const categoryVectors = DEFAULT_CATEGORIES.flatMap(category => {
          const vectors = [{
            id: `category-${category.id}`,
            values: new Array(1536).fill(0),
            metadata: {
              isCategory: true,
              categoryId: category.id,
              name: category.name,
              description: category.description,
            },
          }];

          if ('subcategories' in category) {
            const subcategories = (category as any).subcategories || [];
            vectors.push(...subcategories.map((sub: any) => ({
              id: `category-${sub.id}`,
              values: new Array(1536).fill(0),
              metadata: {
                isCategory: true,
                categoryId: sub.id,
                name: sub.name,
                description: sub.description,
                parentId: category.id,
              },
            })));
          }

          return vectors;
        });

        // Upsert categories
        await index.upsert(categoryVectors);
      }

      // Query for all categories
      const allCategoriesResponse = await index.query({
        vector: new Array(1536).fill(0),
        topK: 100,
        filter: { isCategory: true },
      });

      const categories = allCategoriesResponse.matches?.map(match => {
        const metadata = match.metadata as any;
        return {
          id: metadata?.categoryId || '',
          name: metadata?.name || '',
          description: metadata?.description,
          parentId: metadata?.parentId,
        };
      }).filter(cat => cat.id && cat.name) || [];

      return res.status(200).json({ categories });
    } catch (error: any) {
      console.error('Error managing categories:', error);
      return res.status(500).json({
        categories: [],
        error: error?.message || 'Failed to manage categories',
      });
    }
  }

  return res.status(405).json({
    categories: [],
    error: 'Method not allowed',
  });
}
