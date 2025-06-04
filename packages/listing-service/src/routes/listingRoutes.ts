import { Router } from 'express';
import { createListing, getAllListings, getListingById } from '../controllers/listingController';

const router = Router();

router.post('/', createListing);
router.get('/', getAllListings);
router.get('/:id', getListingById);

export default router;
