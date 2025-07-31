/**
 * DEMONSTRATION: Enhanced Type Safety Examples
 *
 * This file demonstrates the improved type safety where TypeScript types
 * are enforced at the schema level, preventing mismatches between
 * TypeScript interfaces and their corresponding Zod schemas.
 */

import { z } from 'zod';
import { TypeSafeApp } from '../src/core/schema-types';

// ✅ NEW APPROACH: Define Zod schemas first, then infer TypeScript types
const UserQuerySchema = z.object({
  firstname: z.string().optional(),
  age: z.number().int().optional(),
  active: z.boolean().optional()
});

const UserParamsSchema = z.object({
  id: z.string()
});

const UserResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  createdAt: z.string()
});

// Infer TypeScript types from Zod schemas
type UserQuery = z.infer<typeof UserQuerySchema>;
type UserParams = z.infer<typeof UserParamsSchema>;
type UserResponse = z.infer<typeof UserResponseSchema>;

// ❌ INCORRECT: These would cause TypeScript compilation errors
// Uncomment to see the type safety in action:

/*
// With z.infer, you can't create mismatched schemas because
// the TypeScript type is derived FROM the schema, not the other way around
const wrongSchema = z.object({
  wrongField: z.string().optional(), // This would be the actual type
  age: z.string().optional()         // string, not number
});
type WrongType = z.infer<typeof wrongSchema>; // { wrongField?: string; age?: string }

// This ensures schemas and types are always in sync!
*/

/**
 * Example of type-safe route definition
 */
export function demonstrateTypeSafeRoutes(app: TypeSafeApp) {
  // ✅ CORRECT: All types are enforced and aligned
  app.get<UserQuery, UserParams, UserResponse>('/users/:id', {
    schema: {
      query: UserQuerySchema, // ✅ Types inferred from Zod schema
      params: UserParamsSchema, // ✅ Types inferred from Zod schema
      responses: {
        200: {
          schema: UserResponseSchema, // ✅ Types inferred from Zod schema
          description: 'User retrieved successfully'
        }
      }
    },
    metadata: {
      summary: 'Get user by ID',
      tags: ['Users']
    },
    handler: async ({ query, params }) => {      
      // ✅ Full TypeScript IntelliSense and type checking
      console.log('Query name:', query.firstname); // ✅ string | undefined
      console.log('Query age:', query.age); // ✅ number | undefined
      console.log('Query active:', query.active); // ✅ boolean | undefined
      console.log('User ID:', params.id); // ✅ string

      // ✅ Return type is enforced to match UserResponse
      return {
        id: params.id,
        name: 'John Doe',
        email: 'john@example.com',
        createdAt: new Date().toISOString()
      };
    }
  });

  // ✅ With z.infer, schemas and types are always synchronized
  // No more schema-type mismatches possible!
}

/**
 * Benefits of this approach:
 *
 * 1. ✅ Compile-time type safety between TS interfaces and Zod schemas
 * 2. ✅ IntelliSense and autocompletion in handlers
 * 3. ✅ Prevents schema-interface mismatches
 * 4. ✅ Catches errors before runtime
 * 5. ✅ Self-documenting code through types
 * 6. ✅ Refactoring safety - changes to interfaces are reflected in schemas
 * 7. ✅ Team collaboration - clear contracts between API and implementation
 * 8. ✅ Better performance with Zod's efficient validation
 * 9. ✅ Native TypeScript support without additional dependencies
 */

export default demonstrateTypeSafeRoutes;
