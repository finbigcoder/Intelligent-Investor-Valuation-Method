
import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  ChartOptions,
  Filler, // Import Filler plugin
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import type { HistoricalPrice } from '../types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  Filler // Register Filler plugin
);

interface PriceChartProps {
  historicalData: HistoricalPrice[];
  intrinsicValue: number;
}

const PriceChart: React.FC<PriceChartProps> = ({ historicalData, intrinsicValue }) => {
  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: '#8b949e', // text-gray-400
          font: {
            size: 14,
          },
          usePointStyle: true,
        },
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(13, 17, 23, 0.8)', // bg-gray-900 with opacity
        borderColor: 'rgba(139, 148, 158, 0.3)',
        borderWidth: 1,
        titleColor: '#e6edf3', // text-gray-50
        bodyColor: '#8b949e', // text-gray-300
        padding: 12,
        boxPadding: 4,
        callbacks: {
            label: function(context) {
                let label = context.dataset.label || '';
                if (label) {
                    label += ': ';
                }
                if (context.parsed.y !== null) {
                    label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.parsed.y);
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
          y: { min: 'original', max: 'original' },
        }
      }
    },
    scales: {
      x: {
        type: 'time',
        time: {
          unit: 'year',
          tooltipFormat: 'PP',
        },
        ticks: {
          color: '#8b949e', // text-gray-400
        },
        grid: {
          color: 'rgba(139, 148, 158, 0.1)',
        },
      },
      y: {
        ticks: {
          color: '#8b949e', // text-gray-400
          callback: (value) => `$${Number(value).toFixed(0)}`,
        },
        grid: {
          color: 'rgba(139, 148, 158, 0.1)',
        },
      },
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false
    }
  };

  const data = {
    labels: historicalData.map(d => d.date),
    datasets: [
      {
        label: 'Historical Price',
        data: historicalData.map(d => d.price),
        borderColor: 'rgb(34, 211, 238)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.1,
        fill: true,
        backgroundColor: (context: any) => {
            const ctx = context.chart.ctx;
            const gradient = ctx.createLinearGradient(0, 0, 0, context.chart.height);
            gradient.addColorStop(0, 'rgba(34, 211, 238, 0.3)');
            gradient.addColorStop(1, 'rgba(34, 211, 238, 0)');
            return gradient;
        },
      },
      {
        label: 'Intrinsic Value',
        data: historicalData.map(() => intrinsicValue > 0 ? intrinsicValue : null),
        borderColor: 'rgb(52, 211, 153)', // emerald-400
        borderDash: [6, 6],
        pointRadius: 0,
        borderWidth: 2.5,
      },
    ],
  };

  // Type assertion for ChartJS data prop
  const chartData = data as {
    labels: string[];
    datasets: {
      label: string;
      data: (number | null)[];
      borderColor: string;
      borderWidth: number;
      pointRadius: number;
      tension?: number;
      fill?: boolean;
      backgroundColor?: any;
      borderDash?: number[];
    }[];
  };

  return <Line options={options} data={chartData} />;
};

export default PriceChart;