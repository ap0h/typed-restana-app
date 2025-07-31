/**
 * COMPLETE EXAMPLE SERVER
 * 
 * This demonstrates a full Restana server with:
 * - Type-safe Zod validation with optional strictness
 * - OpenAPI documentation generation
 * - Error handling
 * - CORS and security middleware
 */

import restana from 'restana';
import cors from 'cors';
import helmet from 'helmet';
import { createTypedApp } from '../../typed-restana-app/core/typed-app';
import registerPocEndpoints from '../../typed-restana-app/examples/zod-poc-endpoints';
import { demonstrateTypeSafeRoutes } from '../../typed-restana-app/examples/type-safety-demo';
import demonstrateStrictnessFeatures from '../../typed-restana-app/examples/strictness-demo';

const PORT = Number(process.env.PORT) || 3000;

// Create Restana service
const service = restana({
  server: require('http').createServer(),
});

// Add middleware
service.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true
}));

service.use(helmet({
  crossOriginEmbedderPolicy: false
}));

// Parse JSON bodies
service.use((req, res, next) => {
  if (req.headers['content-type']?.includes('application/json')) {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        req.body = body ? JSON.parse(body) : {};
      } catch (error) {
        req.body = {};
      }
      next();
    });
  } else {
    next();
  }
});

service.getRouter

// Create typed app wrapper with enhanced configuration
const app = createTypedApp(service, {
  // 🔧 Configuration based on environment
  strict: process.env.NODE_ENV === 'development',     // Strict in dev, flexible in prod
  validateResponses: process.env.NODE_ENV === 'development',  // Validate responses in dev
  logValidationErrors: true                           // Always log validation errors
});

// Register all POC endpoints
console.log('📝 Registering POC endpoints...');
registerPocEndpoints(app);

// Register demo routes
console.log('📝 Registering demo routes...');
demonstrateTypeSafeRoutes(app);

// Register strictness demonstration
console.log('🔧 Registering strictness demo...');
demonstrateStrictnessFeatures(app);

// Health check endpoint
app.get('/health', {
  metadata: {
    summary: 'Health Check',
    description: 'Simple health check endpoint',
    tags: ['System']
  },
  handler: async () => ({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    configuration: {
      strict: process.env.NODE_ENV === 'development',
      validateResponses: process.env.NODE_ENV === 'development'
    }
  })
});

// Root endpoint with documentation
service.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>🚀 Type-Safe Restana API</title>
        <style>
            body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                max-width: 1000px; 
                margin: 2rem auto; 
                padding: 2rem; 
                line-height: 1.6; 
            }
            .endpoint { 
                background: #f5f5f5; 
                padding: 1rem; 
                margin: 0.5rem 0; 
                border-radius: 4px; 
                font-family: monospace; 
            }
            .badge { 
                background: #007acc; 
                color: white; 
                padding: 0.2rem 0.5rem; 
                border-radius: 3px; 
                font-size: 0.8rem; 
                margin-right: 0.5rem; 
            }
            .badge.strict { background: #e74c3c; }
            .badge.flexible { background: #27ae60; }
            .config { 
                background: #fff3cd; 
                border: 1px solid #ffeaa7; 
                padding: 1rem; 
                border-radius: 4px; 
                margin: 1rem 0; 
            }
            .section { margin: 2rem 0; }
        </style>
    </head>
    <body>
        <h1>🚀 Type-Safe Restana API Server</h1>
        
        <div class="config">
            <h3>🔧 Configuration</h3>
            <p><strong>Environment:</strong> ${process.env.NODE_ENV || 'development'}</p>
            <p><strong>Strict Validation:</strong> ${process.env.NODE_ENV === 'development' ? '✅ Enabled' : '❌ Disabled'}</p>
            <p><strong>Response Validation:</strong> ${process.env.NODE_ENV === 'development' ? '✅ Enabled' : '❌ Disabled'}</p>
        </div>
        
        <div class="section">
            <h2>📋 Core API Endpoints</h2>
            
            <div class="endpoint">
                <span class="badge">GET</span>/health - Health Check
            </div>
            
            <div class="endpoint">
                <span class="badge">GET</span>/api/docs - OpenAPI Documentation
            </div>
            
            <div class="endpoint">
                <span class="badge">GET</span>/api/users - List Users (with query filtering)
            </div>
            
            <div class="endpoint">
                <span class="badge">GET</span>/api/users/:id - Get User by ID
            </div>
            
            <div class="endpoint">
                <span class="badge">POST</span>/api/users - Create User
            </div>
            
            <div class="endpoint">
                <span class="badge">PUT</span>/api/users/:id - Update User
            </div>
            
            <div class="endpoint">
                <span class="badge">DELETE</span>/api/users/:id - Delete User
            </div>
        </div>
        
        <div class="section">
            <h2>🔧 Strictness Demo Endpoints</h2>
            
            <div class="endpoint">
                <span class="badge flexible">POST</span>/users/flexible - Flexible validation (allows extra fields)
            </div>
            
            <div class="endpoint">
                <span class="badge strict">POST</span>/users/strict - Strict validation (rejects extra fields)
            </div>
            
            <div class="endpoint">
                <span class="badge">POST</span>/users/per-route-config - Per-route configuration demo
            </div>
            
            <div class="endpoint">
                <span class="badge">GET</span>/users/response-validation/:id - Response validation demo
            </div>
            
            <div class="endpoint">
                <span class="badge">POST</span>/test/strictness - Testing endpoint
            </div>
        </div>
        
        <div class="section">
            <h2>🎯 Example Requests</h2>
            
            <h3>📊 List users with filtering:</h3>
            <div class="endpoint">
                curl "http://localhost:${PORT}/api/users?page=1&limit=5&isActive=true"
            </div>
            
            <h3>👤 Get specific user:</h3>
            <div class="endpoint">
                curl "http://localhost:${PORT}/api/users/550e8400-e29b-41d4-a716-446655440001"
            </div>
            
            <h3>➕ Create new user (flexible):</h3>
            <div class="endpoint">
                curl -X POST "http://localhost:${PORT}/users/flexible" \\<br>
                &nbsp;&nbsp;&nbsp;&nbsp;-H "Content-Type: application/json" \\<br>
                &nbsp;&nbsp;&nbsp;&nbsp;-d '{"name":"Test User","email":"test@example.com","age":25,"extra":"allowed"}'
            </div>
            
            <h3>🔒 Create new user (strict - should fail with extra field):</h3>
            <div class="endpoint">
                curl -X POST "http://localhost:${PORT}/users/strict" \\<br>
                &nbsp;&nbsp;&nbsp;&nbsp;-H "Content-Type: application/json" \\<br>
                &nbsp;&nbsp;&nbsp;&nbsp;-d '{"name":"Test User","email":"test@example.com","age":25,"extra":"rejected"}'
            </div>
            
            <h3>🧪 Test response validation:</h3>
            <div class="endpoint">
                curl "http://localhost:${PORT}/users/response-validation/invalid"
            </div>
        </div>
        
        <div class="section">
            <h2>✨ Features Demonstrated</h2>
            <ul>
                <li>✅ Type-safe Zod validation with configurable strictness</li>
                <li>✅ Global configuration (environment-based defaults)</li>
                <li>✅ Per-route strictness overrides</li>
                <li>✅ Response schema validation in development</li>
                <li>✅ Query parameter validation with coercion</li>
                <li>✅ Request body validation</li>
                <li>✅ Path parameter validation</li>
                <li>✅ Comprehensive error handling with context</li>
                <li>✅ OpenAPI documentation generation</li>
                <li>✅ Full TypeScript IntelliSense</li>
            </ul>
        </div>
        
        <p><strong>📚 <a href="/api/docs">View OpenAPI Documentation</a></strong></p>
    </body>
    </html>
  `, 200, { 'Content-Type': 'text/html' });
});

// OpenAPI documentation endpoint  
service.get('/api/docs', (req, res) => {
  try {
    // Check if OpenAPI spec exists
    require('../../typed-restana-app/docs/openapi.json');
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>API Documentation - Type-Safe Restana</title>
        <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui.css" />
        <style>
          .swagger-ui .topbar { display: none }
        </style>
      </head>
      <body>
        <div id="swagger-ui"></div>
        <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-bundle.js"></script>
        <script>
          window.onload = () => {
            window.ui = SwaggerUIBundle({
              url: '/api/docs/spec',
              dom_id: '#swagger-ui',
              deepLinking: true,
              presets: [
                SwaggerUIBundle.presets.apis,
                SwaggerUIBundle.presets.standalone
              ],
              plugins: [
                SwaggerUIBundle.plugins.DownloadUrl
              ],
              layout: "StandaloneLayout"
            });
          }
        </script>
      </body>
      </html>
    `, 200, { 'Content-Type': 'text/html' });
  } catch (error) {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>API Documentation - Setup Required</title>
        <style>
          body { 
            font-family: system-ui, sans-serif; 
            max-width: 600px; 
            margin: 4rem auto; 
            padding: 2rem;
            text-align: center;
          }
          .error { 
            background: #fff3cd; 
            border: 1px solid #ffeaa7; 
            padding: 2rem; 
            border-radius: 8px; 
            margin: 2rem 0;
          }
          .command { 
            background: #f8f9fa; 
            padding: 1rem; 
            border-radius: 4px; 
            font-family: monospace; 
            margin: 1rem 0;
          }
        </style>
      </head>
      <body>
        <h1>📚 API Documentation</h1>
        <div class="error">
          <h2>⚠️ OpenAPI Specification Not Found</h2>
          <p>The OpenAPI specification needs to be generated first.</p>
          
          <h3>🔧 Generate Documentation:</h3>
          <div class="command">pnpm run generate-openapi</div>
          
          <p>After generation, refresh this page to view the documentation.</p>
        </div>
        <p><a href="/">← Back to Home</a></p>
      </body>
      </html>
    `, 200, { 'Content-Type': 'text/html' });
  }
});

// OpenAPI JSON spec endpoint
service.get('/api/docs/spec', (req, res) => {
  try {
    const openApiSpec = require('../../typed-restana-app/docs/openapi.json');
    res.send(openApiSpec, 200, { 'Content-Type': 'application/json' });
  } catch (error) {
    res.send({
      error: 'OpenAPI specification not found',
      message: 'Run "pnpm run generate-openapi" to generate the specification',
      hint: 'The OpenAPI spec is generated from your route definitions'
    }, 500, { 'Content-Type': 'application/json' });
  }
});

// Start server
async function startServer() {
  try {
    await service.start(PORT);
    
    console.log('🚀 Type-Safe Restana Server Started!');
    console.log(`📍 Server running on: http://localhost:${PORT}`);
    console.log('');
    console.log('📋 Available Endpoints:');
    console.log(`   🏠 Root:           GET  http://localhost:${PORT}/`);
    console.log(`   💚 Health Check:   GET  http://localhost:${PORT}/health`);
    console.log(`   📚 Documentation:  GET  http://localhost:${PORT}/api/docs`);
    console.log('');
    console.log('🔧 Core API:');
    console.log(`   👥 Users API:      GET  http://localhost:${PORT}/api/users`);
    console.log(`   👤 User by ID:     GET  http://localhost:${PORT}/api/users/:id`);
    console.log(`   ➕ Create User:    POST http://localhost:${PORT}/api/users`);
    console.log(`   ✏️  Update User:    PUT  http://localhost:${PORT}/api/users/:id`);
    console.log(`   🗑️  Delete User:    DEL  http://localhost:${PORT}/api/users/:id`);
    console.log('');
    console.log('🎯 Strictness Demo:');
    console.log(`   📝 Flexible:       POST http://localhost:${PORT}/users/flexible`);
    console.log(`   🔒 Strict:         POST http://localhost:${PORT}/users/strict`);
    console.log(`   ⚡ Per-route:      POST http://localhost:${PORT}/users/per-route-config`);
    console.log(`   🧪 Response Val:   GET  http://localhost:${PORT}/users/response-validation/:id`);
    console.log(`   🎯 Testing:        POST http://localhost:${PORT}/test/strictness`);
    console.log('');
    console.log('🎯 Example Requests:');
    console.log('   📊 List users:');
    console.log(`      curl "http://localhost:${PORT}/api/users?page=1&limit=5&isActive=true"`);
    console.log('');
    console.log('   👤 Get user:');
    console.log(`      curl "http://localhost:${PORT}/api/users/550e8400-e29b-41d4-a716-446655440001"`);
    console.log('');
    console.log('   ➕ Create user (flexible):');
    console.log(`      curl -X POST "http://localhost:${PORT}/users/flexible" \\`);
    console.log('           -H "Content-Type: application/json" \\');
    console.log('           -d \'{"name":"Test","email":"test@example.com","age":25,"extra":"allowed"}\'');
    console.log('');
    console.log('   🔒 Create user (strict):');
    console.log(`      curl -X POST "http://localhost:${PORT}/users/strict" \\`);
    console.log('           -H "Content-Type: application/json" \\');
    console.log('           -d \'{"name":"Test","email":"test@example.com","age":25,"extra":"rejected"}\'');
    console.log('');
    console.log('✨ Features Demonstrated:');
    console.log('   ✅ Type-safe Zod validation with configurable strictness');
    console.log('   ✅ Global configuration (environment-based defaults)');
    console.log('   ✅ Per-route strictness overrides');
    console.log('   ✅ Response schema validation in development');
    console.log('   ✅ Query parameter validation with coercion');
    console.log('   ✅ Request body validation');
    console.log('   ✅ Path parameter validation');
    console.log('   ✅ Comprehensive error handling with context');
    console.log('   ✅ OpenAPI documentation generation');
    console.log('   ✅ Full TypeScript IntelliSense');
    console.log('');
    console.log(`📈 Total Routes Registered: ${app.getRoutes().length}`);
    
    // Print route details
    app.getRoutes().forEach(route => {
      console.log(`   ${route.method.padEnd(6)} ${route.path.padEnd(35)} - ${route.metadata?.summary || 'No description'}`);
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('📴 Received SIGTERM, shutting down gracefully');
  try {
    await service.close();
    console.log('✅ Server closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  console.log('📴 Received SIGINT, shutting down gracefully');
  try {
    await service.close();
    console.log('✅ Server closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

// Start the server
startServer().catch(console.error);