import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Typography, message, Space } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import AdminLayout from '../components/AdminLayout';
import api from '../utils/api';

const { Title } = Typography;

export default function AdminPackages() {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try { const { data } = await api.get('/admin/packages'); setPackages(data.packages || []); } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleAdd = async (values) => {
    try {
      await api.post('/admin/packages', values);
      message.success('套裝已新增');
      setModalOpen(false);
      form.resetFields();
      load();
    } catch (err) { message.error(err.response?.data?.error || '新增失敗'); }
  };

  const handleDelete = async (id) => {
    await api.delete(`/admin/packages/${id}`);
    message.success('已刪除');
    load();
  };

  return (
    <AdminLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>額度套裝</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>新增套裝</Button>
      </div>
      <Table dataSource={packages} rowKey="id" loading={loading}
        columns={[
          { title: '名稱', dataIndex: 'name', key: 'name' },
          { title: '封數', dataIndex: 'credits', key: 'credits', render: v => v?.toLocaleString() },
          { title: '價格', dataIndex: 'price_usdt', key: 'price', render: v => `$${v} USDT` },
          { title: '狀態', dataIndex: 'status', key: 'status' },
          { title: '操作', key: 'action', render: (_, r) => (
            <Button size="small" danger onClick={() => handleDelete(r.id)}>刪除</Button>
          )},
        ]}
      />
      <Modal title="新增套裝" open={modalOpen} onCancel={() => setModalOpen(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={handleAdd}>
          <Form.Item name="name" label="名稱" rules={[{ required: true }]}><Input placeholder="Starter" /></Form.Item>
          <Form.Item name="credits" label="封數" rules={[{ required: true }]}><InputNumber min={100} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="price_usdt" label="價格 (USDT)" rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>
    </AdminLayout>
  );
}
