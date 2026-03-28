'use client';
import React from 'react';
import Input from '../shared/Input.jsx';

export default function StrengthForm({ values, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Input label="Sets" type="number" min="1" value={values.sets} onChange={(e) => onChange({ ...values, sets: e.target.value })} placeholder="3" />
      <Input label="Reps" type="number" min="1" value={values.reps} onChange={(e) => onChange({ ...values, reps: e.target.value })} placeholder="10" />
    </div>
  );
}
