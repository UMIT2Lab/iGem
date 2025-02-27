import React, { useState } from 'react';
import { Radio, Tabs } from 'antd';
const RightPanel = () => {

  const [activeKey, setActiveKey] = useState('1');
  const [items, setItems] = useState([
    {
      label: 'Tab 1',
      key: '1',
      children: 'Content of editable tab 1',
    },
    {
      label: 'Tab 2',
      key: '2',
      children: 'Content of editable tab 2',
    },
    {
      label: 'Tab 3',
      key: '3',
      children: 'Content of editable tab 3',
    },
  ]);


  return (
    <div>

      <Tabs
        defaultActiveKey="1"
        type="card"
        size={'large'}
        style={{
          marginBottom: 32,
        }}
        items={new Array(3).fill(null).map((_, i) => {
          const id = String(i + 1);
          return {
            label: `Card Tab ${id}`,
            key: id,
            children: `Content of card tab ${id}`,
          };
        })}
      />
    
    </div>
  );
};
export default RightPanel;