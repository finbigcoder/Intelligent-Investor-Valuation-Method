
import React from 'react';
import { Bar, Line } from 'react-chartjs-2';
import { ChartOptions } from 'chart.js';
import type { HistoricalEPS, HistoricalPE, HistoricalDebtToEquity } from '../types';

interface FinancialHealthChartsProps {
  historicalEPS: HistoricalEPS[];
  historicalPE: HistoricalPE[];
  historicalDebtToEquity: HistoricalDebtToEquity[];
}

const FinancialHealthCharts: React.FC<FinancialHealthChartsProps> = ({
  historicalEPS,
  historicalPE,
  historicalDebtToEquity,
}) => {
  const chartOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(13, 17, 23, 0.8)',
        borderColor: 'rgba(139, 148, 158, 0.3)',
        borderWidth: 1,
        titleColor: '#e6edf3',
        bodyColor: '#8b949e',
        callbacks: {
           title: function(tooltipItems) {
            if (tooltipItems.length > 0) {
              return `Year: ${tooltipItems[0].label}`;
            }
            return '';
          },
          label: function(context) {
              let label = context.dataset.label || '';
              if (label) {
                  label += ': ';
              }
              if (context.parsed.y !== null) {
                  label += context.parsed.y.toFixed(2);
              }
              return label;
          }
        }
      },
      zoom: {
        pan: {
          enabled: true,
          mode: 'x',
        },
        zoom: {
          wheel: {
            enabled: true,
            speed: 0.1,
          },
          pinch: {
            enabled: true,
          },
          mode: 'x',
        },
        limits: {
          x: { min: 'original', max: 'original' },
        }
      },
    },
    scales: {
      x: {
        ticks: { color: '#8b949e', maxRotation: 0, minRotation: 0, autoSkip: true, maxTicksLimit: 10 },
        grid: { color: 'rgba(139, 148, 158, 0.1)' },
      },
      y: {
        ticks: { color: '#8b949e', maxTicksLimit: 5 },
        grid: { color: 'rgba(139, 148, 158, 0.1)' },
      },
    },
  };

  const epsChartData = {
    labels: historicalEPS.map(d => d.year),
    datasets: [{
      label: 'EPS',
      data: historicalEPS.map(d => d.eps),
      backgroundColor: historicalEPS.map(d => d.eps >= 0 ? 'rgba(52, 211, 153, 0.7)' : 'rgba(248, 113, 113, 0.7)'),
      borderColor: historicalEPS.map(d => d.eps >= 0 ? 'rgb(52, 211, 153)' : 'rgb(248, 113, 113)'),
      borderWidth: 1,
    }],
  };
  
  const peChartData = {
    labels: historicalPE.map(d => d.year),
    datasets: [{
      label: 'P/E Ratio',
      data: historicalPE.map(d => d.ratio),
      borderColor: 'rgb(34, 211, 238)',
      backgroundColor: 'rgba(34, 211, 238, 0.2)',
      fill: true,
      tension: 0.2,
      pointRadius: 2,
      pointBackgroundColor: 'rgb(34, 211, 238)',
    }],
  };

  const deChartData = {
    labels: historicalDebtToEquity.map(d => d.year),
    datasets: [{
      label: 'Debt/Equity',
      data: historicalDebtToEquity.map(d => d.ratio),
      borderColor: 'rgb(192, 132, 252)',
      backgroundColor: 'rgba(192, 132, 252, 0.2)',
      fill: true,
      tension: 0.2,
      pointRadius: 2,
      pointBackgroundColor: 'rgb(192, 132, 252)',
    }],
  };

  const hasData = historicalEPS?.length > 0 || historicalPE?.length > 0 || historicalDebtToEquity?.length > 0;

  if (!hasData) {
    return null;
  }

  return (
    <div className="lg:col-span-5 p-4 sm:p-5 rounded-xl bg-[#0D1117]/50 border border-[var(--color-border)]">
      <div className="text-center mb-4">
          <h3 className="text-lg font-semibold text-white">10-Year Financial Health Trends</h3>
          <p className="text-xs text-[var(--color-text-secondary)]">Pinch/Scroll to zoom, Drag to pan</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-4">
        {historicalEPS?.length > 0 && (
          <div className="flex flex-col h-64">
            <h4 className="text-center text-sm font-medium text-gray-300 mb-2">Earnings Per Share (EPS)</h4>
            <div className="flex-grow relative">
              <Bar options={chartOptions as ChartOptions<'bar'>} data={epsChartData} />
            </div>
          </div>
        )}
        {historicalPE?.length > 0 && (
          <div className="flex flex-col h-64">
            <h4 className="text-center text-sm font-medium text-gray-300 mb-2">Price-to-Earnings (P/E) Ratio</h4>
            <div className="flex-grow relative">
              <Line options={chartOptions as ChartOptions<'line'>} data={peChartData} />
            </div>
          </div>
        )}
        {historicalDebtToEquity?.length > 0 && (
          <div className="flex flex-col h-64">
            <h4 className="text-center text-sm font-medium text-gray-300 mb-2">Debt-to-Equity Ratio</h4>
             <div className="flex-grow relative">
                <Line options={chartOptions as ChartOptions<'line'>} data={deChartData} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FinancialHealthCharts;