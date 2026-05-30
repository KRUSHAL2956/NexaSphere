import React, { createContext, useContext, useState, ReactNode } from 'react';

export type TimeGranularity = 'daily' | 'weekly' | 'monthly';

export interface FilterState {
  dateRange: {
    start: Date;
    end: Date;
  };
  categories: string[];
  metrics: string[];
  timeGranularity: TimeGranularity;
}

interface AnalyticsFilterContextProps {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  updateFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
}

const defaultFilters: FilterState = {
  dateRange: {
    start: new Date(new Date().setMonth(new Date().getMonth() - 6)),
    end: new Date(),
  },
  categories: ['Frontend', 'Backend', 'Design', 'AI/ML'],
  metrics: ['Users', 'Activity', 'Projects'],
  timeGranularity: 'monthly',
};

const AnalyticsFilterContext = createContext<AnalyticsFilterContextProps | undefined>(undefined);

export const AnalyticsFilterProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [filters, setFilters] = useState<FilterState>(defaultFilters);

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  return (
    <AnalyticsFilterContext.Provider value={{ filters, setFilters, updateFilter }}>
      {children}
    </AnalyticsFilterContext.Provider>
  );
};

export const useAnalyticsFilters = () => {
  const context = useContext(AnalyticsFilterContext);
  if (!context) {
    throw new Error('useAnalyticsFilters must be used within an AnalyticsFilterProvider');
  }
  return context;
};
