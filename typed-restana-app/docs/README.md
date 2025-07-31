# Promo API Documentation System

This directory contains the OpenAPI documentation system for the Promo API module. The system is designed to generate comprehensive API documentation from Joi validation schemas without interfering with existing validation logic.

## Overview

The documentation system consists of:
- **Schemas** (`../schemas/`): Joi validation schemas used for both validation and documentation
- **Middleware** (`../middleware/docs.middleware.ts`): Documentation-only middleware that registers route metadata
- **Generation Script** (`../scripts/generate-openapi.ts`): Generates OpenAPI spec from registered routes

## Features

✅ **Single Source of Truth**: Uses existing Joi schemas for both validation and documentation  
✅ **Non-Intrusive**: Documentation middleware doesn't affect validation or business logic  
✅ **Type-Safe**: Full TypeScript support with proper type inference  
✅ **Automatic Generation**: Command-line script to generate OpenAPI specs  
✅ **Extensible**: Easy to add documentation for new modules and endpoints  

## Usage

### 1. Generate OpenAPI Documentation

```bash
# Generate OpenAPI specification file
pnpm run promo:generate-docs
```

This creates `openapi.json` with complete API documentation.

### 2. View Documentation

The generated OpenAPI spec can be:
- Imported into Swagger UI or other OpenAPI tools
- Used to generate client SDKs
- Served via the API endpoint: `GET /v1/openapi.json`

### 3. Access Live Documentation

When the server is running, access the OpenAPI spec at:
```
GET http://localhost:3000/v1/openapi.json
```

## Adding Documentation to New Routes

### Step 1: Create Schemas

Create validation schemas in `../schemas/your-module.schemas.ts`:

```typescript
import JoiExtended from '../../../libs/shared/common/utils/joiExtended.util';
import { CommonSchemas } from './shared.schemas';

export const YourModuleSchemas = {
  listQuery: JoiExtended.object({
    ...CommonSchemas.pagination,
    // Add your specific query parameters
  }),
  
  response: JoiExtended.object({
    // Define your response structure
  }),
  
  responses: {
    400: CommonSchemas.errorResponse,
    404: CommonSchemas.errorResponse,
    500: CommonSchemas.errorResponse
  }
};
```

### Step 2: Add Documentation to Routes

In your routes file:

```typescript
import { createDocs, createDocumentation } from '../../middleware/docs.middleware';
import { YourModuleSchemas } from '../../schemas/your-module.schemas';

export function registerYourModuleRoutes(app: Service<Protocol.HTTP>) {
  app.get(
    '/v1/promo/your-endpoint',
    createDocs.get('/v1/promo/your-endpoint', 
      createDocumentation()
        .summary('Your endpoint summary')
        .description('Detailed description of what this endpoint does')
        .tags('YourModule')
        .operationId('getYourData')
        .query(YourModuleSchemas.listQuery)
        .responses({
          '200': YourModuleSchemas.response,
          '400': YourModuleSchemas.responses[400]
        })
        .build()
    ),
    yourController.yourMethod
  );
}
```

### Step 3: Register in Generation Script

Add your route registration to `../scripts/generate-openapi.ts`:

```typescript
import { registerYourModuleRoutes } from '../modules/your-module/your-module.routes';

// In the route registration section:
registerYourModuleRoutes(mockApp);
```

## Schema Organization

### Shared Schemas (`shared.schemas.ts`)
Common schemas used across multiple modules:
- Pagination parameters
- Error responses
- Common field types

### Module-Specific Schemas (`{module}.schemas.ts`)
Schemas specific to each module:
- Request/response definitions
- Query parameters
- Path parameters

## Best Practices

1. **Descriptive Documentation**: Always include meaningful summaries and descriptions
2. **Consistent Error Responses**: Use shared error response schemas
3. **Proper HTTP Status Codes**: Document all possible response codes
4. **Tag Organization**: Use consistent tags for grouping related endpoints
5. **Schema Reuse**: Leverage shared schemas to maintain consistency

## Validation vs Documentation

The system is designed to use the same schemas for both validation and documentation:

- **For Validation**: Use schemas from `{Module}ValidationSchemas` in controllers
- **For Documentation**: Use schemas from `{Module}Schemas` in route definitions

This ensures that documentation always matches the actual validation rules.

## Files Structure

```
src/apps/promo/
├── docs/
│   ├── README.md           # This file
│   └── openapi.json       # Generated OpenAPI spec
├── middleware/
│   └── docs.middleware.ts  # Documentation middleware
├── schemas/
│   ├── index.ts           # Schema exports
│   ├── shared.schemas.ts  # Common schemas
│   └── dapps.schemas.ts   # Module-specific schemas
└── scripts/
    └── generate-openapi.ts # Generation script
```

## Generated OpenAPI Features

The generated OpenAPI specification includes:
- Complete parameter definitions with validation rules
- Request/response body schemas
- Error response documentation
- Operation metadata (tags, summaries, descriptions)
- Server configuration
- Contact and license information

## Troubleshooting

### No Routes Documented
Ensure route registration functions are called in the generation script.

### Schema Validation Errors
Check that all Joi schemas are valid and don't use unsupported features like `link()`.

### TypeScript Errors
Make sure all imports are correct and schemas are properly exported.

---

This documentation system provides a scalable, maintainable way to keep API documentation in sync with your actual implementation.