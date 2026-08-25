import { useState, useCallback, useEffect } from 'react';
import {
  Form, Input, Button, Space, Card, Spin, message, Typography,
  Tabs, Table, Popconfirm, Tag, Select, Tooltip,
} from 'antd';
import {
  ThunderboltOutlined, SaveOutlined, FileTextOutlined,
  FullscreenOutlined, FullscreenExitOutlined, DeleteOutlined,
  RollbackOutlined, EditOutlined, CheckOutlined, CloseOutlined,
  PlusOutlined, ClearOutlined,
} from '@ant-design/icons';
import { parseJobText, parseJobBatch, splitLocations, splitJobText } from '../utils/parser';
import { parseJobsWithAI } from '../api/storage';

const { TextArea } = Input;
const { Text, Paragraph } = Typography;

/**
 * 录入表单组件 — 单个 + 批量
 */
export default function JobForm({ initialValues, onSave, onSaveDraft, onDelete, onCancel }) {
  const [form] = Form.useForm();
  const [parsing, setParsing] = useState(false);
  const [rawText, setRawText] = useState(initialValues?.raw_text || '');
  const [fullscreen, setFullscreen] = useState(false);
  const [mode, setMode] = useState('single');            // 'single' | 'batch'
  const [batchJobs, setBatchJobs] = useState([]);        // 批量模式下解析出的岗位
  const [batchParsed, setBatchParsed] = useState(false);  // 是否已完成批量解析
  const [editingCell, setEditingCell] = useState(null);  // 表格中正在编辑的单元格 { index, field }
  const isEdit = !!initialValues?.id;

  // ── 单个模式：一键识别（优先 AI 精准识别，失败降级本地规则）──
  const handleParseSingle = useCallback(async () => {
    if (!rawText.trim()) {
      message.warning('请先粘贴岗位 JD 文本');
      return;
    }
    setParsing(true);
    let parsed = null;
    let usedAI = false;
    try {
      const jobs = await parseJobsWithAI(rawText);
      if (jobs?.length) {
        parsed = { ...jobs[0], description: rawText.trim() };
        usedAI = true;
      }
    } catch {
      /* 未配置 AI 或调用失败，降级到本地规则 */
    }
    if (!parsed) parsed = parseJobText(rawText);

    form.setFieldsValue({
      title:       parsed.title       || form.getFieldValue('title')       || '',
      company:     parsed.company     || form.getFieldValue('company')     || '',
      department:  parsed.department  || form.getFieldValue('department')  || '',
      location:    parsed.location    || form.getFieldValue('location')    || '',
      job_id:      parsed.job_id      || form.getFieldValue('job_id')      || '',
      description: parsed.description || form.getFieldValue('description') || '',
    });
    setParsing(false);
    const found = [parsed.title, parsed.company, parsed.department, parsed.location, parsed.job_id]
      .filter(Boolean).length;
    message.success(usedAI
      ? `AI 精准识别完成，已提取 ${found} 个字段，请核对`
      : `识别完成，已提取 ${found} 个字段，请核对并补全`);
  }, [rawText, form]);

  // ── 批量模式：一键识别（优先 AI 精准识别，失败降级本地规则）──
  const handleParseBatch = useCallback(async () => {
    if (!rawText.trim()) {
      message.warning('请先粘贴岗位 JD 文本');
      return;
    }
    setParsing(true);
    let jobs = null;
    let usedAI = false;
    try {
      const aiJobs = await parseJobsWithAI(rawText);
      if (aiJobs?.length) {
        jobs = aiJobs;
        usedAI = true;
      }
    } catch {
      /* 降级到本地规则 */
    }
    if (!jobs) jobs = parseJobBatch(rawText);

    // 统一补全 locations；AI 模式再把原文切分段回填为 description（尽量保留完整 JD）
    let finalJobs = jobs.map(j => ({ ...j, locations: splitLocations(j.location || '') }));
    if (usedAI) {
      const segments = splitJobText(rawText);
      finalJobs = finalJobs.map((j, i) => ({ ...j, description: segments[i] || '' }));
    }
    setBatchJobs(finalJobs.map((j, i) => ({ ...j, _key: `${Date.now()}-${i}` })));
    setBatchParsed(true);
    setParsing(false);
    message.success(usedAI
      ? `AI 批量识别完成，共 ${finalJobs.length} 个岗位`
      : `批量识别完成，共识别到 ${finalJobs.length} 个岗位，请核对后保存`);
  }, [rawText]);

  // ── 全屏编辑 ──
  const toggleFullscreen = useCallback(() => {
    if (!fullscreen) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      setFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setFullscreen(false);
    }
  }, [fullscreen]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) setFullscreen(false);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // ── 单个模式：保存 / 草稿 ──
  const handleFinish = (values) => {
    const locations = splitLocations(values.location || '');
    onSave?.({ ...values, locations, raw_text: rawText });
  };
  const handleDraft = () => {
    const values = form.getFieldsValue();
    const locations = splitLocations(values.location || '');
    onSaveDraft?.({ ...values, locations, raw_text: rawText });
  };

  // ── 批量模式：编辑单元格 ──
  const startEdit = (index, field) => setEditingCell({ index, field });

  const commitEdit = (index, field, value) => {
    setBatchJobs(prev => {
      const next = [...prev];
      const update = { [field]: value };
      // 编辑地点时同步拆分 locations
      if (field === 'location') {
        update.locations = splitLocations(value);
      }
      next[index] = { ...next[index], ...update };
      return next;
    });
    setEditingCell(null);
  };

  const cancelEdit = () => setEditingCell(null);

  /** 删除批量列表中的某一项 */
  const removeBatchJob = (idx) => {
    setBatchJobs(prev => prev.filter((_, i) => i !== idx));
  };

  /** 批量模式：一键保存全部 */
  const handleBatchSaveAll = (isDraft = false) => {
    if (batchJobs.length === 0) {
      message.warning('没有可保存的岗位');
      return;
    }
    onSave?.(batchJobs.map(j => {
      const { _key, ...rest } = j;
      return { ...rest, is_draft: isDraft };
    }));
  };

  /** 重置批量录入 */
  const resetBatch = () => {
    setBatchJobs([]);
    setBatchParsed(false);
    setRawText('');
  };

  // ── 批量模式下的可编辑单元格渲染 ──
  const renderEditableCell = (text, record, index, field, placeholder) => {
    const isEditing = editingCell?.index === index && editingCell?.field === field;

    if (isEditing) {
      return (
        <Input
          size="small"
          autoFocus
          defaultValue={text}
          onPressEnter={e => commitEdit(index, field, e.target.value)}
          onBlur={e => commitEdit(index, field, e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') cancelEdit(); }}
          style={{ width: '100%' }}
        />
      );
    }

    return (
      <div
        onClick={() => startEdit(index, field)}
        style={{
          cursor: 'pointer',
          minHeight: 22,
          padding: '2px 4px',
          borderRadius: 4,
          border: '1px solid transparent',
          transition: 'border-color 0.2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#d9d9d9'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; }}
      >
        {text || <Text type="secondary" style={{ fontSize: 12 }}>{placeholder}</Text>}
      </div>
    );
  };

  // ── 批量模式表格列定义 ──
  const batchColumns = [
    {
      title: '#',
      key: 'idx',
      width: 40,
      render: (_, __, idx) => <Text type="secondary">{idx + 1}</Text>,
    },
    {
      title: '岗位名称', dataIndex: 'title', width: 160,
      render: (text, record, idx) => renderEditableCell(text, record, idx, 'title', '点击填写岗位名称'),
    },
    {
      title: '公司', dataIndex: 'company', width: 120,
      render: (text, record, idx) => renderEditableCell(text, record, idx, 'company', '点击填写公司'),
    },
    {
      title: '部门', dataIndex: 'department', width: 120,
      render: (text, record, idx) => renderEditableCell(text, record, idx, 'department', '点击填写部门'),
    },
    {
      title: 'Base地点', dataIndex: 'location', width: 100,
      render: (text, record, idx) => renderEditableCell(text, record, idx, 'location', '点击填写地点'),
    },
    {
      title: '岗位ID', dataIndex: 'job_id', width: 120,
      render: (text, record, idx) => renderEditableCell(text, record, idx, 'job_id', '点击填写岗位ID'),
    },
    {
      title: '详情预览', dataIndex: 'description', width: 160, ellipsis: true,
      render: (text) => (
        <Tooltip title={text} placement="topLeft" overlayStyle={{ maxWidth: 500 }}>
          <Text style={{ fontSize: 12 }} ellipsis>
            {text?.slice(0, 40) || '-'}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: '操作', key: 'actions', width: 60, fixed: 'right',
      render: (_, __, idx) => (
        <Popconfirm
          title="移除此岗位？"
          onConfirm={() => removeBatchJob(idx)}
          okText="移除"
          cancelText="取消"
        >
          <Button size="small" type="link" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  // ── 公共：粘贴区域 ──
  const pasteCard = (
    <Card
      title={
        <Space>
          <FileTextOutlined />
          <span>粘贴岗位 JD</span>
          {mode === 'batch' && <Tag color="orange">批量模式</Tag>}
        </Space>
      }
      style={{ marginBottom: 24 }}
      styles={{ body: { padding: 20 } }}
    >
      <TextArea
        value={rawText}
        onChange={e => setRawText(e.target.value)}
        placeholder={
          mode === 'batch'
            ? '在此粘贴多个岗位的完整内容…\n\n系统会自动切分并分别识别每个岗位\n支持以下分隔格式：\n· 岗位名称 / 职位名称 多次出现\n· 数字编号（1. 2. 3. 或 一、二、三、）\n· 分隔线（———— / ════）\n· 【岗位1】【岗位2】等标记\n\n每个岗位请包含：岗位名称、公司、部门、Base地点等信息'
            : '在此粘贴官网岗位的完整文字内容…\n\n系统会尝试自动识别：岗位名称、公司、部门、Base地点、岗位ID\n支持常见 JD 格式，识别后请核对并补全'
        }
        rows={mode === 'batch' ? 18 : 10}
        maxLength={100000}
        showCount
        style={{ marginBottom: 12 }}
      />
      <Space>
        <Button
          type="primary"
          icon={<ThunderboltOutlined />}
          onClick={mode === 'batch' ? handleParseBatch : handleParseSingle}
          loading={parsing}
          size="large"
        >
          一键识别
        </Button>
        {mode === 'batch' && batchParsed && (
          <Button icon={<ClearOutlined />} onClick={resetBatch}>
            清空重新识别
          </Button>
        )}
        <Text type="secondary" style={{ marginLeft: 8 }}>
          {mode === 'batch'
            ? '可粘贴多个岗位，系统自动切分并分别提取字段'
            : '系统根据关键词自动提取字段，请核对后保存'}
        </Text>
      </Space>
    </Card>
  );

  // ── 单个模式：表单 ──
  const singleForm = (
    <Spin spinning={parsing} tip="正在识别…">
      <Card
        title={
          <Space>
            <span>岗位信息</span>
            {isEdit && <Text type="secondary">（编辑模式）</Text>}
          </Space>
        }
        styles={{ body: { padding: 20 } }}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={initialValues}
          onFinish={handleFinish}
          requiredMark="optional"
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 16px' }}>
            <Form.Item
              label="岗位名称"
              name="title"
              rules={[{ required: true, message: '请输入岗位名称' }]}
            >
              <Input placeholder="例如：前端开发工程师" />
            </Form.Item>

            <Form.Item
              label="岗位公司"
              name="company"
              rules={[{ required: true, message: '请输入公司名称' }]}
            >
              <Input placeholder="例如：字节跳动" />
            </Form.Item>

            <Form.Item label="岗位ID" name="job_id">
              <Input placeholder="官网岗位编号（可选）" />
            </Form.Item>

            <Form.Item label="岗位部门" name="department">
              <Input placeholder="例如：抖音 / 基础架构" />
            </Form.Item>

            <Form.Item label="Base 地点" name="location">
              <Input placeholder="例如：北京 / 上海 / 深圳" />
            </Form.Item>

            <Form.Item label="官网链接" name="url">
              <Input placeholder="https://... （可选，列表/详情页可点击跳转）" />
            </Form.Item>
          </div>

          <Form.Item label="岗位详情" name="description">
            <TextArea
              rows={fullscreen ? 30 : 5}
              autoSize={fullscreen ? false : { minRows: 4, maxRows: 8 }}
              placeholder="岗位描述、部门介绍、任职要求等全文内容"
              style={{ fontFamily: 'inherit' }}
            />
          </Form.Item>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <Space>
              <Button type="primary" htmlType="submit" icon={<SaveOutlined />} size="large">
                保存
              </Button>
              <Button onClick={handleDraft} icon={<FileTextOutlined />}>
                保存草稿
              </Button>
              <Button
                onClick={toggleFullscreen}
                icon={fullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
              >
                {fullscreen ? '退出全屏' : '全屏编辑'}
              </Button>
            </Space>
            <Space>
              {isEdit && (
                <Button danger icon={<DeleteOutlined />} onClick={onDelete}>
                  删除
                </Button>
              )}
              <Button icon={<RollbackOutlined />} onClick={onCancel}>
                取消
              </Button>
            </Space>
          </div>
        </Form>
      </Card>
    </Spin>
  );

  // ── 批量模式：解析结果 ──
  const batchResult = batchParsed && (
    <Card
      title={
        <Space>
          <span>识别结果</span>
          <Tag color="blue">{batchJobs.length} 个岗位</Tag>
          <Text type="secondary" style={{ fontSize: 13 }}>
            · 点击单元格可直接编辑 · 悬停显示编辑框 · 回车确认
          </Text>
        </Space>
      }
      extra={
        <Space>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={() => handleBatchSaveAll(false)}
            disabled={batchJobs.length === 0}
          >
            一键保存全部
          </Button>
          <Button
            icon={<FileTextOutlined />}
            onClick={() => handleBatchSaveAll(true)}
            disabled={batchJobs.length === 0}
          >
            全部存为草稿
          </Button>
        </Space>
      }
      styles={{ body: { padding: 0 } }}
    >
      <Table
        columns={batchColumns}
        dataSource={batchJobs}
        rowKey="_key"
        size="small"
        pagination={batchJobs.length > 20 ? { defaultPageSize: 20 } : false}
        scroll={{ x: 880 }}
        locale={{ emptyText: '无识别结果' }}
      />
      <div style={{ padding: '12px 20px', borderTop: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between' }}>
        <Text type="secondary" style={{ fontSize: 13 }}>
          💡 点击单元格即可编辑，按 Enter 确认，Esc 取消。编辑后的内容会直接保存到本地。
        </Text>
        <Button
          type="primary"
          size="large"
          icon={<SaveOutlined />}
          onClick={() => handleBatchSaveAll(false)}
          disabled={batchJobs.length === 0}
        >
          一键保存全部（{batchJobs.length}）
        </Button>
      </div>
    </Card>
  );

  // ── 渲染 ──
  return (
    <div style={{ maxWidth: mode === 'batch' ? 1100 : 1200, margin: '0 auto' }}>
      <Tabs
        activeKey={mode}
        onChange={key => {
          setMode(key);
          setBatchParsed(false);
          setBatchJobs([]);
        }}
        items={[
          { key: 'single', label: <span><PlusOutlined /> 单个录入</span> },
          { key: 'batch',  label: <span><ThunderboltOutlined /> 批量录入</span> },
        ]}
        style={{ marginBottom: 16 }}
      />

      {mode === 'single' ? (
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <div style={{ flex: '0 0 33.333%', minWidth: 0 }}>{pasteCard}</div>
          <div style={{ flex: 1, minWidth: 0 }}>{singleForm}</div>
        </div>
      ) : (
        <>
          {pasteCard}
          {batchResult}
        </>
      )}
    </div>
  );
}
