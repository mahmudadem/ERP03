import express from 'express';
import { SystemMetadataController } from '../controllers/system/SystemMetadataController';

const router = express.Router();

/**
 * System metadata routes - PUBLIC (no auth required)
 * Used for fetching system-wide data like currencies, templates, etc.
 */

// GET /api/v1/system/metadata/currencies
router.get('/currencies', SystemMetadataController.getCurrencies);

//GET /api/v1/system/metadata/coa-templates
router.get('/coa-templates', SystemMetadataController.getCoaTemplates);

export default router;
