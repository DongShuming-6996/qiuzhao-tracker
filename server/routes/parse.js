import { Router } from 'express';

const router = Router();

const DEEPSEEK_BASE = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
// 默认 deepseek-v4-pro（最准）；可在 .env 用 DEEPSEEK_MODEL 覆盖为 deepseek-v4-flash（更快更省）
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro';

const SYSTEM_PROMPT = `你是秋招岗位信息抽取助手，从用户粘贴的招聘信息文本中提取结构化字段。

请只输出一个 JSON 对象，格式如下：
{"jobs":[{"title":"岗位名称","company":"公司","department":"部门","location":"工作地点","job_id":"岗位ID"}]}

规则：
1. 如果文本里包含多个岗位，请切分成多个并分别提取（单个岗位则返回长度 1 的数组）。
2. 只提取文本中真实出现的信息；没有的字段填空字符串 ""，绝不编造。
3. title 是岗位名称，去掉"急招/内推/社招/校招/实习/全职"等修饰词。
4. location 只写地点本身，不要带"工作地点/base/地点"等标签词；多个地点用"/"连接。
5. job_id 指岗位编号、职位代码、内推码这类标识，不是薪资或其它数字。`;

/** 清洗模型返回，保证类型安全 */
function normalizeJob(j) {
  return {
    title: String(j?.title || '').trim(),
    company: String(j?.company || '').trim(),
    department: String(j?.department || '').trim(),
    location: String(j?.location || '').trim(),
    job_id: String(j?.job_id || '').trim(),
  };
}

/** 从模型输出里抠出 JSON（容错处理可能包裹的 ```json 代码块） */
function extractJSON(content) {
  let s = String(content || '').trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start !== -1 && end > start) s = s.slice(start, end + 1);
  return JSON.parse(s);
}

// POST /api/parse  body: { text }
router.post('/', async (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (!text) return res.status(400).json({ error: 'text 不能为空' });

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: '未配置 DEEPSEEK_API_KEY，请在项目根目录 .env 中设置后重启' });
  }

  try {
    const r = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: text },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 4096,
      }),
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error('DeepSeek parse error:', data?.error?.message || data);
      return res.status(502).json({ error: data?.error?.message || `DeepSeek 请求失败 (${r.status})` });
    }

    const content = data.choices?.[0]?.message?.content ?? '';
    const parsed = extractJSON(content);
    res.json({ jobs: (parsed.jobs || []).map(normalizeJob) });
  } catch (err) {
    console.error('AI parse error:', err?.message || err);
    res.status(500).json({ error: err?.message || 'AI 解析失败' });
  }
});

export default router;
