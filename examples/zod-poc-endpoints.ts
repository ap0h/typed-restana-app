/**
 * PROOF OF CONCEPT: Complete Zod-Based API Endpoints
 *
 * This file demonstrates comprehensive API endpoints with:
 * - Query parameter validation
 * - Request body validation
 * - Path parameter validation
 * - Response validation
 * - OpenAPI generation
 */

import { z } from 'zod';
import { TypeSafeApp } from '../src/core/schema-types';

// =============================================================================
// User Management API - POC Endpoints
// =============================================================================

// First define Zod schemas, then infer TypeScript types from them

// =============================================================================
// Zod Schema Definitions (Single Source of Truth)
// =============================================================================

// Base User Schema
const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  age: z.number().int().min(0).max(150).optional(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

// Query Parameters Schema
const UserListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10).optional(),
  search: z.string().min(1).optional(),
  isActive: z.coerce.boolean().optional(),
  minAge: z.coerce.number().int().min(0).max(150).optional(),
  maxAge: z.coerce.number().int().min(0).max(150).optional(),
}).refine(
  (data) => !data.minAge || !data.maxAge || data.minAge <= data.maxAge,
  {
    message: "minAge must be less than or equal to maxAge",
    path: ["minAge"],
  }
);

// Path Parameters Schema
const UserParamsSchema = z.object({
  id: z.string().uuid("Invalid user ID format")
});

// Request Body Schemas
const CreateUserRequestSchema = z.object({
  email: z.string().email("Invalid email format"),
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  age: z.number().int().min(0).max(150).optional()
});

const UpdateUserRequestSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  age: z.number().int().min(0).max(150).optional(),
  isActive: z.boolean().optional()
}).refine(
  (data) => Object.keys(data).length > 0,
  {
    message: "At least one field must be provided for update",
  }
);

// Response Schemas
const UserListResponseSchema = z.object({
  users: z.array(UserSchema),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  limit: z.number().int().min(1),
  hasMore: z.boolean()
});

const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  details: z.array(z.object({
    field: z.string(),
    message: z.string()
  })).optional()
});

const DeleteResponseSchema = z.object({
  message: z.string()
});

// =============================================================================
// Infer TypeScript Types from Zod Schemas
// =============================================================================

type User = z.infer<typeof UserSchema>;
type UserListQuery = z.infer<typeof UserListQuerySchema>;
type UserParams = z.infer<typeof UserParamsSchema>;
type CreateUserRequest = z.infer<typeof CreateUserRequestSchema>;
type UpdateUserRequest = z.infer<typeof UpdateUserRequestSchema>;
type UserListResponse = z.infer<typeof UserListResponseSchema>;
type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
type DeleteResponse = z.infer<typeof DeleteResponseSchema>;

// =============================================================================
// Mock Database (for POC demonstration)
// =============================================================================

const mockUsers: User[] = [
  {
    id: "550e8400-e29b-41d4-a716-446655440001",
    email: "john.doe@example.com",
    name: "John Doe",
    age: 30,
    isActive: true,
    createdAt: "2024-01-01T10:00:00Z",
    updatedAt: "2024-01-01T10:00:00Z"
  },
  {
    id: "550e8400-e29b-41d4-a716-446655440002",
    email: "jane.smith@example.com",
    name: "Jane Smith",
    age: 25,
    isActive: true,
    createdAt: "2024-01-02T10:00:00Z",
    updatedAt: "2024-01-02T10:00:00Z"
  },
  {
    id: "550e8400-e29b-41d4-a716-446655440003",
    email: "bob.wilson@example.com",
    name: "Bob Wilson",
    isActive: false,
    createdAt: "2024-01-03T10:00:00Z",
    updatedAt: "2024-01-03T10:00:00Z"
  }
];

// =============================================================================
// Type-Safe Route Definitions
// =============================================================================

export function registerPocEndpoints(app: TypeSafeApp) {
  
  // GET /users - List users with comprehensive query filtering
  app.get<UserListQuery, unknown, UserListResponse>('/api/users', {
    schema: {
      query: UserListQuerySchema,
      responses: {
        200: {
          schema: UserListResponseSchema,
          description: 'List of users retrieved successfully'
        },
        400: {
          schema: ErrorResponseSchema,
          description: 'Bad Request - Invalid query parameters'
        },
        500: {
          schema: ErrorResponseSchema,
          description: 'Internal Server Error'
        }
      }
    },
    metadata: {
      summary: 'List users with filtering',
      description: 'Retrieve a paginated list of users with optional filtering by name, age, and activity status',
      tags: ['Users'],
      operationId: 'getUserList'
    },
    handler: async ({ query }) => {                
      // ✅ query is fully typed as UserListQuery with IntelliSense
      const { 
        page = 1, 
        limit = 10, 
        search, 
        isActive, 
        minAge, 
        maxAge 
      } = query;

      let filteredUsers = [...mockUsers];

      // Apply filters
      if (search) {
        filteredUsers = filteredUsers.filter(user => 
          user.name.toLowerCase().includes(search.toLowerCase()) ||
          user.email.toLowerCase().includes(search.toLowerCase())
        );
      }

      if (isActive !== undefined) {
        filteredUsers = filteredUsers.filter(user => user.isActive === isActive);
      }

      if (minAge !== undefined) {
        filteredUsers = filteredUsers.filter(user => user.age && user.age >= minAge);
      }

      if (maxAge !== undefined) {
        filteredUsers = filteredUsers.filter(user => user.age && user.age <= maxAge);
      }

      // Apply pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

      return {
        a: 1,
        users: paginatedUsers,
        total: filteredUsers.length,
        page,
        limit,
        hasMore: endIndex < filteredUsers.length
      };
    }
  });

  // GET /users/:id - Get user by ID
  app.get<unknown, UserParams, User>('/api/users/:id', {
    schema: {
      params: UserParamsSchema,
      responses: {
        200: {
          schema: UserSchema,
          description: 'User retrieved successfully'
        },
        404: {
          schema: ErrorResponseSchema,
          description: 'User not found'
        },
        400: {
          schema: ErrorResponseSchema,
          description: 'Invalid user ID format'
        }
      }
    },
    metadata: {
      summary: 'Get user by ID',
      description: 'Retrieve detailed information about a specific user',
      tags: ['Users'],
      operationId: 'getUserById'
    },
    handler: async ({ params, res }) => {
      // ✅ params is fully typed as UserParams with IntelliSense
      const user = mockUsers.find(u => u.id === params.id);      
      
      if (!user) {
        res.send(JSON.stringify({
          error: "Not Found",
          message: `User with ID ${params.id} not found`
        }), 404, { 'Content-Type': 'application/json' });
        return {} as User; // This won't be sent due to early return
      }

      return user;
    }
  });

  // POST /users - Create new user
  app.post<never, never, CreateUserRequest, User>('/api/users', {
    schema: {
      body: CreateUserRequestSchema,
      responses: {
        201: {
          schema: UserSchema,
          description: 'User created successfully'
        },
        400: {
          schema: ErrorResponseSchema,
          description: 'Invalid request body'
        },
        409: {
          schema: ErrorResponseSchema,
          description: 'User with this email already exists'
        }
      }
    },
    metadata: {
      summary: 'Create new user',
      description: 'Create a new user account with email, name, and optional age',
      tags: ['Users'],
      operationId: 'createUser'
    },
    handler: async ({ body, res }: { body: CreateUserRequest; res: any }) => {
      // ✅ body is fully typed as CreateUserRequest with IntelliSense
      
      // Check if user with email already exists
      const existingUser = mockUsers.find(u => u.email === body.email);
      if (existingUser) {
        res.send(JSON.stringify({
          error: "Conflict",
          message: `User with email ${body.email} already exists`
        }), 409, { 'Content-Type': 'application/json' });
        return {} as User; // This won't be sent due to early return
      }

      const newUser: User = {
        id: `550e8400-e29b-41d4-a716-${Math.random().toString().substr(2, 12)}`,
        email: body.email,
        name: body.name,
        age: body.age,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      mockUsers.push(newUser);

      // Set status code to 201 for creation
      res.send(JSON.stringify(newUser), 201, { 'Content-Type': 'application/json' });
      return {} as User; // This won't be sent due to early return
    }
  });

  // PUT /users/:id - Update user
  app.put<never, UserParams, UpdateUserRequest, User>('/api/users/:id', {
    schema: {
      params: UserParamsSchema,
      body: UpdateUserRequestSchema,
      responses: {
        200: {
          schema: UserSchema,
          description: 'User updated successfully'
        },
        404: {
          schema: ErrorResponseSchema,
          description: 'User not found'
        },
        400: {
          schema: ErrorResponseSchema,
          description: 'Invalid request'
        }
      }
    },
    metadata: {
      summary: 'Update user',
      description: 'Update user information by ID',
      tags: ['Users'],
      operationId: 'updateUser'
    },
    handler: async ({ params, body, res }: { params: UserParams; body: UpdateUserRequest; res: any }) => {
      // ✅ params is typed as UserParams, body as UpdateUserRequest
      const userIndex = mockUsers.findIndex(u => u.id === params.id);
      
      if (userIndex === -1) {
        res.send(JSON.stringify({
          error: "Not Found",
          message: `User with ID ${params.id} not found`
        }), 404, { 'Content-Type': 'application/json' });
        return {} as User;
      }

      const user = mockUsers[userIndex];
      const updatedUser: User = {
        ...user,
        ...body,
        updatedAt: new Date().toISOString()
      };

      mockUsers[userIndex] = updatedUser;
      return updatedUser;
    }
  });

  // DELETE /users/:id - Delete user
  app.delete<unknown, UserParams, DeleteResponse>('/api/users/:id', {
    schema: {
      params: UserParamsSchema,
      responses: {
        200: {
          schema: DeleteResponseSchema,
          description: 'User deleted successfully'
        },
        404: {
          schema: ErrorResponseSchema,
          description: 'User not found'
        }
      }
    },
    metadata: {
      summary: 'Delete user',
      description: 'Delete a user by ID',
      tags: ['Users'],
      operationId: 'deleteUser'
    },
    handler: async ({ params, res }: { params: UserParams; res: any }) => {
      const userIndex = mockUsers.findIndex(u => u.id === params.id);
      
      if (userIndex === -1) {
        res.send(JSON.stringify({
          error: "Not Found",
          message: `User with ID ${params.id} not found`
        }), 404, { 'Content-Type': 'application/json' });
        return { message: '' }; // This won't be sent due to early return
      }

      mockUsers.splice(userIndex, 1);
      return { message: `User with ID ${params.id} deleted successfully` };
    }
  });
}

export default registerPocEndpoints;