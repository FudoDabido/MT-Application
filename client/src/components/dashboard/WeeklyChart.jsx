'use client';
import React, { useEffect, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { getWeeklySummary } from '../../api/logsApi.js';
import Spinner from '../shared/Spinner.jsx';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function WeeklyChart() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getWeeklySummary().then((r) => setData(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner size="sm" />;
  if (!data.length) return <p className="text-gray-500 text-sm">No data for the past 7 days.</p>;

  const labels = data.map((d) => d.day.slice(5));
  const chartData = {
    labels,
    datasets: [
      {
        label: 'Total Reps',
        data: data.map((d) => d.total_reps || 0),
        backgroundColor: 'rgba(16, 185, 129, 0.7)',
        borderRadius: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: '#9ca3af' }, grid: { color: '#1f2937' } },
      y: { ticks: { color: '#9ca3af' }, grid: { color: '#1f2937' } },
    },
  };

  return <Bar data={chartData} options={options} />;
}
