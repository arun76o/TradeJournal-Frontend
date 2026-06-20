import { ChartOptions } from 'chart.js';

export function getBaseChartOptions(): ChartOptions {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: getComputedStyle(document.documentElement).getPropertyValue('--tj-chart-text').trim() || '#64748b',
          font: { family: 'Inter, Roboto, sans-serif', size: 12 },
        },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(148, 163, 184, 0.15)' },
        ticks: { color: '#94a3b8', font: { size: 11 } },
      },
      y: {
        grid: { color: 'rgba(148, 163, 184, 0.15)' },
        ticks: { color: '#94a3b8', font: { size: 11 } },
      },
    },
  };
}
