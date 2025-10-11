import React from 'react';
import { getAvailableBarrierQuestions } from '../datapacks/DpBarrierAnalysisV2';

// Test component to list all available barrier questions
const TestBarrierQuestions: React.FC = () => {
  const questions = getAvailableBarrierQuestions();
  
  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h2>Available Barrier Questions ({questions.length})</h2>
      {questions.map((question, index) => (
        <div key={question.questionKey} style={{ marginBottom: '10px', border: '1px solid #ccc', padding: '10px' }}>
          <div><strong>Index:</strong> {index}</div>
          <div><strong>Key:</strong> {question.questionKey}</div>
          <div><strong>Title:</strong> {question.title}</div>
          <div><strong>Emoji:</strong> {question.emoji}</div>
          <div><strong>Categories:</strong> {question.categoriesCount}</div>
        </div>
      ))}
    </div>
  );
};

export default TestBarrierQuestions;