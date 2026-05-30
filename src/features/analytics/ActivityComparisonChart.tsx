import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { ChartWrapper, CustomTooltip } from '../../components/analytics/ChartComponents';
import { ComparisonDataPoint } from '../../utils/chartDataFormatters';

interface ActivityComparisonChartProps {
  data: ComparisonDataPoint[];
  loading: boolean;
}

export const ActivityComparisonChart: React.FC<ActivityComparisonChartProps> = ({
  data,
  loading,
}) => {
  return (
    <ChartWrapper
      title="Activity Comparison"
      subtitle="Contributions vs Issues vs PRs"
      loading={loading}
      height={350}
    >
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
        <XAxis
          dataKey="category"
          stroke="#888"
          tick={{ fill: '#888' }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis stroke="#888" tick={{ fill: '#888' }} tickLine={false} axisLine={false} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
        <Legend wrapperStyle={{ paddingTop: '20px' }} />
        <Bar
          dataKey="contributions"
          name="Contributions"
          stackId="a"
          fill="#8884d8"
          animationDuration={1000}
          radius={[0, 0, 4, 4]}
        />
        <Bar dataKey="issues" name="Issues" stackId="a" fill="#82ca9d" animationDuration={1000} />
        <Bar
          dataKey="pullRequests"
          name="Pull Requests"
          stackId="a"
          fill="#ffc658"
          animationDuration={1000}
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ChartWrapper>
  );
};
