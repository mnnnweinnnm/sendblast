import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Typography, Tag, message, Space, Popconfirm } from 'antd';
import { PlusOutlined, ReloadOutlined, CheckCircleOutlined, DeleteOutlined } from '@ant-design/icons';
import AppLayout from '../components/AppLayout';
import AdminLayout from '../components/AdminLayout';
import api, { getUser } from '../utils/api';

const { Title } = Typography;

const statusTag = (s) => {
  const map = { pending: ['⏳', 'orange'], verified: ['✅', 'green'], failed: ['❌', 'red'] };
  const [icon, color] = map[s] || ['?', 'default'];
  return <Tag color={color}>{icon} {s || '-'}</Tag>;
};

export default function Domains() {
  const user = getUser();
  const isAdmin = user?.type === 'platform_admin';
  const Layout = isAdmin ? AdminLayout : AppLayout;
  const base = isAdmin ? '/admin/domains' : '/domains';

  const [domains, setDomains] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [dnsOpen, setDnsOpen] = useState(false);
  const [dnsRecords, setDnsRecords] = useState(null);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try { const { data } = await api.get(base); setDomains(data.domains || []); } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleAdd = async (values) => {
    try {
      const { data } = await api.post(base, values);
      const records = data.resend_records || data.records || data.domain?.records;
      if (records) { setDnsRecords(records); setDnsOpen(true); }
      message.success('網域已新增，請設定 DNS');
      setModalOpen(false);
      form.resetFields();
      load();
    } catch (err) { message.error(err.response?.data?.error || '新增失敗'); }
  };

  const handleVerify = async (id) => {
    try {
      const { data } = await api.post(`/admin/domains/${id}/verify`);
      if (data.records) { setDnsRecords(data.records); setDnsOpen(true); }
      message.success(`狀態：${data.domain?.status || 'updated'}`);
      load();
    } catch (err) { message.error(err.response?.data?.error || '驗證失敗'); }
  };
  const handleDelete = async (id) => {
    try { await api.delete(`/admin/domains/${id}`); message.success('已刪除'); load(); }
    catch (err) { message.error(err.response?.data?.error || '刪除失敗'); }
  };

  const adminColumns = isAdmin ? [{
    title: '操作', key: 'actions', render: (_, r) => (
      <Space>
        <Button size="small" icon={<CheckCircleOutlined />} onClick={() => handleVerify(r.id)}>驗證</Button>
        <Popconfirm title="刪除網域？" onConfirm={() => handleDelete(r.id)}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </Space>
    )
  }] : [];

  return (
    <Layout>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>寄件網域</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load}>重整</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>新增網域</Button>
        </Space>
      </div>
      <p style={{ color: '#666', marginBottom: 16 }}>
        填入你的網域後，系統會給你 DNS 設定指引。設定完成後點「驗證」，等待 Resend 確認（約 5-10 分鐘）。
        {isAdmin ? '驗證成功後即可供所有客戶使用。' : '驗證完成後即可在 Campaign 選用此網域寄信。'}
      </p>
      <Table dataSource={domains} rowKey="id" loading={loading}
        columns={[
          { title: '網域', dataIndex: 'domain', key: 'domain' },
          { title: '狀態', dataIndex: 'status', key: 'status', render: s => statusTag(s) },
          { title: 'DKIM', dataIndex: 'dkim_status', key: 'dkim', render: s => statusTag(s) },
          { title: 'SPF', dataIndex: 'spf_status', key: 'spf', render: s => statusTag(s) },
          { title: '驗證時間', dataIndex: 'verified_at', key: 'verified', render: d => d ? new Date(d).toLocaleDateString() : '-' },
          ...adminColumns,
        ]}
      />
      <Modal title="新增寄件網域" open={modalOpen} onCancel={() => setModalOpen(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={handleAdd}>
          <Form.Item name="domain" label="網域" rules={[{ required: true }]}>
            <Input placeholder="mail.yourdomain.com" />
          </Form.Item>
          <Form.Item name="from_name_default" label="預設寄件人名稱">
            <Input placeholder="Your Brand" />
          </Form.Item>
        </Form>
      </Modal>
      <Modal title="DNS 設定" open={dnsOpen} onCancel={() => setDnsOpen(false)} footer={null} width={760}>
        {dnsRecords && (
          <div>
            <p>請在 DNS 管理頁面新增以下記錄：</p>
            {dnsRecords.map((r, i) => (
              <div key={i} style={{ marginBottom: 12, padding: 8, background: '#f5f5f5', borderRadius: 4, wordBreak: 'break-all' }}>
                <p><strong>{r.type}</strong></p>
                <p>Name: {r.name}</p>
                <p>Value: {r.value}</p>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </Layout>
  );
}
