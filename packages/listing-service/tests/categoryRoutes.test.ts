import request from 'supertest';
import { app } from '../src/index'; // Import the exported app
import { mockQuery } from '../src/test-setup'; // Import the mockQuery

describe('Category Routes', () => {
  beforeEach(() => {
    mockQuery.mockReset();
    // Default: successful query returning no rows or an empty array
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  describe('POST /categories', () => {
    it('should create a new category successfully', async () => {
      const categoryData = { name: 'Electronics' };
      const dbCategory = { id: 'uuid-cat-1', ...categoryData, created_at: new Date().toISOString() };

      // Mock DB query for checking if category exists (not found)
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      // Mock DB query for inserting category
      mockQuery.mockResolvedValueOnce({ rows: [dbCategory], rowCount: 1 });

      const response = await request(app)
        .post('/categories')
        .send(categoryData);

      expect(response.status).toBe(201);
      expect(response.body).toEqual(dbCategory);
      expect(mockQuery).toHaveBeenCalledWith(
        'INSERT INTO categories (name) VALUES ($1) RETURNING id, name, created_at',
        [categoryData.name]
      );
    });

    it('should return 400 if category name is missing', async () => {
      const response = await request(app)
        .post('/categories')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('"name" is required');
    });

    it('should return 400 if category name is too short', async () => {
      const response = await request(app)
        .post('/categories')
        .send({ name: 'El' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('"name" length must be at least 3 characters long');
    });

    it('should return 409 if category name already exists', async () => {
      const categoryData = { name: 'Electronics' };
      // Mock DB query for checking if category exists (found)
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'uuid-cat-existing', name: categoryData.name }], rowCount: 1 });

      const response = await request(app)
        .post('/categories')
        .send(categoryData);

      expect(response.status).toBe(409);
      expect(response.body.message).toBe('Category with this name already exists');
    });

    it('should return 500 if database query fails', async () => {
        mockQuery.mockRejectedValueOnce(new Error('DB error on insert'));
        const categoryData = { name: 'New Category' };
        const response = await request(app)
            .post('/categories')
            .send(categoryData);
        expect(response.status).toBe(500);
        expect(response.body.message).toContain('Internal server error');
    });
  });

  describe('GET /categories', () => {
    it('should return a list of categories', async () => {
      const dbCategories = [
        { id: 'uuid-cat-1', name: 'Electronics', created_at: new Date().toISOString() },
        { id: 'uuid-cat-2', name: 'Books', created_at: new Date().toISOString() },
      ];
      mockQuery.mockResolvedValueOnce({ rows: dbCategories, rowCount: dbCategories.length });

      const response = await request(app).get('/categories');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(dbCategories);
      expect(mockQuery).toHaveBeenCalledWith('SELECT id, name, created_at FROM categories ORDER BY name ASC');
    });

    it('should return an empty list if no categories exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const response = await request(app).get('/categories');
      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('should return 500 if database query fails', async () => {
        mockQuery.mockRejectedValueOnce(new Error('DB error on select'));
        const response = await request(app).get('/categories');
        expect(response.status).toBe(500);
        expect(response.body.message).toContain('Internal server error');
    });
  });
});
