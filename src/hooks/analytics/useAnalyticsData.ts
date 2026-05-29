import { useState, useEffect, useMemo } from 'react';
import { useAnalyticsFilters } from '../../context/AnalyticsFilterContext';
import { 
  generateTrendData, 
  generateDistributionData, 
  generateComparisonData,
  TrendDataPoint,
  DistributionDataPoint,
  ComparisonDataPoint
} from '../../utils/chartDataFormatters';

export const useAnalyticsData = () => {
  const { filters } = useAnalyticsFilters();
  const [loading, setLoading] = useState(false);

  const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);
  const [distributionData, setDistributionData] = useState<DistributionDataPoint[]>([]);
  const [comparisonData, setComparisonData] = useState<ComparisonDataPoint[]>([]);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    // Simulate network delay for fetching analytics data
    const timer = setTimeout(() => {
      if (isMounted) {
        // Calculate months diff
        const months = (filters.dateRange.end.getFullYear() - filters.dateRange.start.getFullYear()) * 12 + 
                       (filters.dateRange.end.getMonth() - filters.dateRange.start.getMonth());
        const effectiveMonths = Math.max(1, months);

        setTrendData(generateTrendData(filters.timeGranularity, effectiveMonths));
        setDistributionData(generateDistributionData(filters.categories));
        setComparisonData(generateComparisonData(filters.categories));
        setLoading(false);
      }
    }, 600);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [filters]); // Re-fetch when filters change

  // Calculate overview metrics
  const overviewMetrics = useMemo(() => {
    if (trendData.length === 0) return { totalUsers: 0, totalActivity: 0, totalProjects: 0, userGrowth: 0 };
    
    const latest = trendData[trendData.length - 1];
    const previous = trendData.length > 1 ? trendData[trendData.length - 2] : null;

    const userGrowth = previous && previous.users > 0 
      ? ((latest.users - previous.users) / previous.users) * 100 
      : 0;

    return {
      totalUsers: latest.users,
      totalActivity: latest.activity,
      totalProjects: latest.projects,
      userGrowth: userGrowth.toFixed(1)
    };
  }, [trendData]);

  return {
    loading,
    trendData,
    distributionData,
    comparisonData,
    overviewMetrics
  };
};
