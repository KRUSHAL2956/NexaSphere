import React from 'react';
import { ResponsiveContainer } from 'recharts';

interface ChartWrapperProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  height?: number | string;
  loading?: boolean;
}

export const ChartWrapper: React.FC<ChartWrapperProps> = ({ 
  title, 
  subtitle, 
  children, 
  height = 300,
  loading = false 
}) => {
  return (
    <div className="bg-[#111] border border-[#222] rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow flex flex-col h-full w-full">
      <div className="mb-6">
        <h3 className="text-xl font-bold text-white mb-1">{title}</h3>
        {subtitle && <p className="text-sm text-gray-400">{subtitle}</p>}
      </div>
      <div className="flex-1 w-full relative" style={{ minHeight: height }}>
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-[#111] z-10 bg-opacity-80">
            <div className="w-8 h-8 border-4 border-[#333] border-t-red-500 rounded-full animate-spin"></div>
          </div>
        ) : null}
        <ResponsiveContainer width="100%" height="100%">
          {children as React.ReactElement}
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#0a0a0a] border border-[#333] p-4 rounded-lg shadow-2xl">
        <p className="text-gray-300 font-semibold mb-2 pb-2 border-b border-[#222]">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={`item-${index}`} className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-gray-400 text-sm">{entry.name}:</span>
            <span className="text-white font-bold text-sm">{entry.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};
