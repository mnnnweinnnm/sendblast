import { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Typography, message, Space } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import api from '../utils/api';

const { Title } = Typography;

export default function Lists() {
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try { const { data } = await api.get('/lists'); setLists(data.lists || []); } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const handleAdd = async (values) => {
    await api.post('/lists', values);
    message.success('名單已建立');
    setModalOpen(false);
    form.resetFields();
    load();
  };

  return (
    <AppLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>名單（標籤）</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>建立名單</Button>
      </div>

      {/* 名詞說明 */}
      <div style={{ background: '#f0f5ff', border: '1px solid #adc6ff', borderRadius: 8, padding: '12px 16px', marginBottom: 20 }}>
        <p style={{ margin: 0, fontSize: 13, color: '#333' }}>
          <strong>📋 名單（標籤）</strong>：用來「分組」你的聯絡人。<br/>
          例如「VIP會員」「新註冊用戶」「上次活動參加者」——建立好名單，發 Campaign 時選擇一個名單，系統就會寄給該名單內的所有人。<br/>
          <strong>📒 聯絡人</strong>：實際的 Email 地址，在「聯絡人」頁面管理和匯入。
        </p>
      </div>
      <Table dataSource={lists} rowKey="id" loading={loading}
        onRow={(r) => ({ onClick: () => navigate(`/lists/${r.id}`), style: { cursor: 'pointer' } })}
        columns={[
          { title: '名稱', dataIndex: 'name', key: 'name' },
          { title: '描述', dataIndex: 'description', key: 'desc' },
          { title: '聯絡人數', dataIndex: 'member_count', key: 'count' },
          { title: '建立時間', dataIndex: 'created_at', key: 'created', render: d => new Date(d).toLocaleDateString() },
        ]}
      />
      <Modal title="建立名單" open={modalOpen} onCancel={() => setModalOpen(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={handleAdd}>
          <Form.Item name="name" label="名稱" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea /></Form.Item>
        </Form>
      </Modal>
    </AppLayout>
  );
}
