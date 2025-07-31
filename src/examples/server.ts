/**
 * COMPLETE EXAMPLE SERVER
 * 
 * This demonstrates a full Restana server with:
 * - Type-safe Zod validation
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

service.use(helmet());

// Add JSON body parsing middleware
service.use((req, res, next) => {
  if (req.headers['content-type'] === 'application/json') {
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
    req.body = {};
    next();
  }
});

// Create typed app wrapper
const app = createTypedApp(service);

// Register all POC endpoints
console.log('📝 Registering POC endpoints...');
registerPocEndpoints(app);

// Register demo routes
console.log('📝 Registering demo routes...');
demonstrateTypeSafeRoutes(app);

// Health check endpoint
service.get('/health', (req, res) => {
  res.send({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  }, 200, { 'Content-Type': 'application/json' });
});

// API documentation endpoint (basic route info)
service.get('/api/docs', (req, res) => {
  const routes = app.getRoutes();
  
  const documentation = {
    title: 'Type-Safe Restana API',
    version: '1.0.0',
    description: 'API built with type-safe Zod validation and automatic OpenAPI generation',
    endpoints: routes.map(route => ({
      method: route.method.toUpperCase(),
      path: route.path,
      summary: route.metadata?.summary || 'No summary provided',
      tags: route.metadata?.tags || []
    }))
  };

  res.send(documentation, 200, { 'Content-Type': 'application/json' });
});

// Root endpoint
service.get('/', (req, res) => {
  res.send({
    message: 'Welcome to Type-Safe Restana API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      docs: '/api/docs',
      users: '/api/users',
      userById: '/api/users/:id'
    },
    documentation: 'Visit /api/docs for complete API documentation'
  }, 200, { 'Content-Type': 'application/json' });
});

// Global error handler
service.use((req, res, next) => {
  if (!res.headersSent) {
    res.send({
      error: 'Not Found',
      message: `Route ${req.method} ${req.url} not found`,
      availableRoutes: app.getRoutes().map(r => `${r.method.toUpperCase()} ${r.path}`)
    }, 404, { 'Content-Type': 'application/json' });
  }
});

// Start server
service.start(PORT).then(() => {
  console.log('🚀 Type-Safe Restana Server Started!');
  console.log(`📍 Server running on: http://localhost:${PORT}`);
  console.log('\n📋 Available Endpoints:');
  console.log(`   🏠 Root:           GET  http://localhost:${PORT}/`);
  console.log(`   💚 Health Check:   GET  http://localhost:${PORT}/health`);
  console.log(`   📚 Documentation:  GET  http://localhost:${PORT}/api/docs`);
  console.log(`   👥 Users API:      GET  http://localhost:${PORT}/api/users`);
  console.log(`   👤 User by ID:     GET  http://localhost:${PORT}/api/users/:id`);
  console.log(`   ➕ Create User:    POST http://localhost:${PORT}/api/users`);
  console.log(`   ✏️  Update User:    PUT  http://localhost:${PORT}/api/users/:id`);
  console.log(`   🗑️  Delete User:    DEL  http://localhost:${PORT}/api/users/:id`);
  
  console.log('\n🎯 Example Requests:');
  console.log('   📊 List users:');
  console.log(`      curl "http://localhost:${PORT}/api/users?page=1&limit=5&isActive=true"`);
  console.log('\n   👤 Get user:');
  console.log(`      curl "http://localhost:${PORT}/api/users/550e8400-e29b-41d4-a716-446655440001"`);
  console.log('\n   ➕ Create user:');
  console.log(`      curl -X POST "http://localhost:${PORT}/api/users" \\`);
  console.log(`           -H "Content-Type: application/json" \\`);
  console.log(`           -d '{"email":"test@example.com","name":"Test User","age":25}'`);

  console.log('\n✨ Features Demonstrated:');
  console.log('   ✅ Type-safe Zod validation');
  console.log('   ✅ Query parameter validation with coercion');
  console.log('   ✅ Request body validation');
  console.log('   ✅ Path parameter validation');
  console.log('   ✅ Response type safety');
  console.log('   ✅ Comprehensive error handling');
  console.log('   ✅ OpenAPI documentation generation');
  console.log('   ✅ Full TypeScript IntelliSense');

  const routes = app.getRoutes();
  console.log(`\n📈 Total Routes Registered: ${routes.length}`);
  routes.forEach(route => {
    console.log(`   ${route.method.toUpperCase().padEnd(6)} ${route.path.padEnd(25)} - ${route.metadata?.summary || 'No summary'}`);
  });
}).catch(err => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('📴 Received SIGTERM, shutting down gracefully');
  service.close();
  console.log('✅ Server closed');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n📴 Received SIGINT, shutting down gracefully');
  service.close();
  console.log('✅ Server closed');
  process.exit(0);
});

export default service;