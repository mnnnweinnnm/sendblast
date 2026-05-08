import { useState } from 'react';
import { Layout, Menu, Button, Typography, theme } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined, TeamOutlined, ShoppingCartOutlined, GlobalOutlined,
  DollarOutlined, LogoutOutlined
} from '@ant-design/icons';
import { getUser, logout } from '../utils/api';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

export default function AdminLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const user = getUser();
  const { token: { colorBgContainer } } = theme.useToken();

  const items = [
    { key: '/admin', icon: <DashboardOutlined />, label: '儀表板' },
    { key: '/admin/clients', icon: <TeamOutlined />, label: '客戶管理' },
    { key: '/admin/packages', icon: <ShoppingCartOutlined />, label: '額度套裝' },
    { key: '/admin/domains', icon: <GlobalOutlined />, label: '寄件網域' },
    { key: '/admin/orders', icon: <DollarOutlined />, label: '訂單' },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
        <div style={{ height: 48, margin: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Text strong style={{ color: '#fff', fontSize: collapsed ? 14 : 18 }}>SendBlast Admin</Text>
        </div>
        <Menu theme="dark" mode="inline" selectedKeys={[location.pathname]}
          items={items} onClick={({ key }) => navigate(key)} />
      </Sider>
      <Layout>
        <Header style={{ padding: '0 24px', background: colorBgContainer, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text strong>管理員：{user?.email}</Text>
          <Button type="text" icon={<LogoutOutlined />} onClick={() => { logout(); navigate('/login'); }}>登出</Button>
        </Header>
        <Content style={{ margin: 24, padding: 24, background: colorBgContainer, borderRadius: 8, overflow: 'auto' }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
