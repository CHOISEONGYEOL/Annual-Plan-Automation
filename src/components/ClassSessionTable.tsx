import React, { useState } from 'react';
import { ClassSession } from '../types';
import './ClassSessionTable.css';

interface ClassSessionTableProps {
  sessions: ClassSession[];
  teacherName: string;
  classInfo: string;
  onContentChange: (index: number, content: string) => void;
  // 🔽 추가: 전체 저장 버튼 콜백 (선택적)
  onSaveAll?: () => void;
}

export const ClassSessionTable: React.FC<ClassSessionTableProps> = ({
  sessions,
  teacherName,
  classInfo,
  onContentChange,
  onSaveAll,
}) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editContent, setEditContent] = useState<string>('');

  const handleEditStart = (index: number, currentContent: string) => {
    setEditingIndex(index);
    setEditContent(currentContent);
  };

  const handleEditSave = (index: number) => {
    onContentChange(index, editContent);
    setEditingIndex(null);
    setEditContent('');
  };

  const handleEditCancel = () => {
    setEditingIndex(null);
    setEditContent('');
  };

  return (
    <div className="class-session-table-container">
      <div className="table-header">
        <h3>
          {teacherName} - {classInfo}
        </h3>

        {/* 🔘 헤더 오른쪽에 "전체 저장" 버튼 배치 */}
        {onSaveAll && (
          <button className="btn-save-all" onClick={onSaveAll}>
            전체 저장
          </button>
        )}
      </div>

      <div className="table-wrapper">
        <table className="class-session-table">
          <thead>
            <tr>
              <th>회차</th>
              <th>날짜</th>
              <th>요일</th>
              <th>교시</th>
              <th>반</th>
              <th>학사일정</th>
              <th>수업 내용</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session, index) => (
              <tr key={index}>
                <td className="session-number">
                  {session.sessionNumber !== null ? session.sessionNumber : ''}
                </td>
                <td>{session.date}</td>
                <td>{session.dayOfWeek}</td>
                <td>{session.period}</td>
                <td>{session.classInfo}</td>
                <td className="academic-event">{session.academicEvent}</td>
                <td className="content-cell">
                  {editingIndex === index ? (
                    <div className="content-edit">
                      <input
                        type="text"
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handleEditSave(index);
                          } else if (e.key === 'Escape') {
                            handleEditCancel();
                          }
                        }}
                        autoFocus
                        className="content-input"
                      />
                      <div className="edit-actions">
                        <button onClick={() => handleEditSave(index)}>저장</button>
                        <button onClick={handleEditCancel}>취소</button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="content-display"
                      onClick={() => handleEditStart(index, session.content)}
                      title="클릭하여 수정"
                    >
                      {session.content || (
                        <span className="placeholder">클릭하여 입력</span>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
