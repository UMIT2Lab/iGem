import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Layout, 
  Typography, 
  Button, 
  List, 
  Card, 
  Modal, 
  Form, 
  Input, 
  Space, 
  Divider,
  Empty
} from 'antd'
import { PlusOutlined, FolderOutlined, DeleteOutlined } from '@ant-design/icons'
import { useCases } from '../../context/CasesContext'
import iGemLogo from '../../assets/logo.png'

const { Content, Header } = Layout
const { Title, Text } = Typography

const CasesPage = () => {
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [form] = Form.useForm()
  const { cases, setCases, addCase, deleteCase } = useCases()
  const navigate = useNavigate()
  const [selectedCaseId, setSelectedCaseId] = useState(null)
  
  useEffect(() => {
    const fetchCases = async () => {
      try {
        const response = await window.electron.ipcRenderer.invoke('get-cases', 'device-id-placeholder');
        if (response.success) {
          setCases(response.data);
        } else {
          console.error('Failed to fetch cases:', response.error);
        }
      } catch (error) {
        console.error('Error fetching cases:', error);
      }
    };

    fetchCases();
  }, [setCases])

  const showModal = () => {
    setIsModalVisible(true)
  }

  const handleCancel = () => {
    form.resetFields()
    setIsModalVisible(false)
  }

  const handleCreate = () => {
    form.validateFields()
      .then(async (values) => {
        const newCase = {
          ...values,
          caseType: values.caseType || '',
          createdAt: new Date().toISOString(),
        };

        // Send the new case to the backend
        const response = await window.electron.ipcRenderer.invoke('add-case', newCase);

        if (response.success) {
          console.log('Case added successfully with ID:', response.id);
          form.resetFields();
          setIsModalVisible(false);
        } else {
          console.error('Failed to add case:', response.error);
        }
        try {
          const response = await window.electron.ipcRenderer.invoke('get-cases', 'device-id-placeholder');
          if (response.success) {
            setCases(response.data);
          } else {
            console.error('Failed to fetch cases:', response.error);
          }
        } catch (error) {
          console.error('Error fetching cases:', error);
        }
      })
      .catch((info) => {
        console.log('Validate Failed:', info);
      });
  }
  
  const handleCaseSelect = (caseId) => {
    setSelectedCaseId(caseId)
    console.log('Redirecting to map for case ID:', caseId)
    navigate(`/map/${caseId}`)
  }

  const handleCaseDelete = (e, caseId) => {
    e.stopPropagation(); // Prevent triggering the card click event
    Modal.confirm({
      title: 'Delete Case',
      content: 'Are you sure you want to delete this case? This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk() {
        deleteCase(caseId);
      },
    });
  };

  const [theme, setTheme] = useState({
    primary: '#1890ff',
    secondary: '#f0f2f5',
    accent: '#096dd9',
  });

  return (
    <Layout style={{ 
      minHeight: '100vh', 
      background: '#f5f8fa',
      margin: 0,
      padding: 0,
      overflow: 'hidden'
    }}>
      <Header 
        style={{ 
          background: '#A2C2E4', 
          padding: '0 16px', 
          display: 'flex', 
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.09)',
          margin: 0,
          height: '64px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <img 
            src={iGemLogo} 
            alt="iGem Logo" 
            style={{ height: '45px', marginRight: '16px'}} 
          />
        </div>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={showModal}
          style={{ 
            background: theme.primary, 
            borderColor: theme.accent,
            boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
          }}
        >
          New Case
        </Button>
      </Header>
      
      <Content style={{ 
        padding: '24px', 
        background: theme.secondary,
        margin: 0,
        overflow: 'auto'
      }}>
        {cases.length > 0 ? (
          <div style={{ marginBottom: '20px' }}>
            <Text type="secondary" style={{ fontSize: '16px', marginBottom: '20px', display: 'block' }}>
              Select a case to view and manage its contents
            </Text>
            <List
              grid={{
                gutter: 24,
                xs: 1,
                sm: 2,
                md: 3,
                lg: 3,
                xl: 4,
                xxl: 6,
              }}
              dataSource={cases}
              renderItem={item => (
                <List.Item>
                  <Card 
                    hoverable
                    onClick={() => handleCaseSelect(item.id)}
                    style={{ 
                      borderLeft: selectedCaseId === item.id ? `4px solid ${theme.primary}` : 'none',
                      transition: 'all 0.3s',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                      position: 'relative'
                    }}
                  >
                    <Button 
                      type="text" 
                      danger 
                      icon={<DeleteOutlined />}
                      onClick={(e) => handleCaseDelete(e, item.id)}
                      style={{ 
                        position: 'absolute', 
                        right: '5px', 
                        top: '5px', 
                        zIndex: 1
                      }}
                    />
                    <Space align="start">
                      <FolderOutlined style={{ 
                        fontSize: '28px', 
                        color: theme.primary,
                        background: `${theme.primary}15`,
                        padding: '8px',
                        borderRadius: '8px'
                      }} />
                      <div>
                        <Typography.Title level={4} style={{ margin: 0 }}>{item.name}</Typography.Title>
                        <Typography.Paragraph ellipsis={{ rows: 2 }} type="secondary" style={{ marginBottom: '5px' }}>
                          {item.description || "No description provided"}
                        </Typography.Paragraph>
                        <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                          Created: {new Date(item.createdAt).toLocaleDateString()}
                        </Typography.Text>
                        <Typography.Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>
                          Investigator: {item.investigatorName || 'N/A'}
                        </Typography.Text>
                        <Typography.Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>
                          Case Type: {item.caseType || 'N/A'}
                        </Typography.Text>
                      </div>
                    </Space>
                  </Card>
                </List.Item>
              )}
            />
          </div>
        ) : (
          <Empty
            description={
              <div>
                <Typography.Title level={4} style={{ color: theme.accent }}>No cases found</Typography.Title>
                <Typography.Paragraph>Create your first case to get started with your project</Typography.Paragraph>
              </div>
            }
            style={{
              margin: '100px auto',
              padding: '40px',
              background: 'white',
              borderRadius: '12px',
              maxWidth: '500px',
              boxShadow: '0 6px 20px rgba(0,0,0,0.05)'
            }}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button 
              type="primary" 
              onClick={showModal} 
              icon={<PlusOutlined />}
              size="large"
              style={{ 
                background: theme.primary, 
                borderColor: theme.accent,
                marginTop: '20px',
                height: '46px',
                borderRadius: '8px',
                fontSize: '16px'
              }}
            >
              Create First Case
            </Button>
          </Empty>
        )}
      </Content>

      <Modal
        title={<Typography.Title level={4} style={{ margin: 0, color: theme.accent }}>Create New Case</Typography.Title>}
        visible={isModalVisible}
        onCancel={handleCancel}
        onOk={handleCreate}
        okText="Create"
        okButtonProps={{ style: { background: theme.primary, borderColor: theme.accent } }}
        centered
        bodyStyle={{ padding: '20px' }}
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            name="investigatorName"
            label="Investigator Name"
            rules={[{ required: true, message: 'Please enter an investigator name' }]}
          >
            <Input placeholder="Enter investigator name" style={{ borderRadius: '6px', height: '40px' }} />
          </Form.Item>
          <Form.Item
            name="caseType"
            label="Case Type"
            rules={[{ required: false, message: 'Please enter a case type' }]}
          >
            <Input placeholder="Enter case type" style={{ borderRadius: '6px', height: '40px' }} />
          </Form.Item>
          <Form.Item
            name="name"
            label="Case Name"
            rules={[{ required: true, message: 'Please enter a name for this case' }]}
          >
            <Input placeholder="Enter case name" style={{ borderRadius: '6px', height: '40px' }} />
          </Form.Item>
          <Form.Item
            name="description"
            label="Description"
          >
            <Input.TextArea 
              placeholder="Optional case description" 
              rows={4} 
              style={{ borderRadius: '6px' }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  )
}

export default CasesPage
