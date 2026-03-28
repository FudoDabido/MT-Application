'use client';
import React from 'react';

const colors = {
  strength: 'bg-blue-900 text-blue-300',
  cardio: 'bg-orange-900 text-orange-300',
  custom: 'bg-purple-900 text-purple-300',
  default: 'bg-gray-800 text-gray-300',
};

export default function Badge({ children, type = 'default' }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[type] || colors.default}`}>
      {children}
    </span>
  );
}
