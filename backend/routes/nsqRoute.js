const express     = require('express');
const router      = express.Router();
const multer      = require('multer');
const verifyToken = require('../middleware/auth');
const authorize   = require('../middleware/authorize');
const nsq         = require('../controllers/nsqController');

// Same Multer 2 pattern — memory only, size limit only.
// File type validation happens inside nsqController.uploadNSQCsv
const upload = multer({
    storage: multer.memoryStorage(),
    limits:  { fileSize: 10 * 1024 * 1024 },
});

router.post('/add',          verifyToken, authorize('admin'), nsq.addNSQRecord);
router.post('/upload-csv',   verifyToken, authorize('admin'), upload.single('file'), nsq.uploadNSQCsv);
router.get('/all',           verifyToken, authorize('admin'), nsq.getAllNSQ);
router.delete('/:recordId',  verifyToken, authorize('admin'), nsq.deleteNSQRecord);

module.exports = router;