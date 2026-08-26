import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Layout, Typography, Tabs, Grid } from 'antd';
import {
  UnorderedListOutlined, PlusCircleOutlined,
} from '@ant-design/icons';
import JobListPage from './pages/JobListPage';
import JobCreatePage from './pages/JobCreatePage';
import JobDetailPage from './pages/JobDetailPage';

const { Header, Content, Footer } = Layout;
const { Title } = Typography;
const { useBreakpoint } = Grid;

const tabItems = [
  { key: '/',       label: '岗位列表', icon: <UnorderedListOutlined /> },
  { key: '/create', label: '添加岗位', icon: <PlusCircleOutlined /> },
];

function AppHeader() {
  const location = useLocation();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const currentPath = location.pathname;

  // 详情页和编辑页不匹配主 tab，高亮列表
  const activeKey = tabItems.some(t => t.key === currentPath)
    ? currentPath
    : '/';

  return (
    <Header
      style={{
        background: '#fff',
        padding: isMobile ? '0 12px' : '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #f0f0f0',
        height: 56,
        lineHeight: '56px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 12 : 24, minWidth: 0 }}>
        <Title level={4} style={{ margin: 0, whiteSpace: 'nowrap', fontWeight: 700, fontSize: isMobile ? 15 : 18 }}>
          📋 秋招追踪
        </Title>
        <Tabs
          activeKey={activeKey}
          items={tabItems.map(item => ({
            key: item.key,
            label: <Link to={item.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {item.icon}{item.label}
            </Link>,
          }))}
          style={{ marginBottom: 0 }}
          tabBarStyle={{ marginBottom: 0 }}
          size={isMobile ? 'small' : 'middle'}
        />
      </div>
      {!isMobile && (
        <div>
          <span style={{ fontSize: 12, color: '#999' }}>
            数据存储在浏览器本地
          </span>
        </div>
      )}
    </Header>
  );
}

export default function App() {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  return (
    <HashRouter>
      <Layout style={{ minHeight: '100vh', background: '#f5f5f5' }}>
        <AppHeader />
        <Content style={{ padding: isMobile ? 12 : 24, maxWidth: 1400, width: '100%', margin: '0 auto' }}>
          <Routes>
            <Route path="/" element={<JobListPage />} />
            <Route path="/create" element={<JobCreatePage />} />
            <Route path="/jobs/:id" element={<JobDetailPage />} />
            <Route path="/jobs/:id/edit" element={<JobCreatePage />} />
          </Routes>
        </Content>
        <Footer style={{ textAlign: 'center', fontSize: 12, color: '#bbb' }}>
          秋招投递追踪系统 · 仅供个人使用 · 数据存储在浏览器本地
        </Footer>
      </Layout>
    </HashRouter>
  );
}
