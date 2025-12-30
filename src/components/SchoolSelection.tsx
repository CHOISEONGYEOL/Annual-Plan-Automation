import React, { useState } from 'react';
import { School } from '../types';
import { storage } from '../infra/supabase/storage';
import './SchoolSelection.css';

interface SchoolSelectionProps {
  onSelect: (school: School) => void;
}

export const SchoolSelection: React.FC<SchoolSelectionProps> = ({ onSelect }) => {
  const [schoolName, setSchoolName] = useState('');
  const [foundSchool, setFoundSchool] = useState<School | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [hasSelected, setHasSelected] = useState(false);

  // 네이버 연관검색어처럼 아래에 뜨는 추천 학교 리스트
  const [suggestions, setSuggestions] = useState<School[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  // 검색 진행 중 여부
  const [isSearching, setIsSearching] = useState(false);

  const handleSchoolNameChange = async (value: string) => {
    setSchoolName(value);

    // 이미 학교 선택이 끝난 상태라면 더 이상 검색하지 않음
    if (hasSelected) {
      return;
    }

    const trimmedValue = value.trim();

    if (!trimmedValue) {
      // 입력이 비면 상태 초기화
      setFoundSchool(null);
      setIsConfirming(false);
      setSuggestions([]);
      setHighlightedIndex(-1);  
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    try {
      // 부분 일치로 학교 이름 검색
      const schools = await storage.searchSchoolsByName(trimmedValue);
      setSuggestions(schools);
      setHighlightedIndex(-1);   

      // 그 중에서 정확히 일치하는 학교 찾기 (대소문자 무시)
      const matched = schools.find(
        (s) => s.name.trim().toLowerCase() === trimmedValue.toLowerCase()
      );

      if (matched) {
        setFoundSchool(matched);
        setIsConfirming(true);
      } else {
        setFoundSchool(null);
        setIsConfirming(false);
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleConfirmExisting = () => {
    if (foundSchool) {
      setHasSelected(true);
      setIsConfirming(false);
      setSuggestions([]);
      onSelect(foundSchool);
    }
  };

  // 추천 리스트에서 하나 클릭해서 바로 선택할 때
  const handleSelectSuggestion = (school: School) => {
    setSchoolName(school.name);
    setFoundSchool(school);
    setHasSelected(true);
    setIsConfirming(false);
    setSuggestions([]);
    onSelect(school);
  };

  const handleCreateNew = async () => {
    const trimmed = schoolName.trim();

    // 검색 중에는 새 학교 생성 금지
    if (isSearching) return;

    // 너무 짧은 이름은 새 학교로 만들지 않음 (필요시 길이 조정)
    if (trimmed.length < 2) return;

    // 이미 찾은 학교가 있으면 새로 만들지 않음
    if (!trimmed || foundSchool) return;

    // 마지막 방어선: 동일 이름 학교가 실제로 없는지 다시 한 번 확인
    const schools = await storage.searchSchoolsByName(trimmed);
    const exact = schools.find(
      (s) => s.name.trim().toLowerCase() === trimmed.toLowerCase()
    );

    if (exact) {
      // 그 사이 생긴 학교가 있으면 그걸로 전환
      setSuggestions(schools);
      setFoundSchool(exact);
      setIsConfirming(true);
      return;
    }

    const newSchool: School = {
      id: Date.now().toString(),
      name: trimmed,
    };

    await storage.saveSchool(newSchool);
    setHasSelected(true);
    setSuggestions([]);
    onSelect(newSchool);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // 이미 선택이 끝났으면 아무 동작도 안 함
    if (hasSelected) return;
  
    // 🔹 ArrowDown: 추천 리스트 아래로 이동
    if (e.key === 'ArrowDown') {
      if (suggestions.length === 0) return;
      e.preventDefault();
      setHighlightedIndex((prev) => {
        if (prev < 0) return 0;                         // 아직 선택 없으면 첫 번째
        if (prev >= suggestions.length - 1) return 0;   // 끝에서 다시 처음으로
        return prev + 1;
      });
      return;
    }
  
    // 🔹 ArrowUp: 추천 리스트 위로 이동
    if (e.key === 'ArrowUp') {
      if (suggestions.length === 0) return;
      e.preventDefault();
      setHighlightedIndex((prev) => {
        if (prev <= 0) return suggestions.length - 1;   // 처음에서 위로 가면 맨 끝
        return prev - 1;
      });
      return;
    }
  
    // 🔹 Enter 처리
    if (e.key === 'Enter') {
      // 검색 중이면 Enter도 무시 (결과 나오기 전에는 확정 불가)
      if (isSearching) return;
  
      // 하이라이트된 추천 학교가 있으면 그걸 선택
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        const school = suggestions[highlightedIndex];
        handleSelectSuggestion(school);
        return;
      }
  
      // 아니면 기존 로직대로: 정확히 일치하는 학교가 있을 때만 Enter로 선택 허용
      if (foundSchool) {
        handleConfirmExisting();
      }
  
      // foundSchool 없고 하이라이트도 없으면 Enter는 아무 일도 하지 않음
    }
  };
  

  const trimmedName = schoolName.trim();

  const canShowCreateInSuggestions =
    !hasSelected &&
    !isSearching &&
    !!trimmedName &&
    !foundSchool; // 정확히 일치하는 학교가 없을 때만 "새 학교" 옵션 노출

  return (
    <div className="school-selection">
      <h2>학교 선택</h2>

      <div className="school-input-section">
        <input
          type="text"
          placeholder="학교 이름을 정확히 입력하세요"
          value={schoolName}
          onChange={(e) => handleSchoolNameChange(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          className="school-name-input"
        />

        {/* 네이버 연관검색어 스타일 추천 리스트 */}
        {(suggestions.length > 0 || canShowCreateInSuggestions) && !hasSelected && (
          <ul className="school-suggestions">
            {/* 검색된 기존 학교 리스트 */}
            {suggestions.map((school, index) => (
              <li key={school.id}>
                <button
                  type="button"
                  className={
                    'suggestion-item' +
                    (index === highlightedIndex ? ' suggestion-item--active' : '')
                  }
                  onClick={() => handleSelectSuggestion(school)}
                >
                  {school.name}
                </button>
              </li>
            ))}


            {/* 정확히 일치하는 학교가 없을 때, 연관검색어 영역에 "새 학교 등록" 안내/옵션 표시 */}
            {canShowCreateInSuggestions && (
              <li>
                <div className="suggestion-item suggestion-new-school">
                  <div className="suggestion-new-message">
                    해당 학교가 목록에 없습니다. <br />
                    <strong>"{trimmedName}"</strong> 학교를 새로 만드시겠습니까?
                  </div>
                  <button
                    type="button"
                    className="btn-create-inline"
                    onClick={handleCreateNew}
                  >
                    새 학교로 등록하기
                  </button>
                </div>
              </li>
            )}
          </ul>
        )}

        {isConfirming && foundSchool && (
          <div className="school-confirm-box">
            <p className="confirm-message">
              <strong>"{foundSchool.name}"</strong> 학교가 이미 등록되어 있습니다.
            </p>
            <p className="confirm-question">이 학교가 맞나요?</p>
            <div className="confirm-actions">
              <button className="btn-confirm" onClick={handleConfirmExisting}>
                네, 맞습니다
              </button>
              <button
                className="btn-cancel"
                onClick={() => {
                  setFoundSchool(null);
                  setIsConfirming(false);
                }}
              >
                아니요
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
