import { useState, useRef, useEffect, useCallback } from 'react';
import { Modal, Tag, Typography, Button, Space, Tooltip, message } from 'antd';
import { ATTITUDE_ICON_MAP } from '../utils/constants';
import { updateJob } from '../api/storage';

const { Text } = Typography;

const HIGHLIGHT_COLORS = [
  { label: '黄', color: '#ffeb3b' },
  { label: '绿', color: '#a5d6a7' },
  { label: '蓝', color: '#90caf9' },
  { label: '粉', color: '#f48fb1' },
  { label: '橙', color: '#ffcc80' },
];

/**
 * 可高亮文本块 — 纯原生 DOM 操作，不经过 React 渲染
 */
function HighlightableText({ jobId, description, descriptionHtml }) {
  const elRef = useRef(null);
  const [toolbar, setToolbar] = useState({ show: false, x: 0, y: 0 });
  const savedHtmlRef = useRef(descriptionHtml || '');

  // 初始化：直接用 innerHTML 写入（绕过 React）
  useEffect(() => {
    if (!elRef.current) return;
    const initialHtml = descriptionHtml || description.replace(/\n/g, '<br>');
    elRef.current.innerHTML = initialHtml;
    savedHtmlRef.current = initialHtml;
  }, [jobId]); // 仅在 jobId 变化时重置

  // 保存到 localStorage
  const persist = useCallback(() => {
    if (!elRef.current) return;
    const html = elRef.current.innerHTML;
    updateJob(jobId, { description_html: html }).catch(() => {});
    savedHtmlRef.current = html;
  }, [jobId]);

  // 选中文字 → 显示工具栏
  const handleMouseUp = useCallback((e) => {
    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !elRef.current?.contains(sel.anchorNode)) {
        setToolbar(t => t.show ? { show: false, x: 0, y: 0 } : t);
        return;
      }
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      setToolbar({ show: true, x: rect.left + rect.width / 2, y: rect.top - 8 });
    }, 40);
  }, []);

  // 应用高亮
  const applyHighlight = useCallback((color) => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    if (!elRef.current?.contains(range.commonAncestorContainer)) return;

    try {
      const mark = document.createElement('mark');
      mark.style.backgroundColor = color;
      mark.style.padding = '1px 2px';
      mark.style.borderRadius = '2px';
      range.surroundContents(mark);
    } catch {
      // 跨元素选区：用 execCommand 降级
      document.designMode = 'on';
      document.execCommand('backColor', false, color);
      document.designMode = 'off';
    }
    sel.removeAllRanges();
    persist();
    setToolbar({ show: false, x: 0, y: 0 });
  }, [persist]);

  // 清除高亮
  const clearHighlight = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    if (!elRef.current?.contains(sel.anchorNode)) return;

    // 找到选区所在的 mark 标签
    let node = sel.anchorNode;
    while (node && node !== elRef.current) {
      if (node.nodeName === 'MARK') {
        const parent = node.parentNode;
        while (node.firstChild) {
          parent.insertBefore(node.firstChild, node);
        }
        parent.removeChild(node);
        break;
      }
      node = node.parentNode;
    }
    sel.removeAllRanges();
    persist();
    setToolbar({ show: false, x: 0, y: 0 });
  }, [persist]);

  // 点击外部关闭工具栏
  useEffect(() => {
    const handler = (e) => {
      if (elRef.current && !elRef.current.contains(e.target)) {
        setToolbar(t => t.show ? { show: false, x: 0, y: 0 } : t);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div style={{ position: 'relative' }}>
      {/* 高亮工具栏 */}
      {toolbar.show && (
        <div style={{
          position: 'fixed',
          left: Math.max(toolbar.x - 110, 10),
          top: Math.max(toolbar.y - 44, 10),
          zIndex: 1060,
          background: '#fff',
          border: '1px solid #d9d9d9',
          borderRadius: 8,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          padding: '5px 10px',
          display: 'flex',
          gap: 4,
          alignItems: 'center',
        }}>
          {HIGHLIGHT_COLORS.map(h => (
            <Tooltip key={h.color} title={h.label}>
              <div
                onMouseDown={e => { e.preventDefault(); applyHighlight(h.color); }}
                style={{
                  width: 22, height: 22, borderRadius: 4,
                  backgroundColor: h.color,
                  border: '1px solid rgba(0,0,0,0.2)',
                  cursor: 'pointer',
                }}
              />
            </Tooltip>
          ))}
          <div style={{ width: 1, height: 18, background: '#e8e8e8', margin: '0 4px' }} />
          <Tooltip title="清除高亮">
            <span
              onMouseDown={e => { e.preventDefault(); clearHighlight(); }}
              style={{ cursor: 'pointer', fontSize: 16, color: '#999', lineHeight: 1 }}
            >
              ✕
            </span>
          </Tooltip>
        </div>
      )}

      <div
        ref={elRef}
        onMouseUp={handleMouseUp}
        style={{
          fontSize: 13,
          lineHeight: 1.9,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          minHeight: 120,
          maxHeight: 500,
          overflowY: 'auto',
          padding: '8px 12px',
          border: '1px solid #f0f0f0',
          borderRadius: 4,
          background: '#fafafa',
          cursor: 'text',
          userSelect: 'text',
        }}
      />
    </div>
  );
}

/**
 * 态度标记按钮组
 */
function AttitudePicker({ job, onAttitudeChange }) {
  const current = job.attitude || 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'center' }}>
      <Tooltip title="喜欢 ⭐">
        <span
          onClick={() => onAttitudeChange(job.id, current === 1 ? 0 : 1)}
          style={{ cursor: 'pointer', fontSize: 22, userSelect: 'none', lineHeight: 1 }}
        >
          {current >= 1 ? '⭐' : '☆'}
        </span>
      </Tooltip>
      <Tooltip title="超喜欢 ⭐⭐">
        <span
          onClick={() => onAttitudeChange(job.id, current === 2 ? 0 : 2)}
          style={{ cursor: 'pointer', fontSize: 22, userSelect: 'none', lineHeight: 1, marginLeft: 2 }}
        >
          {current >= 2 ? '⭐' : '☆'}
        </span>
      </Tooltip>
      <div style={{ width: 1, height: 18, background: '#e8e8e8', margin: '0 8px' }} />
      <Tooltip title="不喜欢 ✗">
        <span
          onClick={() => onAttitudeChange(job.id, current === -1 ? 0 : -1)}
          style={{
            cursor: 'pointer', fontSize: 22, userSelect: 'none', lineHeight: 1,
            color: current <= -1 ? '#ff4d4f' : '#bbb', fontWeight: 700,
          }}
        >
          ✗
        </span>
      </Tooltip>
      <Tooltip title="很不喜欢 ✗✗">
        <span
          onClick={() => onAttitudeChange(job.id, current === -2 ? 0 : -2)}
          style={{
            cursor: 'pointer', fontSize: 22, userSelect: 'none', lineHeight: 1,
            color: current <= -2 ? '#ff4d4f' : '#bbb', fontWeight: 700, marginLeft: 2,
          }}
        >
          ✗
        </span>
      </Tooltip>
    </div>
  );
}

/**
 * 岗位对比弹窗
 */
export default function CompareModal({ open, jobs: initialJobs = [], onClose, onRefresh }) {
  const [jobs, setJobs] = useState(initialJobs);

  useEffect(() => {
    setJobs(initialJobs);
  }, [initialJobs]);

  const handleAttitudeChange = (jobId, value) => {
    updateJob(jobId, { attitude: value }).catch(err => message.error('更新态度失败: ' + err.message));
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, attitude: value } : j));
  };

  const handleClose = () => {
    // 关闭时刷新列表页以同步态度
    onRefresh?.();
    onClose?.();
  };

  if (!jobs || jobs.length < 2) return null;

  const renderLocations = (record) => {
    const locs = (record.locations && record.locations.length > 0)
      ? record.locations
      : (record.location ? record.location.split(/[\/、,，\s]+/).filter(Boolean) : []);
    if (locs.length === 0) return '-';
    return <Space size={2} wrap>{locs.map((l, i) => <Tag key={i} color="green" style={{ fontSize: 11 }}>{l.trim()}</Tag>)}</Space>;
  };

  const compareFields = [
    { key: 'attitude',  label: '态度',     render: (j) => (
      <AttitudePicker job={j} onAttitudeChange={handleAttitudeChange} />
    )},
    { key: 'title',     label: '岗位名称', render: (j) => <Text strong style={{ fontSize: 14 }}>{j.title || '-'}</Text> },
    { key: 'job_id',    label: '岗位ID',   render: (j) => j.job_id ? <Text code>{j.job_id}</Text> : '-' },
    { key: 'company',   label: '公司',     render: (j) => j.company ? <Tag color="geekblue">{j.company}</Tag> : '-' },
    { key: 'department',label: '部门',     render: (j) => j.department || '-' },
    { key: 'location',  label: 'Base地点', render: (j) => renderLocations(j) },
    { key: 'desc',      label: '岗位详情', render: (j) => (
      <HighlightableText
        jobId={j.id}
        description={j.description}
        descriptionHtml={j.description_html}
      />
    )},
  ];

  const dataSource = compareFields.map(field => {
    const row = { _key: field.key, _label: field.label };
    jobs.forEach((job, i) => { row[`job${i}`] = field.render(job); });
    return row;
  });

  const modalWidth = Math.min(340 + jobs.length * 310, 1500);

  return (
    <Modal
      title={
        <Space>
          <span>岗位对比 · {jobs.length} 个岗位</span>
          <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
            （选中详情文字 → 出现颜色工具栏 → 点击高亮）
          </Text>
        </Space>
      }
      open={open}
      onCancel={handleClose}
      footer={null}
      width={modalWidth}
      style={{ top: 12 }}
      destroyOnClose
    >
      <div style={{ marginBottom: 8 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          💡 在「岗位详情」行中选中文字 → 出现高亮工具栏 → 点击颜色标记。高亮会持久保存。关闭弹窗自动同步所有修改。
        </Text>
      </div>

      <div style={{
        maxHeight: 'calc(100vh - 180px)',
        overflow: 'auto',
        border: '1px solid #f0f0f0',
        borderRadius: 8,
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{
                position: 'sticky', top: 0, zIndex: 2,
                background: '#fafafa', padding: '10px 12px',
                borderBottom: '2px solid #e8e8e8', textAlign: 'center',
                width: 90, minWidth: 90,
              }}>字段</th>
              {jobs.map((job, i) => (
                <th key={i} style={{
                  position: 'sticky', top: 0, zIndex: 2,
                  background: '#fff', padding: '8px 12px',
                  borderBottom: '2px solid #e8e8e8',
                  textAlign: 'center', minWidth: 280,
                }}>
                  <Text strong style={{ fontSize: 14, display: 'block' }}>
                    {job.title?.slice(0, 22) || `岗位${i + 1}`}
                  </Text>
                  <Text style={{ fontSize: 20, display: 'block', marginTop: 4 }}>
                    {ATTITUDE_ICON_MAP[job.attitude || 0]}
                  </Text>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {compareFields.map((field) => (
              <tr key={field.key} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{
                  background: '#fafafa', padding: '10px 12px',
                  fontWeight: 600, fontSize: 13, verticalAlign: 'top',
                  whiteSpace: 'nowrap', width: 90,
                }}>
                  {field.label}
                </td>
                {jobs.map((job, i) => (
                  <td key={i} style={{
                    padding: '10px 12px',
                    verticalAlign: 'top',
                    background: i % 2 === 0 ? '#fff' : '#fafafa',
                  }}>
                    {field.render(job)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
