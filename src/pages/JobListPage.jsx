import { useState, useEffect, useCallback } from 'react';
import { Button, message, Modal, Checkbox, Select, Divider, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getJobs, deleteJob, updateJob } from '../api/storage';
import { STATUS_FIELDS } from '../utils/constants';
import FilterPanel from '../components/FilterPanel';
import JobTable from '../components/JobTable';
import CompareModal from '../components/CompareModal';
import TodoPanel from '../components/TodoPanel';

const { Text } = Typography;

export default function JobListPage() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [filters, setFilters] = useState({});
  const [loading, setLoading] = useState(false);

  // 分页状态持久化到 localStorage，从详情页/官网返回时保持页码
  const [page, setPage] = useState(() => {
    const p = localStorage.getItem('qiuzhao_list_page');
    return p ? parseInt(p, 10) : 1;
  });
  const [pageSize, setPageSize] = useState(() => {
    const p = localStorage.getItem('qiuzhao_list_pageSize');
    return p ? parseInt(p, 10) : 20;
  });

  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchIds, setBatchIds] = useState([]);
  const [batchStatus, setBatchStatus] = useState({});
  const [batchResult, setBatchResult] = useState(undefined);
  const [saving, setSaving] = useState(false);
  const [tableKey, setTableKey] = useState(0);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareJobs, setCompareJobs] = useState([]);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getJobs(filters);
      setJobs(data);
    } catch (err) {
      message.error('加载岗位失败: ' + err.message);
    }
    setLoading(false);
  }, [filters]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // 列表加载后，若当前页码超出范围则回退到最后一页
  useEffect(() => {
    if (jobs.length === 0) return;
    const maxPage = Math.max(1, Math.ceil(jobs.length / pageSize));
    if (page > maxPage) {
      setPage(maxPage);
      localStorage.setItem('qiuzhao_list_page', String(maxPage));
    }
  }, [jobs, page, pageSize]);

  const handlePageChange = (p, ps) => {
    setPage(p);
    setPageSize(ps);
    localStorage.setItem('qiuzhao_list_page', String(p));
    localStorage.setItem('qiuzhao_list_pageSize', String(ps));
  };

  const handleStatusChange = async (id, field, value) => {
    try {
      await updateJob(id, { [field]: value });
      fetchJobs();
    } catch (err) {
      message.error('更新状态失败: ' + err.message);
    }
  };

  const handleFilter = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const handleReset = () => setFilters({});

  const handleCompare = (jobs) => {
    setCompareJobs(jobs);
    setCompareOpen(true);
  };

  const handleBatchDelete = async (ids) => {
    try {
      await Promise.all(ids.map(id => deleteJob(id)));
      message.success(`已删除 ${ids.length} 个岗位`);
      setTableKey(k => k + 1);
      fetchJobs();
    } catch (err) {
      message.error('批量删除失败: ' + err.message);
    }
  };

  const handleBatchEdit = (selectedIds) => {
    setBatchIds(selectedIds);
    setBatchStatus({});
    setBatchResult(undefined);
    setBatchModalOpen(true);
  };

  const handleBatchApply = async () => {
    const updates = {};
    STATUS_FIELDS.forEach(f => {
      if (batchStatus[f.key] !== undefined) updates[f.key] = batchStatus[f.key];
    });
    if (batchResult) updates.result = batchResult;

    if (Object.keys(updates).length === 0) {
      message.warning('请至少选择一项要修改的内容');
      return;
    }

    setSaving(true);
    try {
      await Promise.all(batchIds.map(id => updateJob(id, updates)));
      message.success(`已批量更新 ${batchIds.length} 个岗位`);
      setBatchModalOpen(false);
      setTableKey(k => k + 1);
      fetchJobs();
    } catch (err) {
      message.error('批量更新失败: ' + err.message);
    }
    setSaving(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>岗位列表</h2>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/create')}
          style={{
            width: '15cm',
            height: '1cm',
            fontSize: 16,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          添加岗位
        </Button>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <FilterPanel filters={filters} onFilter={handleFilter} onReset={handleReset} />

          <JobTable
            key={tableKey}
            jobs={jobs}
            onBatchEdit={handleBatchEdit}
            onBatchDelete={handleBatchDelete}
            onCompare={handleCompare}
            onRefresh={fetchJobs}
            loading={loading}
            onStatusChange={handleStatusChange}
            currentPage={page}
            pageSize={pageSize}
            onPageChange={handlePageChange}
          />
        </div>

        <TodoPanel jobs={jobs} />
      </div>

      <Modal
        title={`批量编辑 · ${batchIds.length} 个岗位`}
        open={batchModalOpen}
        onOk={handleBatchApply}
        onCancel={() => setBatchModalOpen(false)}
        okText="应用修改"
        cancelText="取消"
        confirmLoading={saving}
        width={520}
        destroyOnClose
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          勾选的项将设为「是」，未勾选的项保持原状不修改
        </Text>
        <div style={{ marginBottom: 8 }}>
          <Text strong>投递状态</Text>
          <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>（勾选 = 设为已完成）</Text>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px 0', marginBottom: 16 }}>
          {STATUS_FIELDS.map(f => (
            <Checkbox
              key={f.key}
              checked={batchStatus[f.key] || false}
              onChange={e => setBatchStatus(prev => ({ ...prev, [f.key]: e.target.checked ? true : undefined }))}
            >
              {f.label}
            </Checkbox>
          ))}
        </div>
        <Divider style={{ margin: '12px 0' }} />
        <div style={{ marginBottom: 8 }}>
          <Text strong>结果</Text>
          <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>（留空则不修改）</Text>
        </div>
        <Select
          placeholder="不修改"
          value={batchResult}
          onChange={setBatchResult}
          allowClear
          style={{ width: '100%' }}
          options={[
            { value: 'pending', label: '进行中' },
            { value: 'failed', label: '已挂' },
            { value: 'offered', label: '已Offer' },
          ]}
        />
      </Modal>

      <CompareModal
        open={compareOpen}
        jobs={compareJobs}
        onClose={() => setCompareOpen(false)}
        onRefresh={fetchJobs}
      />
    </div>
  );
}
