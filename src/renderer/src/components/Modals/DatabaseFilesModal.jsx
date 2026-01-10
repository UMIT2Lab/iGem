import React, { useState, useEffect } from 'react'
import { Modal, Upload, Button, Space, Typography, message, Input, Form, Alert, Progress } from 'antd'
import { InboxOutlined, CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined } from '@ant-design/icons'
import ProcessingStepsView from './ProcessingStepsView'

const { Dragger } = Upload
const { Title, Text, Paragraph } = Typography

const DatabaseFilesModal = ({ visible, onCancel, onSubmit, caseId }) => {
  const [knowledgeCFiles, setKnowledgeCFiles] = useState([])
  const [cacheFiles, setCacheFiles] = useState([])
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
      
      // Update the processing status based on the step and check for completion
      setProcessingStatus(prevStatus => {
        const newStatus = {
          ...prevStatus,
          [update.step]: {
            status: update.status,
            message: update.message,
            error: update.error,
            result: update.result
          }
        };
        
        // Check if all steps are completed with the new status
        const deviceCompleted = newStatus.device.status === 'completed';
        const cacheCompleted = cacheFiles.length === 0 || newStatus.cache.status === 'completed' || newStatus.cache.status === 'error';
        const knowledgeCCompleted = knowledgeCFiles.length === 0 || newStatus.knowledgeC.status === 'completed' || newStatus.knowledgeC.status === 'error';
        
        const allCompleted = deviceCompleted && cacheCompleted && knowledgeCCompleted;
        
        if (allCompleted) {
          // Use setTimeout to ensure state updates happen after this render cycle
          setTimeout(() => {
            setCurrentStep(3); // Set to final step
            setProcessing(false);
            setProcessingComplete(true);
            message.success('Database processing completed successfully');
            
            // Store the final results
            setProcessingResults(prev => ({
              ...prev,
              deviceName,
              knowledgeCResult: newStatus.knowledgeC?.result,
              cacheResult: newStatus.cache?.result
            }));
          }, 0);
        }
        
        return newStatus;
      });
      
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
    };
    
    window.electron.ipcRenderer.on('database-processing-update', handleProcessingUpdate);
    
    return () => {
      window.electron.ipcRenderer.removeListener('database-processing-update', handleProcessingUpdate);
    };
  }, [processing, cacheFiles, knowledgeCFiles, deviceName]);

  const handleSubmit = async () => {
    if (!deviceName.trim()) {
      message.error('Please enter a device name');
      return;
    }

    if (knowledgeCFiles.length === 0 && cacheFiles.length === 0) {
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
      
      const deviceData = {
        name: deviceName,
        created_at: new Date().toISOString(),
        caseId // Include the caseId here
      };
      
      console.log('Adding device with data:', deviceData);
      const deviceResult = await window.electron.ipcRenderer.invoke('add-device', deviceData);
      
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
      if (knowledgeCFiles.length > 0) {
        processData.knowledgeCFiles = knowledgeCFiles.map(file => ({
          path: file.path || file.originFileObj?.path,
          name: file.name
        }));
      }
      
      if (cacheFiles.length > 0) {
        processData.cacheFiles = cacheFiles.map(file => ({
          path: file.path || file.originFileObj?.path,
          name: file.name
        }));
      }
      
      console.log('Sending process data:', processData);
      
      const result = await window.electron.ipcRenderer.invoke('process-database-files', processData);
      
      if (!result.success) {
        throw new Error(`Failed to process databases: ${result.error}`);
      }
      
      // Don't mark as complete here - wait for the IPC events to confirm completion
      // The handleProcessingUpdate will set processingComplete when all steps are done
      
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
    setKnowledgeCFiles([]);
    setCacheFiles([]);
    setDeviceName('');
    setCurrentStep(0);
    setProcessingComplete(false);
  };

  const uploadProps = (fileType) => ({
    multiple: true,
    onRemove: (file) => {
      if (fileType === 'knowledgeC') {
        setKnowledgeCFiles(prevFiles => prevFiles.filter(f => f.uid !== file.uid));
      } else {
        setCacheFiles(prevFiles => prevFiles.filter(f => f.uid !== file.uid));
      }
    },
    beforeUpload: (file) => {
      // Store the full file object with path information
      console.log('File object:', file);
      console.log('File path:', file.path);
      console.log('File name:', file.name);
      
      // Create a proper file object that Ant Design can display
      const fileWithPath = {
        uid: file.uid || `${Date.now()}-${file.name}`,
        name: file.name,
        status: 'done',
        path: file.path || file.name,
        originFileObj: file
      };
      
      if (fileType === 'knowledgeC') {
        setKnowledgeCFiles(prevFiles => [...prevFiles, fileWithPath]);
      } else {
        setCacheFiles(prevFiles => [...prevFiles, fileWithPath]);
      }
      return false; // Prevent auto upload
    },
    fileList: fileType === 'knowledgeC' ? knowledgeCFiles : cacheFiles
  });
  
  // Render processing status details
  const renderProcessingStatus = () => {
    return (
      <Space direction="vertical" style={{ width: '100%', marginTop: '20px' }}>
        {Object.entries(processingStatus).map(([key, status]) => {
          if ((key === 'cache' && cacheFiles.length === 0) || (key === 'knowledgeC' && knowledgeCFiles.length === 0)) {
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
            <Dragger {...uploadProps('knowledgeC')} accept=".sqlite,.db,.db-wal">
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">Click or drag KnowledgeC.db files to upload (multiple files supported)</p>
              <p className="ant-upload-hint">
                Located in /private/var/mobile/Library/CoreDuet/Knowledge/
              </p>
            </Dragger>
          </div>

          <div>
            <Title level={5}>Cache.sqlite Database</Title>
            <Dragger {...uploadProps('cache')} accept=".sqlite,.db,.db-wal">
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">Click or drag Cache.sqlite files to upload (multiple files supported)</p>
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
