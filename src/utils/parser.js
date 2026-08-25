/**
 * 纯前端规则解析 JD 文本 — 单个 + 批量
 * 兼容多种常见中文 JD 格式：
 *   1) 标准"标签：值"逐行格式        （工作地点：北京）
 *   2) 段落内联格式                  （工作地点：北京 公司：字节跳动 岗位：前端开发）
 *   3) 【标签】括号格式              （【工作地点】北京）
 *   4) 口语化写法                    （base北京 / 工作地点在北京）
 * 不调用任何 AI API，全凭规则匹配
 */

/* ────── 词典 ────── */

/** 常见城市名（含直辖市/省会/热门城市/港澳台） */
const CITY_NAMES = [
  '北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '南京', '西安', '苏州',
  '重庆', '长沙', '郑州', '合肥', '厦门', '青岛', '大连', '天津', '济南', '无锡',
  '宁波', '佛山', '东莞', '珠海', '福州', '昆明', '沈阳', '哈尔滨', '石家庄', '南昌',
  '贵阳', '南宁', '海口', '三亚', '兰州', '西宁', '银川', '乌鲁木齐', '呼和浩特', '太原',
  '长春', '徐州', '温州', '嘉兴', '绍兴', '金华', '台州', '泉州', '烟台', '潍坊',
  '临沂', '香港', '澳门', '台北', '新加坡',
];

/** 远程 / 不限等非城市地点词 */
const REMOTE_WORDS = ['远程', '远程办公', '居家办公', '线上', '不限', '多地', '全国', '北上广深', '北上广'];

/** 地点候选词（城市 + 远程词），长词在前避免子串误匹配 */
const LOC_TOKENS = [...CITY_NAMES, ...REMOTE_WORDS].sort((a, b) => b.length - a.length);
const LOC_TOKEN_ALT = LOC_TOKENS.map(escapeRegExp).join('|');

/** 字段 → 标签关键词（数组内长标签在前，避免"岗位"误吞"岗位名称"） */
const FIELD_LABELS = {
  title: ['岗位名称', '职位名称', '招聘岗位', '招聘职位', '岗位', '职位'],
  company: ['公司名称', '企业名称', '招聘单位', '雇主', '公司', '企业', '单位'],
  department: ['所属部门', '事业部', '事业群', '业务线', '部门', '团队', 'BU'],
  location: ['工作地点', '工作地', 'base地点', 'base地', 'base城市', '办公地点', '办公地', '工作城市', '所在地', '地点', '城市', 'base'],
  job_id: ['岗位ID', '职位ID', '岗位编号', '职位编号', '岗位代码', '岗位编码', '职位编码', '招聘ID', '投递ID', '职位代码', '内推码', 'JD ID', 'Job ID'],
};

/** 括号里常见的"标签词"（不是公司名，避免被误当成公司） */
const TAG_WORDS = ['急招', '招聘', '内推', '社招', '校招', '实习', '全职', '兼职', '可转正', '远程', '在线', '校园招聘', '社会招聘'];

/** 章节标题（仅用于截断字段值，不参与字段提取） */
const SECTION_LABELS = [
  '岗位职责', '岗位要求', '任职要求', '职位描述', '工作内容', '职责描述',
  '任职资格', '岗位描述', '职位要求', '薪酬', '薪资', '福利', '薪资待遇',
  '学历要求', '经验要求', '工作经验', '联系方式', '投递方式', '截止时间',
];

const ALL_LABELS = [...new Set(Object.values(FIELD_LABELS).flat())].sort((a, b) => b.length - a.length);
const STOP_LABELS = [...new Set([...ALL_LABELS, ...SECTION_LABELS])].sort((a, b) => b.length - a.length);
const STOP_LABELS_ALT = STOP_LABELS.map(escapeRegExp).join('|');

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 字段值的终止边界：下一个字段标签 / 换行 / 文本末尾
 * 用于把"段落内联"的值与下一个字段切开，例如：
 *   "工作地点：北京 公司：字节跳动" 中地点值在"公司"前截断，不再吞到行尾
 */
const VALUE_STOP = `(?=\\s*(?:${STOP_LABELS_ALT})[：:是在位于为]|[\\n\\r]|$)`;

/* ────── 文本预处理 ────── */

/** 把【标签】值 形式统一成 "标签：值"，便于统一用冒号规则匹配 */
function normalizeBrackets(text) {
  const labels = ALL_LABELS.filter(l => l.length >= 2).map(escapeRegExp).join('|');
  return text.replace(new RegExp(`【(${labels})】`, 'g'), '$1：');
}

/** 去掉末尾的括号注释："前端开发工程师（base北京）" → "前端开发工程师" */
function stripParenthetical(s) {
  return s.replace(/[（(][^（）()]*[）)]\s*$/g, '').trim();
}

/** 去掉值末尾残留的标点（段落内联切分时可能带上的 ，、；; 等） */
function trimPunct(s) {
  return (s || '').replace(/[\s，,、;；。．]+$/g, '').trim();
}

/** 清理标题中混入的地点说明：
 *  "前端开发工程师 base北京"      → "前端开发工程师"
 *  "base北京、上海、深圳的算法岗"  → "算法岗"
 */
function cleanTitle(s) {
  let t = stripParenthetical(s);
  // 去掉开头的地点前缀："base北京、上海、深圳的算法岗"
  t = t.replace(new RegExp(`^(?:base|base地|base地点|工作地点|工作地|工作城市|办公地点|办公地)[：:是在位于为]?\\s*(?:${LOC_TOKEN_ALT})(?:[\\s、,，/·|;；和与及或]*\\s*(?:${LOC_TOKEN_ALT}))*的?\\s*`, 'i'), '');
  // 去掉结尾的地点后缀："前端开发工程师 base北京"
  t = t.replace(/\s*(?:base|base地|base地点|工作地点|工作地|工作城市|办公地点|办公地)[：:是在位于为]?\s*[^\s（）()，,、]*\s*$/i, '');
  // 去掉结尾的其它字段尾巴："算法岗，公司：蚂蚁集团" → "算法岗"
  t = t.replace(new RegExp(`[，,、;；]\\s*(?:${STOP_LABELS_ALT})[：:]\\s*.*$`, 'i'), '');
  return t.trim();
}

/* ────── 字段提取 ────── */

/** 按"标签：值"提取（值在同处截断到下一个标签/换行） */
function extractByLabel(text, labels) {
  for (const label of labels) {
    const re = new RegExp(`${escapeRegExp(label)}[：:]\\s*([^\\n]*?)${VALUE_STOP}`, 'i');
    const m = text.match(re);
    const v = m && trimPunct(m[1]);
    if (v) return v;
  }
  return '';
}

/** 岗位ID 提取：冒号形式之外，额外支持"岗位ID 12345"这种空格分隔 */
function extractJobId(text) {
  const byLabel = extractByLabel(text, FIELD_LABELS.job_id);
  if (byLabel) return byLabel;
  const idLabels = ['岗位ID', '职位ID', '岗位编号', '职位编号', '岗位代码', '岗位编码', '职位编码', '招聘ID', '投递ID', '职位代码', '内推码'];
  for (const label of idLabels) {
    const re = new RegExp(`${escapeRegExp(label)}\\s*[：:]?\\s*([A-Za-z0-9][A-Za-z0-9_\\-]{1,30})`, 'i');
    const m = text.match(re);
    if (m) return m[1];
  }
  return '';
}

/** 地点提取：冒号 → 口语("在/是/位于") → 标签+城市 → 全文城市扫描 */
function extractLocation(text) {
  // 1) "工作地点：北京"
  const byLabel = extractByLabel(text, FIELD_LABELS.location);
  if (byLabel) return byLabel;

  const locLabels = ['工作地点', '工作地', 'base地点', 'base地', 'base城市', '办公地点', '办公地', '工作城市', '所在地', '地点', 'base'];
  for (const label of locLabels) {
    // 2) "工作地点在北京" / "base在北京"
    const reProse = new RegExp(`${escapeRegExp(label)}[是在位于为]\\s*([^\\n]*?)${VALUE_STOP}`, 'i');
    let m = text.match(reProse);
    const proseVal = m && trimPunct(m[1]);
    if (proseVal) return proseVal;

    // 3) "base北京" / "工作地杭州"（标签后直接跟城市，无分隔符）
    const reCity = new RegExp(`${escapeRegExp(label)}\\s*((?:${LOC_TOKEN_ALT})(?:[\\s、,，/·|;；和与及或]*\\s*(?:${LOC_TOKEN_ALT}))*)`, 'i');
    m = text.match(reCity);
    if (m && trimPunct(m[1])) return trimPunct(m[1]);
  }

  // 4) 兜底：全文扫描城市 / 远程词
  return extractCities(text).join('/');
}

/** 从文本中按出现顺序收集去重后的城市/远程词 */
function extractCities(text) {
  const found = [];
  const re = new RegExp(LOC_TOKEN_ALT, 'g');
  let m;
  while ((m = re.exec(text)) !== null) {
    if (!found.includes(m[0])) found.push(m[0]);
    if (found.length >= 8) break; // 兜底最多取 8 个，避免整篇 JD 全被收进来
  }
  return found;
}

/* ────── 地点切分 ────── */

/** 地点分隔符：/ 、 , ， ; ； · | 空格 以及 和 与 及 或 或者 */
const LOCATION_SPLIT_RE = /\s*[\/、,，;；·|]+\s*|\s*(?:或者|和|与|及|或)\s*/;

/** 仅当字符串完全由地点词 + 分隔符组成时，返回其中的地点词数组（处理"北京上海"粘连） */
function splitByTokens(str) {
  const re = new RegExp(LOC_TOKEN_ALT, 'g');
  const tokens = str.match(re);
  if (!tokens) return null;
  const residue = str.replace(re, '').replace(/[\s\/、,，;；·|和与及或]+/g, '');
  return residue.length === 0 ? tokens : null;
}

/**
 * 切分地点字符串为数组
 * "北京/上海/深圳" → ["北京", "上海", "深圳"]
 * "北京 上海"     → ["北京", "上海"]
 * "北京上海"      → ["北京", "上海"]
 */
export function splitLocations(locationStr) {
  if (!locationStr || typeof locationStr !== 'string') return [];
  const parts = locationStr.split(LOCATION_SPLIT_RE).map(s => s.trim()).filter(Boolean);
  const out = [];
  for (const part of parts) {
    const glued = splitByTokens(part);
    if (glued && glued.length > 1) out.push(...glued);
    else out.push(part);
  }
  return [...new Set(out)];
}

/* ────── 单个解析 ────── */

/**
 * 从单段 JD 文本中提取结构化字段
 * @param {string} rawText
 * @returns {{ title, company, department, location, locations, job_id, description }}
 */
export function parseJobText(rawText) {
  const empty = {
    title: '', company: '', department: '',
    location: '', locations: [], job_id: '',
    description: rawText || '',
  };
  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) return empty;

  const original = rawText.trim();
  const text = normalizeBrackets(original);

  const result = {
    title: '',
    company: '',
    department: '',
    location: '',
    locations: [],
    job_id: '',
    description: original,
  };

  result.title = extractByLabel(text, FIELD_LABELS.title);
  result.company = extractByLabel(text, FIELD_LABELS.company);
  result.department = extractByLabel(text, FIELD_LABELS.department);
  result.job_id = extractJobId(text);
  result.location = extractLocation(text);

  // 公司兜底：【字节跳动】招聘 / 字节跳动招前端 这类格式
  if (!result.company) {
    let m = text.match(/【([^【】\n]{2,30})】[^\n]{0,20}?(?:招聘|招|内推|社招|校招|急招|诚聘)/);
    if (m && !TAG_WORDS.includes(m[1].trim())) {
      result.company = m[1].trim();
    } else {
      // "字节跳动招聘数据分析师" / "急招 | 社招" 前的主语即公司
      m = text.match(/(?:^|[\n，,。;；【】])([^\s，,。;；\n【】]{2,30}?)(?:招聘|急招|诚聘|社招|校招)(?=[^\n，,。])/);
      if (m) result.company = m[1].trim();
    }
  }

  // 【公司】职位 base北京 这种"【公司】职位"格式（同时补全公司+职位）
  if (!result.company && !result.title) {
    const m = text.match(/【([^【】\n]{2,30})】\s*([^\n【】]{2,40}?)(?=base|工作地|工作地点|办公地点|[\s，,，。]|$)/);
    if (m && !TAG_WORDS.includes(m[1].trim())) {
      result.company = m[1].trim();
      result.title = cleanTitle(m[2]);
    }
  }

  // 标题兜底：①"招聘/急招"后的职位名 ②第一行非空文本（去掉序号/括号标记/章节标题）
  if (!result.title) {
    let title = '';
    const prose = text.match(/(?:招聘|急招|诚聘|社招|校招)\s*([^，,，。\n【】\s]{2,40}?)(?=[（(]|base|工作地|[\s，,，。]|$)/i);
    if (prose) title = prose[1];
    if (!title) {
      // 跳过以"岗位职责/任职要求/工作内容"等章节标题开头的行
      const sectionStart = new RegExp(`^\\s*(?:${SECTION_LABELS.map(escapeRegExp).join('|')})[：:]?`);
      const line = original.split('\n').map(l => l.trim()).find(l => l && !sectionStart.test(l));
      if (line) {
        title = line
          .replace(/^\s*(?:\d{1,2}[\.\、\)）]|[一二三四五六七八九十]+[\.\、\)）])\s*/, '')
          .replace(/^【(?:岗位|职位|JD)\s*\d*\s*】\s*/, '');
      }
    }
    title = cleanTitle(title);
    if (title && title.length <= 60) result.title = title;
  } else {
    result.title = cleanTitle(result.title);
  }

  result.company = stripParenthetical(result.company);
  result.location = stripParenthetical(result.location);
  result.locations = splitLocations(result.location);

  return result;
}

/* ────── 批量切分 ────── */

/**
 * 把用户粘贴的整段多岗位文本切分成单个岗位的文本片段
 * @param {string} rawText
 * @returns {string[]}
 */
export function splitJobText(rawText) {
  if (!rawText || typeof rawText !== 'string') return [''];
  const text = rawText.trim();
  if (!text) return [''];

  // 策略1：标题关键词重复出现
  const titleLinePattern = /(?:^|\n)\s*(?:【?(?:岗位名称|职位名称|招聘岗位|招聘职位)[】]?[：:]|\d+[\.\、\)）]\s*(?:【?(?:岗位名称|职位名称|招聘岗位|招聘职位)))/gm;
  const titleMatches = [];
  let tm;
  while ((tm = titleLinePattern.exec(text)) !== null) {
    titleMatches.push(tm.index + tm[0].indexOf(tm[0].trimStart()));
  }
  if (titleMatches.length >= 2) {
    return splitAt(text, titleMatches);
  }

  // 策略2：分隔线
  const sepPattern = /(?:^|\n)[\t ]*(?:[—\-]{3,}|[═\=]{3,}|[\*]{3,}|[#~]{3,})[\t ]*(?:\n|$)/gm;
  const sepMatches = [];
  let sm;
  while ((sm = sepPattern.exec(text)) !== null) sepMatches.push(sm.index);
  if (sepMatches.length >= 1) {
    const indices = [0];
    let cursor = 0;
    for (const sepIdx of sepMatches) {
      const chunk = text.slice(cursor, sepIdx).trim();
      if (chunk.length > 10) {
        cursor = sepIdx + 3;
        indices.push(cursor);
      }
    }
    const lastChunk = text.slice(cursor).trim();
    if (lastChunk.length > 10) indices.push(cursor);
    if (indices.length >= 2) return splitAt(text, indices.filter((_, i) => i > 0 || text.slice(0, indices[1] || text.length).trim().length > 10));
  }

  // 策略3：数字编号开头
  const numPattern = /(?:^|\n)\s*(?:\d{1,2}|一|二|三|四|五|六|七|八|九|十)[\.\、\)）][ \t]{0,2}(?=\S)/gm;
  const numMatches = [];
  let nm;
  while ((nm = numPattern.exec(text)) !== null) numMatches.push(nm.index + nm[0].length);
  const validNums = [];
  for (let i = 0; i < numMatches.length; i++) {
    const idx = numMatches[i];
    const nextIdx = i < numMatches.length - 1 ? numMatches[i + 1] : text.length;
    if (text.slice(idx, nextIdx).trim().length > 30) validNums.push(idx);
  }
  if (validNums.length >= 2) return splitAt(text, validNums);

  // 策略4：【岗位X】/【JD X】类标记
  const bracketPattern = /(?:^|\n)\s*【(?:岗位|职位|JD)[^】]*】/gm;
  const bracketMatches = [];
  let bm;
  while ((bm = bracketPattern.exec(text)) !== null) bracketMatches.push(bm.index + bm[0].indexOf('【'));
  if (bracketMatches.length >= 2) return splitAt(text, bracketMatches);

  // 策略5：退化为整段
  return [text];
}

function splitAt(text, indices) {
  const segments = [];
  for (let i = 0; i < indices.length; i++) {
    const start = indices[i];
    const end = i < indices.length - 1 ? indices[i + 1] : text.length;
    const seg = text.slice(start, end).trim();
    if (seg.length > 5) segments.push(seg);
  }
  return segments.length > 0 ? segments : [text];
}

/**
 * 批量解析：切分 → 逐段解析
 */
export function parseJobBatch(rawText) {
  const segments = splitJobText(rawText);
  return segments.map(seg => parseJobText(seg));
}
