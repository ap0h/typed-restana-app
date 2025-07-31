/**
 * STRICTNESS CONFIGURATION DEMO
 * 
 * This example demonstrates how to configure validation strictness
 * at different levels: global, per-route, and schema-level
 */

import { z } from 'zod';
import { TypeSafeApp } from '../core/schema-types';
import restana from 'restana';

// =============================================================================
// Schema Definitions with Different Strictness Levels
// =============================================================================

// Base User Schema (flexible by default)
const UserSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  age: z.number().int().min(0).optional()
});

// Strict User Schema (explicitly strict)
const StrictUserSchema = UserSchema.strict();

// Response Schemas
const UserResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  age: z.number().int().min(0).optional(),
  createdAt: z.string()
});

const StrictUserResponseSchema = UserResponseSchema.strict();

// Error Response Schema
const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  details: z.array(z.object({
    path: z.string(),
    message: z.string()
  })).optional()
});

// =============================================================================
// Inferred Types
// =============================================================================

type User = z.infer<typeof UserSchema>;
type StrictUser = z.infer<typeof StrictUserSchema>;
type UserResponse = z.infer<typeof UserResponseSchema>;

// =============================================================================
// Demo Route Registration
// =============================================================================

export function demonstrateStrictnessFeatures(app: TypeSafeApp) {
  
  // 📝 Example 1: Flexible validation (allows extra fields)
  // This follows the default behavior - extra fields are ignored
  app.post<never, never, User, UserResponse>('/users/flexible', {
    schema: {
      body: UserSchema,
      responses: {
        200: {
          schema: UserResponseSchema,
          description: 'User created successfully with flexible validation'
        },
        400: {
          schema: ErrorResponseSchema,
          description: 'Validation Error'
        }
      }
    },
    metadata: {
      summary: 'Create user with flexible validation',
      description: 'Allows extra fields in request body - follows default TypeScript behavior',
      tags: ['Strictness Demo', 'Flexible']
    },
    // No explicit strict setting - uses global config
    handler: async ({ body }) => {
      console.log('📝 Flexible validation - received body:', body);
      
      // Simulate user creation with extra metadata
      return {
        id: `user-${Date.now()}`,
        name: body.name,
        email: body.email,
        age: body.age,
        createdAt: new Date().toISOString(),
        // Adding extra field that's not in schema
        metadata: 'This extra field is allowed due to flexible validation'
      } as UserResponse;
    }
  });

  // 🔒 Example 2: Strict validation (rejects extra fields)
  // This explicitly enables strict mode for this route
  app.post<never, never, StrictUser, UserResponse>('/users/strict', {
    schema: {
      body: StrictUserSchema, // Using .strict() schema
      responses: {
        200: {
          schema: UserResponseSchema,
          description: 'User created successfully with strict validation'
        },
        400: {
          schema: ErrorResponseSchema,
          description: 'Validation Error'
        }
      }
    },
    metadata: {
      summary: 'Create user with strict validation',
      description: 'Rejects extra fields in request body using Zod .strict()',
      tags: ['Strictness Demo', 'Strict']
    },
    strict: true, // Per-route override to enable strict mode
    validateResponse: true, // Enable response validation for this route
    handler: async ({ body }) => {
      console.log('🔒 Strict validation - received body:', body);
      
      return {
        id: `strict-user-${Date.now()}`,
        name: body.name,
        email: body.email,
        age: body.age,
        createdAt: new Date().toISOString()
      };
    }
  });

  // ⚡ Example 3: Route-level strictness override
  // This shows per-route configuration overriding global settings
  app.post<never, never, User, UserResponse>('/users/per-route-config', {
    schema: {
      body: UserSchema,
      responses: {
        200: {
          schema: UserResponseSchema,
          description: 'User created with per-route configuration'
        }
      }
    },
    metadata: {
      summary: 'Create user with per-route strictness override',
      description: 'Demonstrates per-route configuration overriding global settings',
      tags: ['Strictness Demo', 'Configuration']
    },
    strict: false,          // Explicitly disable strict mode for this route
    validateResponse: true, // Enable response validation for this route
    handler: async ({ body }) => {
      console.log('⚡ Per-route config - received body:', body);
      
      // Return response that may have extra fields
      return {
        id: `config-user-${Date.now()}`,
        name: body.name,
        email: body.email,
        age: body.age,
        createdAt: new Date().toISOString(),
        extraField: 'This will be validated against response schema'
      } as UserResponse;
    }
  });

  // 🧪 Example 4: Response validation demo
  // This demonstrates response schema validation
  app.get<never, { id: string }, UserResponse>('/users/response-validation/:id', {
    schema: {
      params: z.object({ id: z.string() }),
      responses: {
        200: {
          schema: StrictUserResponseSchema, // Strict response validation
          description: 'User retrieved with strict response validation'
        },
        404: {
          schema: ErrorResponseSchema,
          description: 'User not found'
        }
      }
    },
    metadata: {
      summary: 'Get user with response validation',
      description: 'Demonstrates response schema validation in development mode',
      tags: ['Strictness Demo', 'Response Validation']
    },
    validateResponse: true, // Force response validation
    handler: async ({ params }) => {
      console.log('🧪 Response validation - user ID:', params.id);
      
      if (params.id === 'invalid') {
        // This would fail response validation due to extra field
        return {
          id: params.id,
          name: 'Test User',
          email: 'test@example.com',
          createdAt: new Date().toISOString(),
          invalidField: 'This will cause validation error'
        } as UserResponse;
      }
      
      return {
        id: params.id,
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
        createdAt: '2024-01-01T00:00:00.000Z'
      };
    }
  });

  // 🎯 Example 5: Testing endpoint for strictness
  // This endpoint helps test different strictness behaviors
  app.post<never, never, any, any>('/test/strictness', {
    metadata: {
      summary: 'Test strictness behavior',
      description: 'Send various payloads to test validation behavior',
      tags: ['Strictness Demo', 'Testing']
    },
    handler: async ({ body, req }) => {
      const testMode = req.query?.mode || 'info';
      
      return {
        received: body,
        mode: testMode,
        tips: {
          flexible: 'Try POST /users/flexible with extra fields',
          strict: 'Try POST /users/strict with extra fields (should fail)',
          responseValidation: 'Try GET /users/response-validation/invalid'
        },
        examples: {
          validBody: {
            name: 'Test User',
            email: 'test@example.com',
            age: 25
          },
          bodyWithExtraFields: {
            name: 'Test User',
            email: 'test@example.com',
            age: 25,
            extraField: 'This will be allowed or rejected based on strictness'
          }
        }
      };
    }
  });

  console.log('🎯 Strictness demo routes registered:');
  console.log('   📝 POST /users/flexible - Allows extra fields');
  console.log('   🔒 POST /users/strict - Rejects extra fields');
  console.log('   ⚡ POST /users/per-route-config - Per-route configuration');
  console.log('   🧪 GET  /users/response-validation/:id - Response validation');
  console.log('   🎯 POST /test/strictness - Testing endpoint');
}

// =============================================================================
// Usage Examples and Documentation
// =============================================================================

export const strictnessExamples = {
  // Example 1: Testing flexible validation
  flexible: {
    url: 'POST /users/flexible',
    description: 'Allows extra fields - follows TypeScript structural typing',
    validRequest: {
      name: 'John Doe',
      email: 'john@example.com',
      age: 30
    },
    requestWithExtraFields: {
      name: 'John Doe',
      email: 'john@example.com',
      age: 30,
      extraField: 'This will be accepted',
      anotherExtra: 123
    }
  },

  // Example 2: Testing strict validation
  strict: {
    url: 'POST /users/strict',
    description: 'Rejects extra fields using Zod .strict()',
    validRequest: {
      name: 'Jane Smith',
      email: 'jane@example.com',
      age: 25
    },
    invalidRequest: {
      name: 'Jane Smith',
      email: 'jane@example.com',
      age: 25,
      extraField: 'This will be rejected'
    }
  },

  // Example 3: Testing response validation
  responseValidation: {
    urls: [
      'GET /users/response-validation/valid',
      'GET /users/response-validation/invalid'
    ],
    description: 'Tests response schema validation in development mode'
  },

  // Testing commands
  curlCommands: [
    'curl -X POST "http://localhost:3000/users/flexible" -H "Content-Type: application/json" -d \'{"name":"Test","email":"test@example.com","extra":"allowed"}\'',
    'curl -X POST "http://localhost:3000/users/strict" -H "Content-Type: application/json" -d \'{"name":"Test","email":"test@example.com","extra":"rejected"}\'',
    'curl "http://localhost:3000/users/response-validation/invalid"'
  ]
};

export default demonstrateStrictnessFeatures;