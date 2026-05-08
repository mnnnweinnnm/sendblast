import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Typography, Tag, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import AdminLayout from '../components/AdminLayout';
import api from '../utils/api';

const { Title } = Typography;

export default function AdminClients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try { const { data } = await api.get('/client'); setClients(data.clients || []); } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleAdd = async (values) => {
    try {
      await api.post('/client', values);
      message.success('客戶已建立');
      setModalOpen(false);
      form.resetFields();
      load();
    } catch (err) { message.error(err.response?.data?.error || '建立失敗'); }
  };

  const handleToggle = async (id, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    await api.put(`/client/${id}`, { status: newStatus });
    message.success('狀態已更新');
    load();
  };

  return (
    <AdminLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>客戶管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>新增客戶</Button>
      </div>
      <Table dataSource={clients} rowKey="id" loading={loading}
        columns={[
          { title: '公司名稱', dataIndex: 'company_name', key: 'name' },
          { title: 'Email', dataIndex: 'email', key: 'email' },
          { title: '餘額', dataIndex: 'credit_balance', key: 'balance', render: v => v?.toLocaleString() },
          { title: '狀態', dataIndex: 'status', key: 'status', render: s => <Tag color={s === 'active' ? 'green' : 'red'}>{s}</Tag> },
          { title: '建立時間', dataIndex: 'created_at', key: 'created', render: d => new Date(d).toLocaleDateString() },
          { title: '操作', key: 'action', render: (_, r) => (
            <Button size="small" danger={r.status === 'active'} onClick={() => handleToggle(r.id, r.status)}>
              {r.status === 'active' ? '停用' : '啟用'}
            </Button>
          )},
        ]}
      />
      <Modal title="新增客戶" open={modalOpen} onCancel={() => setModalOpen(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={handleAdd}>
          <Form.Item name="company_name" label="公司名稱" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}><Input /></Form.Item>
          <Form.Item name="password" label="密碼" rules={[{ required: true, min: 6 }]}><Input.Password /></Form.Item>
        </Form>
      </Modal>
    </AdminLayout>
  );
}
