import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { ChartWrapper, CustomTooltip } from '../../components/analytics/ChartComponents';
import { DistributionDataPoint } from '../../utils/chartDataFormatters';

interface DistributionChartProps {
  data: DistributionDataPoint[];
  loading: boolean;
}

export const DistributionChart: React.FC<DistributionChartProps> = ({ data, loading }) => {
  return (
    <ChartWrapper
      title="Skill Distribution"
      subtitle="Engagement by category"
      loading={loading}
      height={300}
    >
      <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
        <Pie
          data={data}
          cx="50%"
          cy="45%"
          innerRadius={80}
          outerRadius={110}
          paddingAngle={5}
          dataKey="value"
          animationDuration={1000}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill || '#8884d8'} stroke="rgba(0,0,0,0)" />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend verticalAlign="bottom" height={36} iconType="circle" />
      </PieChart>
    </ChartWrapper>
  );
};
