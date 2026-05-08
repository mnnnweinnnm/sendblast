import { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, Upload, Typography, message, Select } from 'antd';
import { PlusOutlined, UploadOutlined } from '@ant-design/icons';
import AppLayout from '../components/AppLayout';
import api from '../utils/api';

const { Title } = Typography;

export default function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importListId, setImportListId] = useState(null);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const [contactsRes, listsRes] = await Promise.all([api.get('/contacts'), api.get('/lists')]);
      setContacts(contactsRes.data.contacts || []);
      setLists(listsRes.data.lists || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (values) => {
    await api.post('/contacts', values);
    message.success('聯絡人已新增');
    setModalOpen(false);
    form.resetFields();
    load();
  };

  const handleImport = async ({ file }) => {
    const fd = new FormData();
    fd.append('file', file);
    if (importListId) fd.append('list_id', importListId);
    try {
      const { data } = await api.post('/contacts/import', fd);
      message.success(`CSV 匯入完成：${data.imported} 筆，略過 ${data.skipped} 筆`);
      setImportOpen(false);
      setImportListId(null);
      load();
    } catch (err) {
      message.error(err.response?.data?.error || '匯入失敗');
    }
    return false;
  };

  const listOptions = lists.map(l => ({ label: `${l.name} (${l.member_count || l.contact_count || 0} 人)`, value: l.id }));

  const columns = [
    { title: 'Email', dataIndex: 'email', key: 'email' },
    { title: '名字', dataIndex: 'first_name', key: 'first_name' },
    { title: '姓氏', dataIndex: 'last_name', key: 'last_name' },
    { title: '狀態', dataIndex: 'status', key: 'status', render: s => ({ active: '✅ active', unsubscribed: '❌ unsubscribed', bounced: '↩ bounced' }[s] || s) },
    { title: '建立時間', dataIndex: 'created_at', key: 'created', render: d => new Date(d).toLocaleDateString() },
  ];

  return (
    <AppLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>聯絡人</Title>
        <Space>
          <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>匯入 CSV</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>新增聯絡人</Button>
        </Space>
      </div>
      <Table dataSource={contacts} rowKey="id" loading={loading} columns={columns} />

      <Modal title="新增聯絡人" open={modalOpen} onCancel={() => setModalOpen(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={handleAdd}>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}><Input /></Form.Item>
          <Form.Item name="first_name" label="名字"><Input /></Form.Item>
          <Form.Item name="last_name" label="姓氏"><Input /></Form.Item>
          <Form.Item name="phone" label="電話"><Input /></Form.Item>
          <Form.Item name="list_id" label="加入名單"><Select allowClear options={listOptions} placeholder="可選" /></Form.Item>
        </Form>
      </Modal>

      <Modal title="匯入 CSV" open={importOpen} onCancel={() => setImportOpen(false)} footer={null}>
        <p>CSV 至少需要 email 欄位，可包含 first_name、last_name。</p>
        <Select style={{ width: '100%', marginBottom: 16 }} allowClear placeholder="匯入到哪個名單（可選）" options={listOptions} value={importListId} onChange={setImportListId} />
        <Upload accept=".csv" maxCount={1} customRequest={handleImport}>
          <Button icon={<UploadOutlined />}>選擇 CSV 檔案</Button>
        </Upload>
      </Modal>
    </AppLayout>
  );
}
