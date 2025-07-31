import restana from 'restana';
import { createTypedApp } from '../src/core/typed-app';
import { TypeSafeApp } from '../src/core/schema-types';
import { TypedAppConfig } from '../src/core/typed-app';

/**
 * Creates a TypeSafeApp with common middleware for testing
 */
export function createTestApp(config?: Partial<TypedAppConfig>): TypeSafeApp {
  const restanaApp = restana();
  
  // Add JSON body parsing middleware
  restanaApp.use((req: any, res: any, next: any) => {
    if (req.headers['content-type']?.includes('application/json')) {
      let body = '';
      req.on('data', (chunk: any) => {
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
  
  // Add query string parsing middleware
  restanaApp.use((req: any, res: any, next: any) => {
    const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    req.query = {};
    url.searchParams.forEach((value, key) => {
      req.query[key] = value;
    });
    next();
  });
  
  const defaultConfig: TypedAppConfig = {
    strict: false,
    validateResponses: false,
    logValidationErrors: false,
    ...config
  };
  
  return createTypedApp(restanaApp, defaultConfig);
}

/**
 * Default test configuration
 */
export const defaultTestConfig: TypedAppConfig = {
  strict: false,
  validateResponses: false,
  logValidationErrors: false
};

/**
 * Strict test configuration
 */
export const strictTestConfig: TypedAppConfig = {
  strict: true,
  validateResponses: false,
  logValidationErrors: false
};

/**
 * Response validation test configuration
 */
export const responseValidationConfig: TypedAppConfig = {
  strict: false,
  validateResponses: true,
  logValidationErrors: false
};