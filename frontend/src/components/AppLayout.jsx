import { useState } from 'react';
import { Layout, Menu, Button, Typography, theme } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined, MailOutlined, ContactsOutlined, UnorderedListOutlined,
  DollarOutlined, ShoppingCartOutlined, GlobalOutlined, LogoutOutlined
} from '@ant-design/icons';
import { getUser, logout } from '../utils/api';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

export default function AppLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const user = getUser();
  const { token: { colorBgContainer } } = theme.useToken();

  const menuItems = [
    { key: '/dashboard', icon: <DashboardOutlined />, label: '儀表板' },
    { key: '/campaigns', icon: <MailOutlined />, label: 'Campaign' },
    { key: '/contacts', icon: <ContactsOutlined />, label: '聯絡人' },
    { key: '/lists', icon: <UnorderedListOutlined />, label: '名單' },
    { key: '/pricing', icon: <DollarOutlined />, label: '購買額度' },
    { key: '/orders', icon: <ShoppingCartOutlined />, label: '訂單' },
    { key: '/domains', icon: <GlobalOutlined />, label: '寄件網域' },
  ];

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed}>
        <div style={{ height: 48, margin: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Text strong style={{ color: '#fff', fontSize: collapsed ? 14 : 18 }}>SendBlast</Text>
        </div>
        <Menu
          theme="dark" mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: '0 24px', background: colorBgContainer, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text strong>{user?.company_name || user?.name}</Text>
          <Button type="text" icon={<LogoutOutlined />} onClick={handleLogout}>登出</Button>
        </Header>
        <Content style={{ margin: 24, padding: 24, background: colorBgContainer, borderRadius: 8, overflow: 'auto' }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
