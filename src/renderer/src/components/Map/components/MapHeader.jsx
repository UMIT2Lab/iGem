import React from 'react';
import {
  DatePicker,
  Button,
  Layout,
  Row,
  Col,
  Slider,
  Image
} from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  StepForwardOutlined,
  StepBackwardOutlined,
  HomeOutlined
} from '@ant-design/icons';
import logo from '../../../assets/logo.png';

const { Header } = Layout;

const MapHeader = ({
  onClose,
  startDateTime,
  endDateTime,
  setStartDateTime,
  setEndDateTime,
  isPlaying,
  togglePlayPause,
  forward,
  backward,
  index,
  filteredLocations,
  sliderUpdate
}) => {
  return (
    <Header
      style={{
        height: '64px',
        width: '100%',
        backgroundColor: '#a1c2e4',
        position: 'relative'
      }}
    >
      <Row gutter={[16, 16]} align="middle">
        <Col>
          <Button
            icon={<HomeOutlined />}
            onClick={onClose || (() => window.history.back())}
            style={{ marginRight: 16 }}
          />
        </Col>
        <Image src={logo} width={150} preview={false} />
        <Col>
          <DatePicker 
            showTime 
            value={startDateTime} 
            onChange={(date) => setStartDateTime(date)} 
            placeholder="Start DateTime" 
          />
        </Col>
        <Col>
          <DatePicker 
            showTime 
            value={endDateTime} 
            onChange={(date) => setEndDateTime(date)} 
            placeholder="End DateTime" 
          />
        </Col>
        <Col>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Button onClick={backward} icon={<StepBackwardOutlined />} />
            <Button 
              onClick={togglePlayPause} 
              icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />} 
            />
            <Button onClick={forward} icon={<StepForwardOutlined />} />
            <Slider 
              style={{ width: 100, marginLeft: 20 }} 
              value={index} 
              onChange={sliderUpdate} 
              tooltip={{ open: false }} 
              max={filteredLocations.length - 1} 
              step={1} 
            />
            <span style={{ marginLeft: '10px' }}>
              {index}/{filteredLocations.length || 1}
            </span>
          </div>
        </Col>
      </Row>
    </Header>
  );
};

export default MapHeader;
