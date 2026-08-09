import { Router } from 'express';
import personaCrudRouter from './personaCrud';
import personaExportImportRouter from './personaExportImport';

const router = Router();

router.use('/', personaCrudRouter);
router.use('/', personaExportImportRouter);

export default router;
