import { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, Space, Popconfirm, message, Typography } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import AppLayout from '../components/AppLayout';
import api from '../utils/api';
import { getUser } from '../utils/api';

const { Title } = Typography;

export default function TeamMembers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const me = getUser();

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/client-users');
      setUsers(data.users || []);
    } catch {
      message.error('載入失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (values) => {
    setSubmitting(true);
    try {
      await api.post('/client-users', values);
      message.success('已新增成員');
      setModalOpen(false);
      form.resetFields();
      loadUsers();
    } catch (err) {
      message.error(err.response?.data?.error || '新增失敗');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/client-users/${id}`);
      message.success('已移除');
      loadUsers();
    } catch (err) {
      message.error(err.response?.data?.error || '移除失敗');
    }
  };

  const columns = [
    { title: '姓名', dataIndex: 'name' },
    { title: 'Email', dataIndex: 'email' },
    {
      title: '角色',
      dataIndex: 'role',
      render: (r) => r === 'admin' ? '👑 管理員' : '💻 操作員',
    },
    {
      title: '建立時間',
      dataIndex: 'created_at',
      render: (v) => dayjs(v).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '',
      render: (_, r) => (
        <Popconfirm
          title="移除此成員？"
          onConfirm={() => handleDelete(r.id)}
          okText="移除"
          cancelText="取消"
        >
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Space style={{ justifyContent: 'space-between', width: '100%' }}>
        <Title level={4} style={{ margin: 0 }}>團隊成員</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          新增成員
        </Button>
      </Space>

      <Table
        columns={columns}
        dataSource={users}
        rowKey="id"
        loading={loading}
        pagination={false}
        size="middle"
      />

      <Modal
        title="新增成員"
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleAdd}>
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '必填' }]}>
            <Input placeholder="王小明" />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email', message: '請填有效 Email' }]}>
            <Input placeholder="wang@example.com" />
          </Form.Item>
          <Form.Item name="password" label="密碼" rules={[{ required: true, min: 6, message: '至少 6 字元' }]}>
            <Input.Password placeholder="暫時密碼" />
          </Form.Item>
          <Form.Item name="role" label="角色" initialValue="operator">
            <Select>
              <Select.Option value="admin">👑 管理員（可新增成員）</Select.Option>
              <Select.Option value="operator">💻 操作員</Select.Option>
            </Select>
          </Form.Item>
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={() => { setModalOpen(false); form.resetFields(); }}>取消</Button>
            <Button type="primary" htmlType="submit" loading={submitting}>新增</Button>
          </Space>
        </Form>
      </Modal>
    </Space>
  );
}
