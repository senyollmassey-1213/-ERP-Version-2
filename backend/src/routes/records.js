const express = require('express');
const r = express.Router();
const { authenticate, scopeToTenant } = require('../middleware/auth');
const { listRecords, getRecord, createRecord, updateRecord, deleteRecord, getRecordStats } = require('../controllers/recordController');

r.use(authenticate, scopeToTenant);
r.get('/:moduleSlug',       listRecords);
r.get('/:moduleSlug/stats', getRecordStats);
r.post('/:moduleSlug',      createRecord);
r.get('/id/:id',            getRecord);
r.put('/id/:id',            updateRecord);
r.delete('/id/:id',         deleteRecord);

module.exports = r;
