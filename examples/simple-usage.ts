/**
 * Simple Usage Example
 * 
 * This demonstrates the most basic usage of the type-safe Restana app
 */

import restana from 'restana';
import { z } from 'zod';
import { createTypedApp } from '../src';

// Define Zod schemas first (single source of truth)
const HelloQuerySchema = z.object({
  name: z.string().optional()
});

const HelloResponseSchema = z.object({
  message: z.string(),
  timestamp: z.string()
});

// Infer TypeScript types from schemas
type HelloQuery = z.infer<typeof HelloQuerySchema>;
type HelloResponse = z.infer<typeof HelloResponseSchema>;

// Create server
const service = restana();
const app = createTypedApp(service);

// Define type-safe route
app.get<HelloQuery, unknown, HelloResponse>('/hello', {
  schema: {
    query: HelloQuerySchema,
    responses: {
      200: {
        schema: HelloResponseSchema,
        description: 'Greeting response'
      }
    }
  },
  metadata: {
    summary: 'Say hello',
    description: 'Returns a greeting message',
    tags: ['Greetings']
  },
  handler: async ({ query }) => {
    // ✅ query is fully typed as HelloQuery
    const name = query.name || 'World';
    
    // ✅ Return type is enforced as HelloResponse
    return {
      message: `Hello, ${name}!`,
      timestamp: new Date().toISOString()
    };
  }
});

// Start server
if (require.main === module) {
  service.start(3000).then(() => {
    console.log('🚀 Simple server running on http://localhost:3000');
    console.log('📖 Try: http://localhost:3000/hello?name=TypeScript');
  });
}

export default service;