# Type-Safe Restana App with Zod Validation

[![NPM Version](https://img.shields.io/npm/v/typed-restana-app.svg)](https://www.npmjs.com/package/typed-restana-app)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Zod](https://img.shields.io/badge/Zod-3.22-green.svg)](https://zod.dev/)
[![Restana](https://img.shields.io/badge/Restana-4.9-orange.svg)](https://github.com/jkyberneees/restana)

A complete type-safe REST API framework built on **Restana** with **Zod** validation and automatic **OpenAPI** generation. This package provides compile-time type safety between TypeScript interfaces and validation schemas, preventing runtime errors and ensuring API consistency.

## ✨ Features

- 🛡️ **Compile-time Type Safety**: TypeScript interfaces are enforced at the schema level
- ⚡ **High Performance**: Built on Restana (fastest Node.js web framework)
- 🔍 **Zod Validation**: Modern, TypeScript-first schema validation with configurable strictness
- 📚 **Automatic OpenAPI Generation**: Generate documentation from your schemas
- 🎯 **IntelliSense Support**: Full autocompletion and type checking in handlers
- 🔒 **Runtime Safety**: Comprehensive request/response validation
- 🎨 **Developer Experience**: Clear error messages and intuitive API
- ⚙️ **Configurable Strictness**: Environment-based and per-route validation control

## 🚀 Quick Start

### Installation

```bash
pnpm add typed-restana-app restana zod
# or
npm install typed-restana-app restana zod
# or
yarn add typed-restana-app restana zod
```

### Basic Usage

```typescript
import restana from 'restana';
import { z } from 'zod';
import { createTypedApp } from 'typed-restana-app';

// 1. Define Zod schemas first (single source of truth)
const UserQuerySchema = z.object({
  name: z.string().optional(),
  age: z.coerce.number().int().min(0).optional()
});

const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email()
});

// 2. Infer TypeScript types from schemas
type UserQuery = z.infer<typeof UserQuerySchema>;
type User = z.infer<typeof UserSchema>;

// 3. Create Restana service
const service = restana();

// 4. Create typed app with optional configuration
const app = createTypedApp(service, {
  strict: process.env.NODE_ENV === 'development',
  validateResponses: true,
  logValidationErrors: true
});

// 5. Define type-safe routes
app.get<UserQuery, never, User[]>('/users', {
  schema: {
    query: UserQuerySchema,
    responses: {
      200: {
        schema: z.array(UserSchema),
        description: 'List of users'
      }
    }
  },
  metadata: {
    summary: 'Get users',
    description: 'Retrieve a list of users with optional filtering',
    tags: ['Users']
  },
  handler: async ({ query }) => {
    // ✅ query is fully typed as UserQuery with IntelliSense
    const { name, age } = query;
    
    // Your business logic here...
    return mockUsers.filter(user => 
      (!name || user.name.includes(name)) &&
      (!age || user.age === age)
    );
  }
});
```

### Defining Schemas and Inferring Types

The recommended approach is **schema-first development** where Zod schemas are the single source of truth:

```typescript
// ✅ RECOMMENDED: Schema-first approach
// 1. Define schema
const UserSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  age: z.number().int().min(0)
});

// 2. Infer TypeScript type from schema
type User = z.infer<typeof UserSchema>;
```

This approach ensures your schemas and types are always synchronized and eliminates the possibility of schema-type mismatches.

## 🔧 Configuration

### Global Configuration

Configure validation behavior when creating the typed app:

```typescript
const app = createTypedApp(service, {
  // Reject extra fields in request bodies (default: true in development)
  strict: process.env.NODE_ENV === 'development',
  
  // Validate response schemas against expected types (default: true in development)
  validateResponses: process.env.NODE_ENV === 'development',
  
  // Log validation errors to console (default: true)
  logValidationErrors: true
});
```

### Environment-Based Defaults

Without explicit configuration, the framework uses smart defaults:

```typescript
// Development: strict validation, response validation enabled
// Production: flexible validation, response validation disabled
const app = createTypedApp(service); // Uses NODE_ENV defaults
```

### Per-Route Configuration

Override global settings for specific routes:

```typescript
// Route with flexible validation (allows extra fields)
app.post('/users/flexible', {
  schema: { body: UserSchema },
  strict: false,           // Override global strict setting
  validateResponse: false, // Override global response validation
  handler: async ({ body }) => {
    // Extra fields in body are ignored
    return createdUser;
  }
});

// Route with strict validation (rejects extra fields)
app.post('/users/strict', {
  schema: { body: UserSchema.strict() }, // Zod built-in strict mode
  strict: true,            // Explicit strict mode
  validateResponse: true,  // Validate response in this route
  handler: async ({ body }) => {
    // Extra fields in body will cause validation error
    return createdUser;
  }
});
```

### Schema-Level Strictness

Use Zod's built-in strict mode for individual schemas:

```typescript
// Strict schema (rejects extra fields)
const StrictUserSchema = UserSchema.strict();

// Flexible schema (allows extra fields) - default behavior
const FlexibleUserSchema = UserSchema;

app.post('/users', {
  schema: { body: StrictUserSchema },
  handler: async ({ body }) => {
    // Only exact schema fields allowed
    return createdUser;
  }
});
```

## 🎯 Strictness Examples

### Flexible Validation (Default TypeScript Behavior)

```typescript
// ✅ This works - extra fields are ignored
curl -X POST "/users/flexible" \
  -H "Content-Type: application/json" \
  -d '{"name":"John","email":"john@example.com","extraField":"ignored"}'
```

### Strict Validation

```typescript
// ❌ This fails - extra fields are rejected
curl -X POST "/users/strict" \
  -H "Content-Type: application/json" \
  -d '{"name":"John","email":"john@example.com","extraField":"rejected"}'

// Response:
{
  "error": "Validation Error",
  "message": "Validation failed for body",
  "details": [
    {
      "path": "extraField",
      "message": "Unrecognized key(s) in object: 'extraField'",
      "value": {...}
    }
  ]
}
```

### Response Validation

```typescript
app.get('/users/:id', {
  schema: {
    params: z.object({ id: z.string() }),
    responses: {
      200: { schema: UserSchema.strict() }
    }
  },
  validateResponse: true, // Enable response validation
  handler: async ({ params }) => {
    return {
      id: params.id,
      name: 'John',
      email: 'john@example.com',
      // extraField: 'this would fail validation in development'
    };
  }
});
```

## 🔧 Advanced Usage

### Custom Validation

```typescript
const CreateUserRequestSchema = z.object({
  email: z.string().email(),
  age: z.number().int().min(18).max(120),
  name: z.string().min(2).max(100)
}).refine(
  (data) => data.name !== 'admin',
  { message: "Name cannot be 'admin'" }
);

type CreateUserRequest = z.infer<typeof CreateUserRequestSchema>;
```

### Error Handling

```typescript
app.post('/users', {
  schema: { body: userSchema },
  handler: async ({ body, res }) => {
    try {
      // Business logic here
      return createdUser;
    } catch (error) {
      res.send(
        JSON.stringify({ error: 'Internal server error' }),
        500,
        { 'Content-Type': 'application/json' }
      );
      return {} as User; // Won't be sent due to early return
    }
  }
});
```

### OpenAPI Generation

```bash
# Generate OpenAPI specification
pnpm run generate-openapi

# The generated spec will be in typed-restana-app/docs/openapi.json
```

### Custom Middleware

```typescript
// Add custom middleware before creating typed app
service.use(cors());
service.use(helmet());
service.use(customAuthMiddleware);

const app = createTypedApp(service, {
  strict: true,
  validateResponses: true
});
```

### Route Configuration

All routes support comprehensive metadata for OpenAPI generation:

```typescript
app.get<UserListQuery, never, UserListResponse>('/users', {
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
      }
    }
  },
  metadata: {
    summary: 'List users with filtering',
    description: 'Retrieve a paginated list of users with optional filtering',
    tags: ['Users'],
    operationId: 'getUserList'
  },
  strict: false,           // Per-route strictness
  validateResponse: true,  // Per-route response validation
  handler: async ({ query }) => {
    // Fully typed implementation
    return {
      users: filteredUsers,
      total: totalCount,
      page: query.page || 1,
      limit: query.limit || 10
    };
  }
});
```

### Validation Examples

```typescript
// Query parameters with coercion
const UserQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().min(1).optional(),
  isActive: z.coerce.boolean().optional()
});
type UserQuery = z.infer<typeof UserQuerySchema>;

// Complex validation with refinements
const CreateUserRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  confirmPassword: z.string()
}).refine(
  (data) => data.password === data.confirmPassword,
  { message: "Passwords must match", path: ["confirmPassword"] }
);
type CreateUserRequest = z.infer<typeof CreateUserRequestSchema>;
```

## 🛠️ Development

```bash
# Install dependencies
pnpm install

# Start development server with strictness demo
pnpm run dev

# Run type checking
pnpm run type-check

# Build the project
pnpm run build

# Generate OpenAPI documentation
pnpm run generate-openapi

# Run tests
pnpm test
```

## 📊 Testing Strictness

The development server includes dedicated endpoints for testing strictness behavior:

```bash
# Test flexible validation (allows extra fields)
curl -X POST "http://localhost:3000/users/flexible" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@example.com","extra":"allowed"}'

# Test strict validation (rejects extra fields)
curl -X POST "http://localhost:3000/users/strict" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@example.com","extra":"rejected"}'

# Test response validation
curl "http://localhost:3000/users/response-validation/invalid"
```

## 📋 Complete Example

The `examples/` directory contains:
- **POC Endpoints** (`zod-poc-endpoints.ts`) - Full CRUD with validation
- **Type Safety Demo** (`type-safety-demo.ts`) - Type inference examples  
- **Strictness Demo** (`strictness-demo.ts`) - Configuration examples
- **Simple Usage** (`simple-usage.ts`) - Minimal setup example

### Example Features Demonstrated

- User creation with partial validation
- User updates with partial validation
- User deletion with proper error handling
- Query parameter validation with coercion
- Response schema validation
- Environment-based configuration
- Per-route strictness overrides

### Complete Server Setup

```typescript
import restana from 'restana';
import { createTypedApp } from 'typed-restana-app';

const service = restana();
const app = createTypedApp(service, {
  strict: process.env.NODE_ENV === 'development',
  validateResponses: process.env.NODE_ENV === 'development',
  logValidationErrors: true
});

// Register routes
registerPocEndpoints(app);
demonstrateStrictnessFeatures(app);

// Start server
service.start(3000).then(() => {
  console.log('🚀 Server running on http://localhost:3000');
  console.log('📚 Docs available at http://localhost:3000/api/docs');
});
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Restana](https://github.com/jkyberneees/restana) - High-performance web framework
- [Zod](https://zod.dev) - TypeScript-first schema validation
- [TypeScript](https://www.typescriptlang.org) - Type safety and developer experience