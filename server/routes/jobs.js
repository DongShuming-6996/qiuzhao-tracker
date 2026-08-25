import { Router } from 'express';
import { getAll, getById, create, createBatch, update, remove, getFilterOptions } from '../db.js';

const router = Router();

// GET /api/jobs
router.get('/', (req, res) => {
  try {
    const jobs = getAll(req.query);
    res.json({ jobs });
  } catch (err) {
    console.error('GET /api/jobs error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/jobs/filters/options（在 :id 之前）
router.get('/filters/options', (req, res) => {
  try {
    const options = getFilterOptions();
    res.json(options);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/jobs/:id
router.get('/:id', (req, res) => {
  try {
    const job = getById(req.params.id);
    if (!job) return res.status(404).json({ error: '岗位不存在' });
    res.json({ job });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/jobs
router.post('/', (req, res) => {
  try {
    const job = create(req.body);
    res.status(201).json({ job });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/jobs/batch
router.post('/batch', (req, res) => {
  try {
    const { jobs } = req.body;
    if (!Array.isArray(jobs) || jobs.length === 0) {
      return res.status(400).json({ error: 'jobs 必须是非空数组' });
    }
    const created = createBatch(jobs);
    res.status(201).json({ jobs: created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/jobs/:id
router.patch('/:id', (req, res) => {
  try {
    const job = update(req.params.id, req.body);
    if (!job) return res.status(404).json({ error: '岗位不存在' });
    res.json({ job });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/jobs/:id
router.delete('/:id', (req, res) => {
  try {
    const ok = remove(req.params.id);
    if (!ok) return res.status(404).json({ error: '岗位不存在' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
