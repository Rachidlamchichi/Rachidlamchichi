import request from 'supertest';
import { app } from '../src/index';
import { mockQuery } from '../src/test-setup';

describe('Listing Routes', () => {
  const testUserId = 'a1b2c3d4-e5f6-7890-1234-567890abcdef';
  const testCategoryId = 'c1d2e3f4-a5b6-7890-1234-567890uvwxyz';
  const testCategory = { id: testCategoryId, name: 'Test Category', created_at: new Date().toISOString() };

  beforeEach(() => {
    mockQuery.mockReset();
    // Default behavior: successful query, returns empty array or no rows.
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  describe('POST /listings', () => {
    const listingData = {
      title: 'Test Listing Item',
      description: 'A great item for testing purposes.',
      price: 99.99,
      categoryId: testCategoryId,
      userId: testUserId,
    };
    const dbListing = {
      id: 'l1s2t3n4-g5h6-7890-1234-567890abcdef',
      ...listingData,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('should create a new listing successfully', async () => {
      // Mock category check
      mockQuery.mockResolvedValueOnce({ rows: [testCategory], rowCount: 1 });
      // Mock listing insert
      mockQuery.mockResolvedValueOnce({ rows: [dbListing], rowCount: 1 });

      const response = await request(app)
        .post('/listings')
        .send(listingData);

      expect(response.status).toBe(201);
      // Match field names to what the controller returns (e.g. userId, categoryId, createdAt, updatedAt)
      const expectedResponse = {
          ...dbListing,
          userId: dbListing.userId,
          categoryId: dbListing.categoryId,
          createdAt: dbListing.createdAt,
          updatedAt: dbListing.updatedAt
      };
      expect(response.body).toEqual(expectedResponse);

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT id FROM categories WHERE id = $1',
        [listingData.categoryId]
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO listings'), // Check if INSERT query was called
        [listingData.title, listingData.description, listingData.price, listingData.categoryId, listingData.userId]
      );
    });

    it('should return 400 if title is missing', async () => {
      const { title, ...incompleteData } = listingData;
      const response = await request(app)
        .post('/listings')
        .send(incompleteData);
      expect(response.status).toBe(400);
      expect(response.body.message).toContain('"title" is required');
    });

    it('should return 400 if price is negative', async () => {
      const response = await request(app)
        .post('/listings')
        .send({ ...listingData, price: -10 });
      expect(response.status).toBe(400);
      expect(response.body.message).toContain('"price" must be greater than or equal to 0');
    });

    it('should return 400 if categoryId is not found', async () => {
      // Mock category check (category not found)
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const response = await request(app)
        .post('/listings')
        .send(listingData);
      expect(response.status).toBe(400);
      expect(response.body.message).toContain(`Category with id ${listingData.categoryId} not found.`);
    });

    it('should return 500 if database query fails during category check', async () => {
        mockQuery.mockRejectedValueOnce(new Error('DB error checking category'));
        const response = await request(app)
            .post('/listings')
            .send(listingData);
        expect(response.status).toBe(500);
    });

    it('should return 500 if database query fails during listing insert', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [testCategory], rowCount: 1 }); // Category check passes
        mockQuery.mockRejectedValueOnce(new Error('DB error inserting listing')); // Insert fails
        const response = await request(app)
            .post('/listings')
            .send(listingData);
        expect(response.status).toBe(500);
    });
  });

  describe('GET /listings/:id', () => {
    const listingId = 'l1s2t3n4-g5h6-7890-1234-567890abcdef';
    const dbListing = {
      id: listingId,
      title: 'Test Listing',
      description: 'Test Desc',
      price: 123.45,
      userId: testUserId,
      categoryId: testCategoryId,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
     const expectedDbListing = {
      ...dbListing,
      userId: dbListing.userId,
      categoryId: dbListing.categoryId,
      createdAt: dbListing.createdAt,
      updatedAt: dbListing.updatedAt
    };


    it('should return a listing successfully', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [dbListing], rowCount: 1 });
      const response = await request(app).get(`/listings/${listingId}`);
      expect(response.status).toBe(200);
      expect(response.body).toEqual(expectedDbListing);
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('SELECT id, title'), [listingId]);
    });

    it('should return 404 if listing not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // No listing found
      const response = await request(app).get(`/listings/${listingId}`);
      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Listing not found');
    });

    // The controller has a Joi validation for UUID format, but it's flawed.
    // This test might pass due to the mock or fail if Joi actually blocks it.
    // The Joi validation in controller: !Joi.string().uuid().validate(id).error === undefined && Joi.string().uuid().validate(id).error !== null
    // This condition is likely always false. A simpler Joi.string().uuid().validate(id).error check is needed.
    // For now, we assume the DB handles most invalid ID formats if Joi doesn't catch it.
    it('should return 400 for invalid listing ID format', async () => {
        const response = await request(app).get('/listings/invalid-uuid');
        // With the corrected Joi validation in the controller, this should now be a 400
        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Invalid listing ID format.');
    });


    it('should return 500 if database query fails', async () => {
        mockQuery.mockRejectedValueOnce(new Error('DB error'));
        const response = await request(app).get(`/listings/${listingId}`);
        expect(response.status).toBe(500);
    });
  });

  describe('GET /listings', () => {
    const dbListings = [
      { id: 'l1', title: 'L1', price: 10, userId: testUserId, categoryId: testCategoryId, status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'l2', title: 'L2', price: 20, userId: testUserId, categoryId: testCategoryId, status: 'sold', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ];
    const expectedDbListings = dbListings.map(l => ({
        ...l,
        userId: l.userId,
        categoryId: l.categoryId,
        createdAt: l.createdAt,
        updatedAt: l.updatedAt
    }));


    it('should return listings with default pagination', async () => {
      mockQuery.mockResolvedValueOnce({ rows: dbListings, rowCount: dbListings.length });
      const response = await request(app).get('/listings');
      expect(response.status).toBe(200);
      expect(response.body).toEqual(expectedDbListings);
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('SELECT id, title'), [10, 0]); // Default limit 10, offset 0
    });

    it('should return listings with custom limit and offset', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [dbListings[0]], rowCount: 1 });
      const response = await request(app).get('/listings?limit=5&offset=1');
      expect(response.status).toBe(200);
      // Assuming the mock is set up to return one specific item for this limit/offset
      expect(response.body).toEqual([expectedDbListings[0]]);
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('SELECT id, title'), [5, 1]);
    });

    it('should return 400 for invalid limit parameter', async () => {
      const response = await request(app).get('/listings?limit=abc');
      expect(response.status).toBe(400);
      expect(response.body.message).toContain('"limit" must be a number');
    });

    it('should return 400 for invalid offset parameter', async () => {
      const response = await request(app).get('/listings?offset=xyz');
      expect(response.status).toBe(400);
      expect(response.body.message).toContain('"offset" must be a number');
    });

    it('should return 500 if database query fails', async () => {
        mockQuery.mockRejectedValueOnce(new Error('DB error'));
        const response = await request(app).get('/listings');
        expect(response.status).toBe(500);
    });
  });
});
