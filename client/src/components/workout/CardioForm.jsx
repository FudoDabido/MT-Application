import React from 'react';
import Input from '../shared/Input.jsx';

export default function CardioForm({ values, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Input label="Distance (km)" type="number" step="0.01" min="0" value={values.distance_km} onChange={(e) => onChange({ ...values, distance_km: e.target.value })} placeholder="5.0" />
      <Input label="Duration (min)" type="number" min="1" value={values.duration_min} onChange={(e) => onChange({ ...values, duration_min: e.target.value })} placeholder="30" />
    </div>
  );
}
