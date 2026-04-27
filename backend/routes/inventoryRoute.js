const express     = require('express');
const router      = express.Router();
const multer      = require('multer');
const verifyToken = require('../middleware/auth');
const authorize   = require('../middleware/authorize');
const inventory   = require('../controllers/inventoryController');

// Multer 2 + Express 5: memory storage and size limit only.
// File type check (extension + MIME) is handled inside the controller
// after the file arrives. This is cleaner than fileFilter in Multer 2.
const upload = multer({
    storage: multer.memoryStorage(),
    limits:  { fileSize: 10 * 1024 * 1024 },  // 10mb max
});

router.post('/upload',            verifyToken, authorize('pharmacy'), upload.single('file'), inventory.uploadInventory);
router.get('/my-uploads',         verifyToken, authorize('pharmacy'), inventory.getMyUploads);
router.get('/session/:sessionId', verifyToken, inventory.getSession);
router.get('/session/:sessionId/antibiotic-matches', verifyToken, inventory.getAntibioticMatchesForSession);

module.exports = router;
