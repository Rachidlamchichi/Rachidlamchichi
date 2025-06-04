import { Request, Response } from 'express';
import Joi from 'joi';
import pool from '../db';

// Joi schema for creating a listing (matches openapi.yaml)
const createListingSchema = Joi.object({
  title: Joi.string().min(5).max(100).required(),
  description: Joi.string().max(4000).allow(null, ''), // Allow null or empty string
  price: Joi.number().min(0).required(),
  categoryId: Joi.string().uuid().required(),
  userId: Joi.string().uuid().required(), // Will be from auth later
});

// Joi schema for pagination query parameters
const getListingsSchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(10),
  offset: Joi.number().integer().min(0).default(0),
  // TODO: Add filters like categoryId, userId, status, price_min, price_max etc.
});

export const createListing = async (req: Request, res: Response) => {
  try {
    const { error, value } = createListingSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ statusCode: 400, message: error.details[0].message });
    }
    const { title, description, price, categoryId, userId } = value;

    // Check if category exists
    const categoryExists = await pool.query('SELECT id FROM categories WHERE id = $1', [categoryId]);
    if (categoryExists.rows.length === 0) {
      return res.status(400).json({ statusCode: 400, message: `Category with id ${categoryId} not found.` });
    }

    // In a real app, you'd also check if userId exists or is valid, possibly via an API call to User service or using JWT claims

    const newListingResult = await pool.query(
      `INSERT INTO listings (title, description, price, category_id, user_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, title, description, price, user_id AS "userId", category_id AS "categoryId", status, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [title, description, price, categoryId, userId]
    );

    return res.status(201).json(newListingResult.rows[0]);

  } catch (err) {
    console.error('Error creating listing:', err);
    if (err instanceof Error) {
        return res.status(500).json({ statusCode: 500, message: 'Internal server error: ' + err.message });
    }
    return res.status(500).json({ statusCode: 500, message: 'Internal server error' });
  }
};

export const getListingById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // Validate ID format
    const { error: idError } = Joi.string().uuid().validate(id);
    if (idError) {
        return res.status(400).json({statusCode: 400, message: 'Invalid listing ID format.'});
    }


    const listingResult = await pool.query(
      `SELECT id, title, description, price, user_id AS "userId", category_id AS "categoryId", status, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM listings WHERE id = $1`,
      [id]
    );

    if (listingResult.rows.length === 0) {
      return res.status(404).json({ statusCode: 404, message: 'Listing not found' });
    }

    return res.status(200).json(listingResult.rows[0]);

  } catch (err) {
    console.error(`Error fetching listing ${req.params.id}:`, err);
    if (err instanceof Error) {
        return res.status(500).json({ statusCode: 500, message: 'Internal server error: ' + err.message });
    }
    return res.status(500).json({ statusCode: 500, message: 'Internal server error' });
  }
};

export const getAllListings = async (req: Request, res: Response) => {
  try {
    const { error, value } = getListingsSchema.validate(req.query);
    if (error) {
      return res.status(400).json({ statusCode: 400, message: error.details[0].message });
    }
    const { limit, offset } = value;

    const listingsResult = await pool.query(
      `SELECT id, title, description, price, user_id AS "userId", category_id AS "categoryId", status, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM listings
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    // Could also return total count for pagination metadata
    // const totalCountResult = await pool.query('SELECT COUNT(*) FROM listings');
    // const totalCount = parseInt(totalCountResult.rows[0].count, 10);

    return res.status(200).json(listingsResult.rows);

  } catch (err) {
    console.error('Error fetching all listings:', err);
    if (err instanceof Error) {
        return res.status(500).json({ statusCode: 500, message: 'Internal server error: ' + err.message });
    }
    return res.status(500).json({ statusCode: 500, message: 'Internal server error' });
  }
};
