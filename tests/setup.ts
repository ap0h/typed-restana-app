// Test setup file
// Set NODE_ENV to development for proper response validation behavior
process.env.NODE_ENV = 'development';

// Increase timeout for async operations
jest.setTimeout(15000);

// Mock console.log in tests to reduce noise
const originalConsoleLog = console.log;
beforeAll(() => {
  console.log = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
});