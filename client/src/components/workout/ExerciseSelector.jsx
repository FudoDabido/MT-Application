import React, { useEffect, useState, useMemo } from 'react';
import { getExercises } from '../../api/exercisesApi.js';
import { getUserEquipment } from '../../api/onboardingApi.js';
import Badge from '../shared/Badge.jsx';
import Spinner from '../shared/Spinner.jsx';

const MUSCLE_GROUPS = ['all', 'chest', 'back', 'shoulders', 'biceps', 'triceps', 'quads', 'glutes', 'hamstrings', 'calves', 'core', 'full_body'];

function userHasEquipment(requiredEquipment, userEquipmentNames) {
  if (!requiredEquipment || requiredEquipment === 'null' || requiredEquipment === null) return true;
  try {
    const required = JSON.parse(requiredEquipment);
    if (!required || required.length === 0) return true;
    return required.every(req => userEquipmentNames.some(ue => ue.toLowerCase().includes(req.replace(/_/g, ' ').toLowerCase()) || req.toLowerCase().includes(ue.toLowerCase().replace(/\s+/g, '_'))));
  } catch { return true; }
}

// Map equipment item names to equipment tag keywords
function buildEquipmentKeywords(userEquipItems) {
  const keywords = new Set(['null', 'bodyweight']);
  userEquipItems.forEach(item => {
    const n = (item.name || '').toLowerCase();
    const cat = (item.category || '').toLowerCase();
    keywords.add(cat);
    if (n.includes('pull-up') || n.includes('pullup')) { keywords.add('pull_up_bar'); keywords.add('pullup'); }
    if (n.includes('dip')) keywords.add('dip_bars');
    if (n.includes('dumbbell')) keywords.add('dumbbells');
    if (n.includes('barbell')) keywords.add('barbell');
    if (n.includes('ez bar') || n.includes('ez-bar')) keywords.add('ez_bar');
    if (n.includes('kettlebell')) keywords.add('kettlebells');
    if (n.includes('bench')) { keywords.add('bench'); keywords.add('flat_bench'); keywords.add('adjustable_bench'); }
    if (n.includes('resistance band') || n.includes('tube band')) { keywords.add('resistance_bands'); keywords.add('bands'); }
    if (n.includes('loop band')) keywords.add('loop_bands');
    if (n.includes('cable')) keywords.add('cable_machine');
    if (n.includes('smith')) keywords.add('smith_machine');
    if (n.includes('leg press')) keywords.add('leg_press_machine');
    if (n.includes('lat pulldown')) keywords.add('lat_pulldown_machine');
    if (n.includes('chest press')) keywords.add('chest_press_machine');
    if (n.includes('shoulder press machine')) keywords.add('shoulder_press_machine');
    if (n.includes('pec deck')) keywords.add('pec_deck_machine');
    if (n.includes('leg curl')) keywords.add('leg_curl_machine');
    if (n.includes('leg extension')) keywords.add('leg_extension_machine');
    if (n.includes('hip thrust machine')) keywords.add('hip_thrust_machine');
    if (n.includes('hack squat')) keywords.add('hack_squat_machine');
    if (n.includes('calf raise machine')) keywords.add('calf_raise_machine');
    if (n.includes('ab crunch machine')) keywords.add('ab_crunch_machine');
    if (n.includes('back extension')) keywords.add('back_extension_machine');
    if (n.includes('assisted pull')) keywords.add('assisted_pullup_machine');
    if (n.includes('treadmill')) keywords.add('treadmill');
    if (n.includes('stationary bike')) keywords.add('stationary_bike');
    if (n.includes('rowing machine')) keywords.add('rowing_machine');
    if (n.includes('elliptical')) keywords.add('elliptical');
    if (n.includes('jump rope')) keywords.add('jump_rope');
    if (n.includes('trx') || n.includes('suspension')) keywords.add('trx');
    if (n.includes('medicine ball')) keywords.add('medicine_ball');
    if (n.includes('kettlebell')) keywords.add('kettlebells');
  });
  return keywords;
}

export default function ExerciseSelector({ value, onChange }) {
  const [exercises, setExercises] = useState([]);
  const [userEquip, setUserEquip] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [muscleFilter, setMuscleFilter] = useState('all');
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    Promise.all([getExercises(), getUserEquipment()])
      .then(([exRes, eqRes]) => { setExercises(exRes.data); setUserEquip(eqRes.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const equipKeywords = useMemo(() => buildEquipmentKeywords(userEquip), [userEquip]);

  const filtered = useMemo(() => {
    return exercises.filter(ex => {
      const available = showAll || userHasEquipmentCheck(ex.required_equipment, equipKeywords);
      const matchSearch = !search || ex.name.toLowerCase().includes(search.toLowerCase());
      const matchMuscle = muscleFilter === 'all' || ex.muscle_group === muscleFilter;
      return available && matchSearch && matchMuscle;
    });
  }, [exercises, equipKeywords, search, muscleFilter, showAll]);

  if (loading) return <Spinner size="sm" />;

  return (
    <div className="flex flex-col gap-3">
      {/* Search */}
      <input
        type="text"
        placeholder="Search exercises..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
      />

      {/* Muscle filter */}
      <div className="flex gap-1.5 flex-wrap">
        {MUSCLE_GROUPS.slice(0, 8).map(mg => (
          <button
            key={mg}
            onClick={() => setMuscleFilter(mg)}
            className={`text-xs px-2 py-1 rounded-lg transition-colors ${muscleFilter === mg ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
          >
            {mg === 'all' ? 'All' : mg.replace('_', ' ')}
          </button>
        ))}
        <button
          onClick={() => setShowAll(s => !s)}
          className={`text-xs px-2 py-1 rounded-lg transition-colors ml-auto ${showAll ? 'bg-gray-600 text-white' : 'bg-gray-800 text-gray-500 hover:bg-gray-700'}`}
        >
          {showAll ? '🔓 All exercises' : '🔒 My equipment only'}
        </button>
      </div>

      {/* Exercise grid */}
      <div className="grid grid-cols-2 gap-1.5 max-h-64 overflow-y-auto pr-1">
        {filtered.length === 0 && (
          <div className="col-span-2 text-center text-gray-500 text-sm py-4">
            No exercises found. <button onClick={() => setShowAll(true)} className="text-emerald-400 underline">Show all</button>
          </div>
        )}
        {filtered.map((ex) => (
          <button
            key={ex.id}
            type="button"
            onClick={() => onChange(ex)}
            className={`flex items-start gap-2 px-3 py-2 rounded-lg text-sm border transition-colors text-left ${
              value?.id === ex.id
                ? 'border-emerald-500 bg-emerald-950 text-emerald-300'
                : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-500'
            }`}
          >
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{ex.name}</div>
              {ex.muscle_group && <div className="text-xs text-gray-500">{ex.muscle_group.replace('_',' ')}</div>}
            </div>
            <Badge type={ex.category}>{ex.category[0].toUpperCase()}</Badge>
          </button>
        ))}
      </div>
      <div className="text-xs text-gray-600">{filtered.length} exercises available</div>
    </div>
  );
}

function userHasEquipmentCheck(required, keywords) {
  if (!required || required === 'null') return true;
  try {
    const arr = JSON.parse(required);
    if (!arr || arr.length === 0) return true;
    return arr.every(req => keywords.has(req));
  } catch { return true; }
}
