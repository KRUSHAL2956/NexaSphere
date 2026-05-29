import React, { useRef } from 'react';
import { AnalyticsFilterProvider, useAnalyticsFilters } from '../../context/AnalyticsFilterContext';
import { useAnalyticsData } from '../../hooks/analytics/useAnalyticsData';
import { TrendChart } from '../../features/analytics/TrendChart';
import { DistributionChart } from '../../features/analytics/DistributionChart';
import { ActivityComparisonChart } from '../../features/analytics/ActivityComparisonChart';
import { formatNumber } from '../../utils/chartDataFormatters';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Download, Calendar, Filter, ChevronLeft } from 'lucide-react';

interface AnalyticsPageProps {
  onBack?: () => void;
}

const AnalyticsDashboardContent: React.FC<AnalyticsPageProps> = ({ onBack }) => {
  const { filters, updateFilter } = useAnalyticsFilters();
  const { loading, trendData, distributionData, comparisonData, overviewMetrics } = useAnalyticsData();
  const dashboardRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = React.useState(false);

  const handleExport = async () => {
    if (!dashboardRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(dashboardRef.current, {
        scale: 2,
        backgroundColor: '#0a0a0a',
        useCORS: true,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`NexaSphere_Analytics_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            {onBack && (
              <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-2">
                <ChevronLeft size={16} /> Back
              </button>
            )}
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              Platform Intelligence
            </h1>
            <p className="text-gray-400 mt-1">Real-time analytics and platform metrics</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-[#111] border border-[#333] rounded-lg p-1">
              <button 
                onClick={() => updateFilter('timeGranularity', 'daily')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${filters.timeGranularity === 'daily' ? 'bg-[#333] text-white' : 'text-gray-400 hover:text-gray-200'}`}
              >
                Daily
              </button>
              <button 
                onClick={() => updateFilter('timeGranularity', 'weekly')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${filters.timeGranularity === 'weekly' ? 'bg-[#333] text-white' : 'text-gray-400 hover:text-gray-200'}`}
              >
                Weekly
              </button>
              <button 
                onClick={() => updateFilter('timeGranularity', 'monthly')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${filters.timeGranularity === 'monthly' ? 'bg-[#333] text-white' : 'text-gray-400 hover:text-gray-200'}`}
              >
                Monthly
              </button>
            </div>
            <button 
              onClick={handleExport}
              disabled={exporting || loading}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-4 py-2.5 rounded-lg font-medium transition-all disabled:opacity-50"
            >
              <Download size={18} />
              {exporting ? 'Exporting...' : 'Export Report'}
            </button>
          </div>
        </div>

        <div ref={dashboardRef} className="flex flex-col gap-6">
          {/* Overview Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricBadge title="Total Users" value={formatNumber(overviewMetrics.totalUsers)} trend={Number(overviewMetrics.userGrowth)} loading={loading} />
            <MetricBadge title="Platform Activity" value={formatNumber(overviewMetrics.totalActivity)} loading={loading} />
            <MetricBadge title="Active Projects" value={formatNumber(overviewMetrics.totalProjects)} loading={loading} />
            <MetricBadge title="Categories" value={filters.categories.length.toString()} loading={loading} />
          </div>

          {/* Main Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <TrendChart data={trendData} loading={loading} />
            </div>
            <div className="lg:col-span-1">
              <DistributionChart data={distributionData} loading={loading} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <ActivityComparisonChart data={comparisonData} loading={loading} />
          </div>
        </div>
      </div>
    </div>
  );
};

const MetricBadge: React.FC<{ title: string; value: string; trend?: number; loading?: boolean }> = ({ title, value, trend, loading }) => (
  <div className="bg-[#111] border border-[#222] rounded-xl p-5 shadow-sm relative overflow-hidden">
    {loading && (
      <div className="absolute inset-0 bg-[#111] z-10 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-[#333] border-t-blue-500 rounded-full animate-spin"></div>
      </div>
    )}
    <h4 className="text-gray-400 text-sm font-medium mb-2">{title}</h4>
    <div className="flex items-end justify-between">
      <span className="text-3xl font-bold text-white">{value}</span>
      {trend !== undefined && (
        <span className={`text-sm font-medium ${trend >= 0 ? 'text-green-500' : 'text-red-500'}`}>
          {trend >= 0 ? '+' : ''}{trend}%
        </span>
      )}
    </div>
  </div>
);

export default function AnalyticsPage(props: AnalyticsPageProps) {
  return (
    <AnalyticsFilterProvider>
      <AnalyticsDashboardContent {...props} />
    </AnalyticsFilterProvider>
  );
}
