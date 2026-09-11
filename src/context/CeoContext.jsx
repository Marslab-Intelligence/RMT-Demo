import React, { createContext, useContext, useState, useCallback } from 'react';

const CeoContext = createContext(null);

export const AVAILABLE_PERIODS = [
  { id: 'Q3 2026', label: 'Q3 2026 (Current)', quarter: 'Q3', year: 2026 },
  { id: 'Q2 2026', label: 'Q2 2026', quarter: 'Q2', year: 2026 },
  { id: 'Q1 2026', label: 'Q1 2026', quarter: 'Q1', year: 2026 },
  { id: 'Q4 2026', label: 'Q4 2026 (Upcoming)', quarter: 'Q4', year: 2026 },
  { id: 'YTD 2026', label: 'YTD 2026', quarter: 'YTD', year: 2026 },
  { id: '2025 Full Year', label: 'FY 2025 (Historical)', quarter: 'FY', year: 2025 },
];

export function CeoProvider({ children }) {
  const [selectedPeriod, setSelectedPeriod] = useState('Q3 2026');
  
  // Drill-down drawer state with navigation history stack
  const [drawerHistory, setDrawerHistory] = useState([]);
  const [drawerState, setDrawerState] = useState({
    isOpen: false,
    type: null, // 'department' | 'product' | 'service' | 'vendor' | 'renewal'
    id: null,
    title: '',
  });

  const openDrawer = useCallback((type, id, title = '') => {
    setDrawerState((current) => {
      if (current.isOpen && current.type && current.id) {
        setDrawerHistory((prev) => [...prev, { ...current }]);
      }
      return {
        isOpen: true,
        type,
        id,
        title: title || `${type.charAt(0).toUpperCase() + type.slice(1)} Detail`,
      };
    });
  }, []);

  const goBackDrawer = useCallback(() => {
    setDrawerHistory((prev) => {
      if (prev.length === 0) return prev;
      const nextHistory = [...prev];
      const previousState = nextHistory.pop();
      setDrawerState({ ...previousState, isOpen: true });
      return nextHistory;
    });
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerState((prev) => ({ ...prev, isOpen: false }));
    setDrawerHistory([]);
  }, []);

  return (
    <CeoContext.Provider
      value={{
        selectedPeriod,
        setSelectedPeriod,
        availablePeriods: AVAILABLE_PERIODS,
        drawerState,
        drawerHistory,
        openDrawer,
        goBackDrawer,
        canGoBackDrawer: drawerHistory.length > 0,
        closeDrawer,
      }}
    >
      {children}
    </CeoContext.Provider>
  );
}

export function useCeo() {
  const context = useContext(CeoContext);
  if (!context) {
    throw new Error('useCeo must be used within a CeoProvider');
  }
  return context;
}
