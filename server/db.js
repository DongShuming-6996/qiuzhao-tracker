import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'qiuzhao.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS jobs (
    id              TEXT PRIMARY KEY,
    job_id          TEXT DEFAULT '',
    title           TEXT NOT NULL,
    company         TEXT NOT NULL,
    department      TEXT DEFAULT '',
    location        TEXT DEFAULT '',
    locations       TEXT DEFAULT '[]',
    description     TEXT DEFAULT '',
    description_html TEXT DEFAULT '',
    raw_text        TEXT DEFAULT '',
    url             TEXT DEFAULT '',
    hr_resume_pass       INTEGER DEFAULT 0,
    business_resume_pass INTEGER DEFAULT 0,
    assessment_invite    INTEGER DEFAULT 0,
    assessment_done      INTEGER DEFAULT 0,
    interview_1          INTEGER DEFAULT 0,
    interview_2          INTEGER DEFAULT 0,
    interview_3          INTEGER DEFAULT 0,
    todo_assessment      INTEGER DEFAULT 0,
    todo_interview       INTEGER DEFAULT 0,
    result          TEXT DEFAULT 'pending',
    attitude        INTEGER DEFAULT 0,
    notes           TEXT DEFAULT '',
    is_draft        INTEGER DEFAULT 0,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company);
  CREATE INDEX IF NOT EXISTS idx_jobs_result ON jobs(result);
  CREATE INDEX IF NOT EXISTS idx_jobs_attitude ON jobs(attitude);
  CREATE INDEX IF NOT EXISTS idx_jobs_created ON jobs(created_at);
  CREATE INDEX IF NOT EXISTS idx_jobs_is_draft ON jobs(is_draft);
`);

// 兼容旧库迁移：新增字段列（幂等）
const existingCols = db.prepare('PRAGMA table_info(jobs)').all();
const hasCol = name => existingCols.some(c => c.name === name);

const migrateTextCols = [
  ['url', "ALTER TABLE jobs ADD COLUMN url TEXT DEFAULT ''"],
];
const migrateIntCols = [
  ['hr_resume_pass',       'ALTER TABLE jobs ADD COLUMN hr_resume_pass INTEGER DEFAULT 0'],
  ['business_resume_pass', 'ALTER TABLE jobs ADD COLUMN business_resume_pass INTEGER DEFAULT 0'],
  ['assessment_invite',    'ALTER TABLE jobs ADD COLUMN assessment_invite INTEGER DEFAULT 0'],
  ['assessment_done',      'ALTER TABLE jobs ADD COLUMN assessment_done INTEGER DEFAULT 0'],
  ['todo_assessment',      'ALTER TABLE jobs ADD COLUMN todo_assessment INTEGER DEFAULT 0'],
  ['todo_interview',       'ALTER TABLE jobs ADD COLUMN todo_interview INTEGER DEFAULT 0'],
];
for (const [name, sql] of migrateTextCols) if (!hasCol(name)) db.exec(sql);
for (const [name, sql] of migrateIntCols) if (!hasCol(name)) db.exec(sql);

// 数据迁移：旧状态字段 → 新状态字段（仅当新列为 0 时拷贝，幂等）
const migrateMap = [
  ['assessment',          'assessment_done'],
  ['business_screen',     'business_resume_pass'],
  ['resume_passed',       'hr_resume_pass'],
  ['pending_assessment',  'todo_assessment'],
];
for (const [oldCol, newCol] of migrateMap) {
  if (hasCol(oldCol) && hasCol(newCol)) {
    db.exec(`UPDATE jobs SET ${newCol} = 1 WHERE ${oldCol} = 1 AND ${newCol} = 0`);
  }
}

function rowToJob(row) {
  if (!row) return null;
  return {
    ...row,
    locations: safeParseJSON(row.locations, []),
    hr_resume_pass: Boolean(row.hr_resume_pass),
    business_resume_pass: Boolean(row.business_resume_pass),
    assessment_invite: Boolean(row.assessment_invite),
    assessment_done: Boolean(row.assessment_done),
    interview_1: Boolean(row.interview_1),
    interview_2: Boolean(row.interview_2),
    interview_3: Boolean(row.interview_3),
    todo_assessment: Boolean(row.todo_assessment),
    todo_interview: Boolean(row.todo_interview),
    is_draft: Boolean(row.is_draft),
  };
}

function safeParseJSON(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}

function getAll(filters = {}) {
  const conditions = [];
  const params = {};

  if (!filters.show_drafts) conditions.push('is_draft = 0');

  if (filters.company) {
    const arr = Array.isArray(filters.company) ? filters.company : [filters.company];
    conditions.push(`company IN (${arr.map((_, i) => `@c${i}`).join(',')})`);
    arr.forEach((v, i) => { params[`c${i}`] = v; });
  }
  if (filters.department) {
    const arr = Array.isArray(filters.department) ? filters.department : [filters.department];
    conditions.push(`department IN (${arr.map((_, i) => `@d${i}`).join(',')})`);
    arr.forEach((v, i) => { params[`d${i}`] = v; });
  }
  if (filters.location) {
    const arr = Array.isArray(filters.location) ? filters.location : [filters.location];
    const likes = arr.map((_, i) => `locations LIKE @l${i}`).join(' OR ');
    conditions.push(`(${likes})`);
    arr.forEach((v, i) => { params[`l${i}`] = `%${v}%`; });
  }

  ['hr_resume_pass', 'business_resume_pass', 'assessment_invite', 'assessment_done', 'interview_1', 'interview_2', 'interview_3', 'todo_assessment', 'todo_interview'].forEach(f => {
    if (filters[f] !== undefined && filters[f] !== null && filters[f] !== '') {
      conditions.push(`${f} = @${f}`);
      params[f] = filters[f] ? 1 : 0;
    }
  });

  if (filters.result) { conditions.push('result = @result'); params.result = filters.result; }
  if (filters.attitude !== undefined && filters.attitude !== null && filters.attitude !== '') {
    conditions.push('attitude = @attitude');
    params.attitude = Number(filters.attitude);
  }
  if (filters.start_date) { conditions.push('created_at >= @start'); params.start = filters.start_date; }
  if (filters.end_date) { conditions.push('created_at <= @end'); params.end = filters.end_date; }
  if (filters.search) {
    conditions.push('(title LIKE @q OR company LIKE @q OR department LIKE @q OR location LIKE @q OR description LIKE @q)');
    params.q = `%${filters.search}%`;
  }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  const rows = db.prepare(`SELECT * FROM jobs ${where} ORDER BY created_at DESC`).all(params);
  return rows.map(rowToJob);
}

function getById(id) {
  return rowToJob(db.prepare('SELECT * FROM jobs WHERE id = ?').get(id));
}

function create(data) {
  const id = data.id || crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO jobs (id,job_id,title,company,department,location,locations,
      description,description_html,raw_text,url,
      hr_resume_pass,business_resume_pass,assessment_invite,assessment_done,interview_1,interview_2,interview_3,todo_assessment,todo_interview,
      result,attitude,notes,is_draft,created_at,updated_at)
    VALUES (@id,@job_id,@title,@company,@department,@location,@locations,
      @description,@description_html,@raw_text,@url,
      @hr_resume_pass,@business_resume_pass,@assessment_invite,@assessment_done,@interview_1,@interview_2,@interview_3,@todo_assessment,@todo_interview,
      @result,@attitude,@notes,@is_draft,@created_at,@updated_at)
  `).run({
    id, job_id: data.job_id || '', title: data.title || '', company: data.company || '',
    department: data.department || '', location: data.location || '',
    locations: JSON.stringify(data.locations || []),
    description: data.description || '', description_html: data.description_html || '',
    raw_text: data.raw_text || '', url: data.url || '',
    hr_resume_pass: data.hr_resume_pass ? 1 : 0, business_resume_pass: data.business_resume_pass ? 1 : 0,
    assessment_invite: data.assessment_invite ? 1 : 0, assessment_done: data.assessment_done ? 1 : 0,
    interview_1: data.interview_1 ? 1 : 0, interview_2: data.interview_2 ? 1 : 0,
    interview_3: data.interview_3 ? 1 : 0,
    todo_assessment: data.todo_assessment ? 1 : 0, todo_interview: data.todo_interview ? 1 : 0,
    result: data.result || 'pending', attitude: data.attitude || 0,
    notes: data.notes || '', is_draft: data.is_draft ? 1 : 0,
    created_at: now, updated_at: now,
  });
  return getById(id);
}

function createBatch(dataArray) {
  const now = new Date().toISOString();
  const insert = db.prepare(`
    INSERT INTO jobs (id,job_id,title,company,department,location,locations,
      description,description_html,raw_text,url,
      hr_resume_pass,business_resume_pass,assessment_invite,assessment_done,interview_1,interview_2,interview_3,todo_assessment,todo_interview,
      result,attitude,notes,is_draft,created_at,updated_at)
    VALUES (@id,@job_id,@title,@company,@department,@location,@locations,
      @description,@description_html,@raw_text,@url,
      @hr_resume_pass,@business_resume_pass,@assessment_invite,@assessment_done,@interview_1,@interview_2,@interview_3,@todo_assessment,@todo_interview,
      @result,@attitude,@notes,@is_draft,@created_at,@updated_at)
  `);
  const ids = [];
  const txn = db.transaction((items) => {
    for (const data of items) {
      const id = data.id || crypto.randomUUID();
      insert.run({
        id, job_id: data.job_id || '', title: data.title || '', company: data.company || '',
        department: data.department || '', location: data.location || '',
        locations: JSON.stringify(data.locations || []),
        description: data.description || '', description_html: data.description_html || '',
        raw_text: data.raw_text || '', url: data.url || '',
        hr_resume_pass: data.hr_resume_pass ? 1 : 0, business_resume_pass: data.business_resume_pass ? 1 : 0,
        assessment_invite: data.assessment_invite ? 1 : 0, assessment_done: data.assessment_done ? 1 : 0,
        interview_1: data.interview_1 ? 1 : 0, interview_2: data.interview_2 ? 1 : 0,
        interview_3: data.interview_3 ? 1 : 0,
        todo_assessment: data.todo_assessment ? 1 : 0, todo_interview: data.todo_interview ? 1 : 0,
        result: data.result || 'pending', attitude: data.attitude || 0,
        notes: data.notes || '', is_draft: data.is_draft ? 1 : 0,
        created_at: now, updated_at: now,
      });
      ids.push(id);
    }
  });
  txn(dataArray);
  return ids.map(id => getById(id));
}

function update(id, data) {
  const existing = getById(id);
  if (!existing) return null;
  const m = { ...existing, ...data, updated_at: new Date().toISOString() };
  db.prepare(`
    UPDATE jobs SET job_id=@job_id,title=@title,company=@company,department=@department,
      location=@location,locations=@locations,
      description=@description,description_html=@description_html,raw_text=@raw_text,url=@url,
      hr_resume_pass=@hr_resume_pass,business_resume_pass=@business_resume_pass,
      assessment_invite=@assessment_invite,assessment_done=@assessment_done,
      interview_1=@interview_1,interview_2=@interview_2,interview_3=@interview_3,
      todo_assessment=@todo_assessment,todo_interview=@todo_interview,
      result=@result,attitude=@attitude,notes=@notes,is_draft=@is_draft,
      updated_at=@updated_at WHERE id=@id
  `).run({
    id, job_id: m.job_id || '', title: m.title || '', company: m.company || '',
    department: m.department || '', location: m.location || '',
    locations: JSON.stringify(m.locations || []),
    description: m.description || '', description_html: m.description_html || '',
    raw_text: m.raw_text || '', url: m.url || '',
    hr_resume_pass: m.hr_resume_pass ? 1 : 0, business_resume_pass: m.business_resume_pass ? 1 : 0,
    assessment_invite: m.assessment_invite ? 1 : 0, assessment_done: m.assessment_done ? 1 : 0,
    interview_1: m.interview_1 ? 1 : 0, interview_2: m.interview_2 ? 1 : 0,
    interview_3: m.interview_3 ? 1 : 0,
    todo_assessment: m.todo_assessment ? 1 : 0, todo_interview: m.todo_interview ? 1 : 0,
    result: m.result || 'pending', attitude: m.attitude || 0,
    notes: m.notes || '', is_draft: m.is_draft ? 1 : 0,
    updated_at: m.updated_at,
  });
  return getById(id);
}

function remove(id) {
  return db.prepare('DELETE FROM jobs WHERE id = ?').run(id).changes > 0;
}

function getFilterOptions() {
  const companies = db.prepare("SELECT DISTINCT company FROM jobs WHERE is_draft=0 AND company!='' ORDER BY company").all().map(r => r.company);
  const departments = db.prepare("SELECT DISTINCT department FROM jobs WHERE is_draft=0 AND department!='' ORDER BY department").all().map(r => r.department);
  const locRows = db.prepare('SELECT locations FROM jobs WHERE is_draft=0').all();
  const locSet = new Set();
  locRows.forEach(r => {
    const arr = safeParseJSON(r.locations, []);
    arr.forEach(l => l && locSet.add(l));
  });
  const locations = [...locSet].sort();
  return { companies, departments, locations };
}

export { getAll, getById, create, createBatch, update, remove, getFilterOptions };
