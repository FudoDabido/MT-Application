'use client';
import React, { useState, useEffect } from 'react';
import { getEquipmentList, completeOnboarding } from '../../api/onboardingApi.js';
import Button from '../shared/Button.jsx';
import Spinner from '../shared/Spinner.jsx';

const LOCATION_OPTIONS = [
  { value: 'no_equipment', label: 'Home — No Equipment', desc: 'Bodyweight & calisthenics only', icon: '🏠' },
  { value: 'home_equipment', label: 'Home — With Equipment', desc: 'I have some gear at home', icon: '🏋️' },
  { value: 'gym', label: 'Gym', desc: 'I train at a gym', icon: '🏟️' },
];


const CATEGORY_LABELS = {
  bodyweight: 'Bodyweight Tools',
  free_weights: 'Free Weights',
  bench: 'Bench',
  bands: 'Resistance Bands',
  machines: 'Gym Machines',
  cardio: 'Cardio Equipment',
  other: 'Other',
};

export default function OnboardingWizard({ onComplete }) {
  const [step, setStep]               = useState(1);
  const [location, setLocation]       = useState('');
  const [equipmentData, setEquipmentData] = useState(null);
  const [selected, setSelected]       = useState(new Set());
  const [loading, setLoading]         = useState(false);
  const [saving, setSaving]           = useState(false);

  const showEquipmentStep = location && location !== 'no_equipment';
  // Steps: 1=location, 2=equipment (only if has equipment)
  const totalSteps = showEquipmentStep ? 2 : 1;

  useEffect(() => {
    if (step === 2 && showEquipmentStep) {
      setLoading(true);
      getEquipmentList().then(r => setEquipmentData(r.data)).finally(() => setLoading(false));
    }
  }, [step]);

  function toggleEquipment(id) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll(items) {
    setSelected(prev => {
      const next = new Set(prev);
      items.forEach(i => next.add(i.id));
      return next;
    });
  }

  async function handleFinish() {
    setSaving(true);
    try {
      await completeOnboarding({
        training_location: location,
        equipment_ids: location === 'no_equipment' ? [1] : Array.from(selected),
        meditation_mode: '1h_morning',
      });
      onComplete();
    } catch(err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  function handleLocationSelect(val) {
    setLocation(val);
    if (val === 'no_equipment') setSelected(new Set([1]));
  }

  function handleNext() {
    if (step === 1) {
      if (showEquipmentStep) setStep(2);
      else handleFinish();
    }
  }

  const stepIndicators = Array.from({ length: totalSteps }, (_, i) => i + 1);

  return (
    <div className="fixed inset-0 z-50 bg-gray-950 flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-4xl font-black text-emerald-400 mb-2">MT</div>
          <h1 className="text-2xl font-bold text-white">Setup</h1>
          <p className="text-gray-400 text-sm mt-1">Let's get you configured before you start</p>
          <div className="flex items-center justify-center gap-2 mt-4">
            {stepIndicators.map(s => (
              <div key={s} className={`w-8 h-1 rounded-full transition-colors ${step >= s ? 'bg-emerald-500' : 'bg-gray-700'}`} />
            ))}
          </div>
        </div>

        {/* Step 1: Location */}
        {step === 1 && (
          <div className="bg-gray-900 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4 text-white">Where do you train?</h2>
            <div className="flex flex-col gap-3">
              {LOCATION_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleLocationSelect(opt.value)}
                  className={`flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                    location === opt.value
                      ? 'border-emerald-500 bg-emerald-950'
                      : 'border-gray-700 bg-gray-800 hover:border-gray-500'
                  }`}
                >
                  <span className="text-3xl">{opt.icon}</span>
                  <div>
                    <div className="font-semibold text-white">{opt.label}</div>
                    <div className="text-sm text-gray-400">{opt.desc}</div>
                  </div>
                  {location === opt.value && <span className="ml-auto text-emerald-400 text-xl">✓</span>}
                </button>
              ))}
            </div>
            <div className="mt-6 flex justify-end">
              <Button onClick={handleNext} disabled={!location || saving}>
                {saving ? 'Saving…' : showEquipmentStep ? 'Next →' : 'Finish Setup ✓'}
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Equipment (only if not no_equipment) */}
        {step === 2 && showEquipmentStep && (
          <div className="bg-gray-900 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-1 text-white">What equipment do you have?</h2>
            <p className="text-gray-400 text-sm mb-4">Select everything available to you — this filters your exercise library.</p>

            {loading ? (
              <div className="flex justify-center py-8"><Spinner /></div>
            ) : equipmentData ? (
              <div className="flex flex-col gap-6 max-h-96 overflow-y-auto pr-1">
                {Object.entries(CATEGORY_LABELS).map(([cat, label]) => {
                  const items = equipmentData.categories[cat];
                  if (!items || !items.length) return null;
                  const allSelected = items.every(i => selected.has(i.id));
                  return (
                    <div key={cat}>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide">{label}</h3>
                        <button onClick={() => selectAll(items)} className="text-xs text-emerald-400 hover:underline">
                          {allSelected ? '✓ All' : 'Select All'}
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {items.map(item => (
                          <button
                            key={item.id}
                            onClick={() => toggleEquipment(item.id)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-sm transition-all ${
                              selected.has(item.id)
                                ? 'border-emerald-500 bg-emerald-950 text-emerald-300'
                                : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-500'
                            }`}
                          >
                            <span>{item.icon}</span>
                            <span className="truncate flex-1">{item.name}</span>
                            {selected.has(item.id) && <span className="text-emerald-400 shrink-0">✓</span>}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}

            <div className="mt-6 flex items-center justify-between">
              <button onClick={() => setStep(1)} className="text-sm text-gray-400 hover:text-white">← Back</button>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">{selected.size} items selected</span>
                <Button onClick={handleFinish} disabled={saving}>
                  {saving ? 'Saving…' : 'Finish Setup ✓'}
                </Button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
