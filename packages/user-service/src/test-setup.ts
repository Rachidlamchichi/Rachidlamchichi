// Mock the 'pg' module Pool and its query method
// This will affect all tests that import from '../db'

// Define a type for our mock query function
type MockQuery = jest.Mock<Promise<{ rows: any[]; rowCount: number }>, [string, any[]?]>;

// Create a mock query function
export const mockQuery: MockQuery = jest.fn();

// Mock the Pool constructor and its methods
jest.mock('pg', () => {
  const mPool = {
    query: mockQuery, // Use our mockQuery
    connect: jest.fn().mockResolvedValue({
      release: jest.fn(),
    }),
    on: jest.fn(),
    end: jest.fn(),
  };
  return { Pool: jest.fn(() => mPool) };
});

// Before each test, reset the mock implementations and call history
beforeEach(() => {
  mockQuery.mockReset();
  // Default mock implementation for successful query returning no rows
  mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
});
