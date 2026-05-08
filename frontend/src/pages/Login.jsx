import { useState } from 'react';
import { Form, Input, Button, Card, Typography, message, Tabs } from 'antd';
import { MailOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api, { setAuth } from '../utils/api';

const { Title } = Typography;

export default function Login() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (values, type) => {
    setLoading(true);
    try {
      const endpoint = type === 'admin' ? '/auth/admin/login' : '/auth/login';
      const { data } = await api.post(endpoint, values);
      setAuth(data.token, data.user);
      message.success('登入成功');
      navigate(data.user.type === 'platform_admin' ? '/admin' : '/dashboard');
    } catch (err) {
      message.error(err.response?.data?.error || '登入失敗');
    } finally {
      setLoading(false);
    }
  };

  const LoginForm = ({ type }) => (
    <Form onFinish={(v) => handleLogin(v, type)} layout="vertical" size="large">
      <Form.Item name="email" rules={[{ required: true, message: '請輸入 Email' }]}>
        <Input prefix={<MailOutlined />} placeholder="Email" />
      </Form.Item>
      <Form.Item name="password" rules={[{ required: true, message: '請輸入密碼' }]}>
        <Input.Password prefix={<LockOutlined />} placeholder="密碼" />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading} block>
          {type === 'admin' ? '管理員登入' : '登入'}
        </Button>
      </Form.Item>
    </Form>
  );

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f0f2f5' }}>
      <Card style={{ width: 400, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
        <Title level={3} style={{ textAlign: 'center', marginBottom: 32 }}>SendBlast</Title>
        <Tabs centered items={[
          { key: 'client', label: '客戶登入', children: <LoginForm type="client" /> },
          { key: 'admin', label: '管理員', children: <LoginForm type="admin" /> },
        ]} />
      </Card>
    </div>
  );
}
