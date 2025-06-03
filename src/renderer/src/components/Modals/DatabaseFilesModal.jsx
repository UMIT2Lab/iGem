import React, { useState, useEffect } from 'react'
import { Modal, Upload, Button, Space, Typography, message, Input, Form, Alert, Progress } from 'antd'
import { InboxOutlined, CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined } from '@ant-design/icons'
import ProcessingStepsView from './ProcessingStepsView'

const { Dragger } = Upload
const { Title, Text, Paragraph } = Typography

const DatabaseFilesModal = ({ visible, onCancel, onSubmit, caseId }) => {
  const [knowledgeCFile, setKnowledgeCFile] = useState(null)
  const [cacheFile, setCacheFile] = useState(null)
  const [deviceName, setDeviceName] = useState('')
  const [processing, setProcessing] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [processingComplete, setProcessingComplete] = useState(false)
  const [processingResults, setProcessingResults] = useState({
    deviceId: null,
    deviceName: '',
    cache: null,
    knowledgeC: null
  })
  const [processingStatus, setProcessingStatus] = useState({
    device: { status: 'pending' },
    cache: { status: 'pending' },
    knowledgeC: { status: 'pending' }
  })

  // Custom steps for database processing
  const databaseProcessingSteps = [
    { title: 'Save Device Info', description: 'Saving device information to the database', key: 1 },
    { title: 'Process Location Data', description: 'Processing GPS location data from Cache.sqlite', key: 2 },
    { title: 'Process App Usage', description: 'Processing app usage data from KnowledgeC.db', key: 3 },
    { title: 'Finish', description: 'Completing database processing', key: 4 }
  ]

  // Listen for database processing updates from main process
  useEffect(() => {
    if (!processing) return;

    const handleProcessingUpdate = (event, update) => {
      console.log('Processing update:', update);
      
      // Update the processing status based on the step
      setProcessingStatus(prevStatus => ({
        ...prevStatus,
        [update.step]: {
          status: update.status,
          message: update.message,
          error: update.error,
          result: update.result
        }
      }));
      
      // Show appropriate messages based on status
      if (update.status === 'error') {
        message.error(`Error processing ${update.step} database: ${update.error}`);
      } else if (update.status === 'completed' && update.result?.count) {
        message.success(`Processed ${update.result.count} records from ${update.step} database`);
      }
      
      // Update current step in the UI
      if (update.step === 'device' && update.status === 'started') {
        setCurrentStep(0);
      } else if (update.step === 'cache' && update.status === 'started') {
        setCurrentStep(1);
      } else if (update.step === 'knowledgeC' && update.status === 'started') {
        setCurrentStep(2);
      }
      
      // Check if all steps are completed
      const allCompleted = checkAllStepsCompleted(update, prevStatus => ({
        ...prevStatus,
        [update.step]: { status: update.status }
      }));
      
      if (allCompleted) {
        setCurrentStep(3); // Set to final step
      }
    };
    
    window.electron.ipcRenderer.on('database-processing-update', handleProcessingUpdate);
    
    return () => {
      window.electron.ipcRenderer.removeListener('database-processing-update', handleProcessingUpdate);
    };
  }, [processing, cacheFile, knowledgeCFile]);
  
  // Helper function to check if all required steps are completed
  const checkAllStepsCompleted = (update, getUpdatedStatus) => {
    const updatedStatus = getUpdatedStatus(processingStatus);
    
    const deviceCompleted = updatedStatus.device.status === 'completed';
    const cacheCompleted = !cacheFile || updatedStatus.cache.status === 'completed' || updatedStatus.cache.status === 'error';
    const knowledgeCCompleted = !knowledgeCFile || updatedStatus.knowledgeC.status === 'completed' || updatedStatus.knowledgeC.status === 'error';
    
    return deviceCompleted && cacheCompleted && knowledgeCCompleted;
  };

  const handleSubmit = async () => {
    if (!deviceName.trim()) {
      message.error('Please enter a device name');
      return;
    }

    if (!knowledgeCFile && !cacheFile) {
      message.error('Please upload at least one database file');
      return;
    }
    
    setProcessing(true);
    setProcessingComplete(false);
    setCurrentStep(0);
    setProcessingStatus({
      device: { status: 'pending' },
      cache: { status: 'pending' },
      knowledgeC: { status: 'pending' }
    });
    
    try {
      // Step 1: Save device info
      setProcessingStatus(prev => ({
        ...prev,
        device: { status: 'started', message: 'Creating device record...' }
      }));
      console.log('Adding device with name:', deviceName, 'and caseId:', caseId);
      const deviceResult = await window.electron.ipcRenderer.invoke('add-device', {
        name: deviceName,
        created_at: new Date().toISOString(),
        caseId // Include the caseId here
      });
      
      if (!deviceResult.success) {
        throw new Error(`Failed to add device: ${deviceResult.error}`);
      }
      
      setProcessingStatus(prev => ({
        ...prev,
        device: { status: 'completed', result: deviceResult }
      }));
      
      setProcessingResults(prev => ({
        ...prev,
        deviceId: deviceResult.id
      }));
      
      // Step 2 & 3: Process databases
      // Prepare the data with proper file paths
      const processData = {
        deviceId: deviceResult.id // Just send the ID, not an object
      };
      
      // Only include the files we have, with their full path information
      if (knowledgeCFile) {
        processData.knowledgeCFile = {
          path: knowledgeCFile.path || knowledgeCFile.originFileObj?.path,
          name: knowledgeCFile.name
        };
      }
      
      if (cacheFile) {
        processData.cacheFile = {
          path: cacheFile.path || cacheFile.originFileObj?.path,
          name: cacheFile.name
        };
      }
      
      console.log('Sending process data:', processData);
      
      const result = await window.electron.ipcRenderer.invoke('process-database-files', processData);
      
      if (!result.success) {
        throw new Error(`Failed to process databases: ${result.error}`);
      }
      
      // Wait a moment to show completion
      setTimeout(() => {
        message.success('Database processing completed successfully');
        
        // Store the results but don't close the modal yet
        setProcessingResults({
          deviceId: deviceResult.id,
          deviceName,
          knowledgeCResult: result.knowledgeC,
          cacheResult: result.cache
        });
        
        // Mark processing as complete, but keep the modal open
        setProcessing(false);
        setProcessingComplete(true);
      }, 1000);
      
    } catch (error) {
      console.error('Error processing database files:', error);
      message.error(`Error processing files: ${error.message}`);
      setProcessing(false);
      setProcessingComplete(false);
    }
  };

  // Handle the final submission when user clicks "Done"
  const handleFinishAndClose = () => {
    // Pass the results to the parent component
    onSubmit(processingResults);
    
    // Reset the state
    setKnowledgeCFile(null);
    setCacheFile(null);
    setDeviceName('');
    setCurrentStep(0);
    setProcessingComplete(false);
  };

  const uploadProps = (fileType) => ({
    onRemove: () => {
      if (fileType === 'knowledgeC') {
        setKnowledgeCFile(null);
      } else {
        setCacheFile(null);
      }
    },
    beforeUpload: (file) => {
      // Store the full file object with path information
      console.log('File object:', file);
      
      if (fileType === 'knowledgeC') {
        // In Electron, the file object should have path property
        setKnowledgeCFile({
          ...file,
          path: file.path || window.electron.path?.resolve(file.path) || file.name
        });
      } else {
        setCacheFile({
          ...file,
          path: file.path || window.electron.path?.resolve(file.path) || file.name
        });
      }
      return false; // Prevent auto upload
    },
    fileList: fileType === 'knowledgeC' 
      ? (knowledgeCFile ? [knowledgeCFile] : []) 
      : (cacheFile ? [cacheFile] : [])
  });
  
  // Render processing status details
  const renderProcessingStatus = () => {
    return (
      <Space direction="vertical" style={{ width: '100%', marginTop: '20px' }}>
        {Object.entries(processingStatus).map(([key, status]) => {
          if ((key === 'cache' && !cacheFile) || (key === 'knowledgeC' && !knowledgeCFile)) {
            return null;
          }
          
          const getStatusIcon = () => {
            if (status.status === 'completed') return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
            if (status.status === 'error') return <CloseCircleOutlined style={{ color: '#f5222d' }} />;
            if (status.status === 'started') return <LoadingOutlined style={{ color: '#1890ff' }} />;
            return null;
          };
          
          return (
            <div key={key} style={{ marginBottom: '8px' }}>
              <Space>
                {getStatusIcon()}
                <Text strong>{key === 'device' ? 'Device Creation' : key === 'cache' ? 'Location Data' : 'App Usage Data'}</Text>
                <Text type={status.status === 'error' ? 'danger' : 'secondary'}>
                  {status.message || (status.status === 'completed' ? 'Completed' : status.status === 'error' ? 'Error' : 'Pending')}
                </Text>
              </Space>
              
              {status.status === 'completed' && status.result?.count && (
                <Text type="success" style={{ marginLeft: '24px', display: 'block' }}>
                  Processed {status.result.count} records successfully
                </Text>
              )}
              
              {status.status === 'error' && status.error && (
                <Alert 
                  message="Processing Error" 
                  description={status.error} 
                  type="error" 
                  showIcon 
                  style={{ marginTop: '8px' }} 
                />
              )}
            </div>
          );
        })}
      </Space>
    );
  };

  return (
    <Modal
      title={processing ? "Processing Database Files" : processingComplete ? "Processing Complete" : "Upload Database Files"}
      open={visible}
      onCancel={processing ? null : onCancel}
      width={700}
      footer={[
        processing ? null : (
          <Button key="cancel" onClick={onCancel}>
            Cancel
          </Button>
        ),
        processingComplete ? (
          <Button key="done" type="primary" onClick={handleFinishAndClose}>
            Done
          </Button>
        ) : !processing ? (
          <Button key="submit" type="primary" onClick={handleSubmit}>
            Upload
          </Button>
        ) : null
      ]}
      closable={!processing}
    >
      {processing || processingComplete ? (
        <>
          <ProcessingStepsView currentStep={currentStep} steps={databaseProcessingSteps} />
          {renderProcessingStatus()}
          
          {processingComplete && (
            <Alert 
              message="Processing Complete" 
              description="All database files have been processed successfully. Click 'Done' to continue."
              type="success"
              showIcon
              style={{ marginTop: '16px' }}
            />
          )}
        </>
      ) : (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <Title level={5}>Device Name</Title>
            <Form.Item 
              rules={[{ required: true, message: 'Please enter a device name' }]}
            >
              <Input
                placeholder="Enter device name"
                value={deviceName}
                onChange={e => setDeviceName(e.target.value)}
              />
            </Form.Item>
          </div>

          <div>
            <Title level={5}>KnowledgeC Database</Title>
            <Dragger {...uploadProps('knowledgeC')} accept=".sqlite,.db">
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">Click or drag KnowledgeC.db file to upload</p>
              <p className="ant-upload-hint">
                Located in /private/var/mobile/Library/CoreDuet/Knowledge/
              </p>
            </Dragger>
          </div>

          <div>
            <Title level={5}>Cache.sqlite Database</Title>
            <Dragger {...uploadProps('cache')} accept=".sqlite,.db">
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">Click or drag Cache.sqlite file to upload</p>
              <p className="ant-upload-hint">
                Located in /private/var/mobile/Library/Caches/
              </p>
            </Dragger>
          </div>
          
          <Text type="secondary">
            These database files will be processed to extract location data for forensic analysis.
          </Text>
        </Space>
      )}
    </Modal>
  );
};

export default DatabaseFilesModal;
