/**
 * 数据层 — 纯前端 localStorage 实现（用于静态部署，如 GitHub Pages）
 * 保留与原后端一致的方法签名，业务组件无需改动。
 * 数据仅存于当前浏览器（单设备）；后续如需多端同步可接入 Supabase。
 */
import seedJobs from '../data/seed-jobs.json';

const STORAGE_KEY = 'qiuzhao_jobs_v1';

function loadAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  // 首次访问：用打包内置的初始数据（127 条历史岗位）灌入
  const seeded = Array.isArray(seedJobs) ? seedJobs : [];
  saveAll(seeded);
  return seeded;
}

function saveAll(jobs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
}

function now() {
  return new Date().toISOString();
}

/** 生成 id（crypto.randomUUID 在非安全上下文可能缺失，做兜底） */
function genId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
}

/** 字段过滤 —— 对齐原后端 getAll 的过滤语义 */
function applyFilters(jobs, filters = {}) {
  return jobs.filter((j) => {
    if (!filters.show_drafts && j.is_draft) return false;

    if (filters.company) {
      const arr = Array.isArray(filters.company) ? filters.company : [filters.company];
      if (!arr.includes(j.company)) return false;
    }
    if (filters.department) {
      const arr = Array.isArray(filters.department) ? filters.department : [filters.department];
      if (!arr.includes(j.department)) return false;
    }
    if (filters.location) {
      const arr = Array.isArray(filters.location) ? filters.location : [filters.location];
      const locs = j.locations && j.locations.length ? j.locations : [];
      if (!arr.some((v) => locs.some((l) => String(l).includes(v)))) return false;
    }

    const boolFields = [
      'hr_resume_pass', 'business_resume_pass', 'assessment_invite', 'assessment_done',
      'interview_1', 'interview_2', 'interview_3', 'todo_assessment', 'todo_interview',
    ];
    for (const f of boolFields) {
      if (filters[f] !== undefined && filters[f] !== null && filters[f] !== '') {
        if (Boolean(j[f]) !== Boolean(filters[f])) return false;
      }
    }

    if (filters.result && j.result !== filters.result) return false;
    if (filters.attitude !== undefined && filters.attitude !== null && filters.attitude !== '') {
      if (Number(j.attitude) !== Number(filters.attitude)) return false;
    }
    if (filters.start_date && j.created_at < filters.start_date) return false;
    if (filters.end_date && j.created_at > filters.end_date) return false;
    if (filters.search) {
      const q = String(filters.search).toLowerCase();
      const hay = [j.title, j.company, j.department, j.location, j.description]
        .join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/** 获取岗位列表 */
export async function getJobs(filters = {}) {
  const jobs = loadAll();
  return applyFilters(jobs, filters).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

/** 获取单个岗位 */
export async function getJob(id) {
  return loadAll().find((j) => j.id === id) || null;
}

/** 创建单个岗位 */
export async function createJob(data) {
  const jobs = loadAll();
  const job = { ...data, id: data.id || genId(), created_at: now(), updated_at: now() };
  jobs.unshift(job);
  saveAll(jobs);
  return job;
}

/** 批量创建岗位 */
export async function createJobsBatch(dataArray) {
  const jobs = loadAll();
  const created = dataArray.map((data) => {
    const job = { ...data, id: data.id || genId(), created_at: now(), updated_at: now() };
    jobs.unshift(job);
    return job;
  });
  saveAll(jobs);
  return created;
}

/** 部分更新岗位 */
export async function updateJob(id, data) {
  const jobs = loadAll();
  const idx = jobs.findIndex((j) => j.id === id);
  if (idx === -1) return null;
  jobs[idx] = { ...jobs[idx], ...data, updated_at: now() };
  saveAll(jobs);
  return jobs[idx];
}

/** 删除岗位 */
export async function deleteJob(id) {
  const jobs = loadAll();
  const next = jobs.filter((j) => j.id !== id);
  saveAll(next);
  return true;
}

/** 获取筛选项去重列表 */
export async function getFilterOptions() {
  const jobs = loadAll().filter((j) => !j.is_draft);
  const companies = [...new Set(jobs.map((j) => j.company).filter(Boolean))].sort();
  const departments = [...new Set(jobs.map((j) => j.department).filter(Boolean))].sort();
  const locSet = new Set();
  jobs.forEach((j) => (j.locations || []).forEach((l) => l && locSet.add(l)));
  const locations = [...locSet].sort();
  return { companies, departments, locations };
}

/**
 * AI 精准识别：静态部署无后端，恒不启用（返回拒绝以触发本地规则降级）。
 * 桌面端本地跑 server 时如需 AI，可在此接入 DeepSeek 直连（注意勿泄露 key）。
 */
export async function parseJobsWithAI() {
  throw new Error('静态部署未启用 AI 识别，已改用本地规则');
}
