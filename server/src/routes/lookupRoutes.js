import { Router } from 'express';
import * as lookupCtrl from '../controllers/lookupController.js';
import { optionalAuthenticate } from '../middleware/auth.js';

const router = Router();

router.get('/', optionalAuthenticate, lookupCtrl.getLookups);
router.get('/departments', lookupCtrl.getDepartments);
router.get('/semesters', lookupCtrl.getSemesters);
router.get('/academic-years', lookupCtrl.getAcademicYears);
router.get('/programs', lookupCtrl.getPrograms);
router.get('/teachers', lookupCtrl.getTeachers);
router.get('/withdrawal-reasons', lookupCtrl.getWithdrawalReasons);

export default router;
