import { Request, Response } from 'express';
import Joi from 'joi';
import pool from '../db';

const categorySchema = Joi.object({
  name: Joi.string().min(3).max(100).required(),
});

export const createCategory = async (req: Request, res: Response) => {
  try {
    const { error, value } = categorySchema.validate(req.body);
    if (error) {
      return res.status(400).json({ statusCode: 400, message: error.details[0].message });
    }
    const { name } = value;

    // Check if category already exists
    const existingCategory = await pool.query('SELECT * FROM categories WHERE name = $1', [name]);
    if (existingCategory.rows.length > 0) {
      return res.status(409).json({ statusCode: 409, message: 'Category with this name already exists' });
    }

    const newCategoryResult = await pool.query(
      'INSERT INTO categories (name) VALUES ($1) RETURNING id, name, created_at',
      [name]
    );
    const newCategory = newCategoryResult.rows[0];

    return res.status(201).json(newCategory);
  } catch (err) {
    console.error('Error creating category:', err);
    if (err instanceof Error) {
        return res.status(500).json({ statusCode: 500, message: 'Internal server error: ' + err.message });
    }
    return res.status(500).json({ statusCode: 500, message: 'Internal server error' });
  }
};

export const getAllCategories = async (req: Request, res: Response) => {
  try {
    const categoriesResult = await pool.query('SELECT id, name, created_at FROM categories ORDER BY name ASC');
    return res.status(200).json(categoriesResult.rows);
  } catch (err) {
    console.error('Error fetching categories:', err);
    if (err instanceof Error) {
        return res.status(500).json({ statusCode: 500, message: 'Internal server error: ' + err.message });
    }
    return res.status(500).json({ statusCode: 500, message: 'Internal server error' });
  }
};
