import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { message, Modal } from 'antd';
import { createJob, createJobsBatch, getJob, updateJob, deleteJob } from '../api/storage';
import JobForm from '../components/JobForm';

export default function JobCreatePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [initialValues, setInitialValues] = useState(undefined);
  const [loading, setLoading] = useState(false);
  const isEdit = !!id;

  useEffect(() => {
    if (id) {
      (async () => {
        setLoading(true);
        try {
          const job = await getJob(id);
          if (job) {
            setInitialValues(job);
          } else {
            message.error('岗位不存在');
            navigate('/');
          }
        } catch (err) {
          message.error('加载失败: ' + err.message);
          navigate('/');
        }
        setLoading(false);
      })();
    }
  }, [id, navigate]);

  const handleSave = async (values) => {
    try {
      if (Array.isArray(values)) {
        const created = await createJobsBatch(values.map(v => ({ ...v, is_draft: false })));
        message.success(`已保存 ${created.length} 个岗位`);
        navigate('/');
      } else {
        if (isEdit) {
          await updateJob(id, { ...values, is_draft: false });
          message.success('保存成功');
          navigate(`/jobs/${id}`);
        } else {
          const job = await createJob({ ...values, is_draft: false });
          message.success('岗位已添加');
          navigate(`/jobs/${job.id}`);
        }
      }
    } catch (err) {
      message.error('保存失败: ' + err.message);
    }
  };

  const handleSaveDraft = async (values) => {
    try {
      if (Array.isArray(values)) {
        const created = await createJobsBatch(values.map(v => ({ ...v, is_draft: true })));
        message.success(`已保存 ${created.length} 个草稿`);
        navigate('/');
      } else {
        if (isEdit) {
          await updateJob(id, { ...values, is_draft: true });
          message.success('草稿已保存');
          navigate('/');
        } else {
          await createJob({ ...values, is_draft: true });
          message.success('草稿已保存');
          navigate('/');
        }
      }
    } catch (err) {
      message.error('保存失败: ' + err.message);
    }
  };

  const handleDelete = () => {
    Modal.confirm({
      title: '确定删除这个岗位吗？',
      content: '删除后无法恢复。',
      okText: '确定删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteJob(id);
          message.success('已删除');
          navigate('/');
        } catch (err) {
          message.error('删除失败: ' + err.message);
        }
      },
    });
  };

  const handleCancel = () => navigate(-1);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 80 }}>加载中…</div>;
  }

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 24 }}>
        {isEdit ? '编辑岗位' : '添加岗位'}
      </h2>
      <JobForm
        key={id || 'new'}
        initialValues={initialValues}
        onSave={handleSave}
        onSaveDraft={handleSaveDraft}
        onDelete={isEdit ? handleDelete : undefined}
        onCancel={handleCancel}
      />
    </div>
  );
}
