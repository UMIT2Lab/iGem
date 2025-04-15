import React from 'react';
import { Steps } from 'antd';

const ProcessingStepsView = ({ steps = [], currentStep }) => {
  return (
    <Steps
      current={currentStep}
      items={steps.map(step => ({
        title: step.title,
        description: step.description
      }))}
    />
  );
};

export default ProcessingStepsView;
