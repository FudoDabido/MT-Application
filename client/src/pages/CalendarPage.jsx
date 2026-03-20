import React, { useState, useEffect } from 'react';
import { getCalendarMonth, getCalendarDay, upsertDailyStats } from '../api/calendarApi.js';
import Spinner from '../components/shared/Spinner.jsx';
import Modal from '../components/shared/Modal.jsx';
import Button from '../components/shared/Button.jsx';
import Input from '../components/shared/Input.jsx';

const MUSCLE_COLORS = {
  chest: 'bg-red-900 text-red-300',
  back: 'bg-blue-900 text-blue-300',
  quads: 'bg-yellow-900 text-yellow-300',
  glutes: 'bg-pink-900 text-pink-300',
  hamstrings: 'bg-orange-900 text-orange-300',
  shoulders: 'bg-purple-900 text-purple-300',
  biceps: 'bg-cyan-900 text-cyan-300',
  triceps: 'bg-indigo-900 text-indigo-300',
  core: 'bg-green-900 text-green-300',
  abs: 'bg-green-900 text-green-300',
  calves: 'bg-teal-900 text-teal-300',
  full_body: 'bg-emerald-900 text-emerald-300',
  default: 'bg-gray-800 text-gray-300',
};

function getMuscleColor(mg) { return MUSCLE_COLORS[mg] || MUSCLE_COLORS.default; }

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}
function getFirstDayOfMonth(year, month) {
  return new Date(year, month - 1, 1).getDay(); // 0=Sun
}

export default function CalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [monthData, setMonthData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);
  const [dayDetail, setDayDetail] = useState(null);
  const [dayLoading, setDayLoading] = useState(false);
  const [wakeTime, setWakeTime] = useState('');
  const [savingWake, setSavingWake] = useState(false);

  const yearMonth = `${year}-${String(month).padStart(2, '0')}`;

  useEffect(() => {
    setLoading(true);
    getCalendarMonth(yearMonth)
      .then(r => setMonthData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [yearMonth]);

  function openDay(dateStr) {
    setSelectedDay(dateStr);
    setDayLoading(true);
    getCalendarDay(dateStr)
      .then(r => { setDayDetail(r.data); setWakeTime(r.data.wake_time || ''); })
      .catch(() => {})
      .finally(() => setDayLoading(false));
  }

  async function saveWakeTime() {
    setSavingWake(true);
    try {
      await upsertDailyStats({ date: selectedDay, wake_time: wakeTime });
      setDayDetail(d => ({ ...d, wake_time: wakeTime }));
    } finally {
      setSavingWake(false);
    }
  }

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }

  const dayMap = {};
  monthData.forEach(d => { dayMap[d.day] = d; });

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm">←</button>
          <span className="text-sm font-medium w-40 text-center">{monthName}</span>
          <button onClick={nextMonth} className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm">→</button>
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl p-5">
        {/* Day headers */}
        <div className="grid grid-cols-7 mb-2">
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
            <div key={d} className="text-center text-xs text-gray-500 py-1">{d}</div>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells for first day offset */}
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
            {/* Day cells */}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
              const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
              const data = dayMap[dateStr];
              const isToday = dateStr === now.toISOString().split('T')[0];
              const hasData = !!data;
              return (
                <button
                  key={day}
                  onClick={() => openDay(dateStr)}
                  className={`rounded-lg p-1.5 min-h-14 flex flex-col items-start text-left transition-all hover:ring-2 hover:ring-emerald-500 ${
                    isToday ? 'ring-2 ring-emerald-400 bg-emerald-950' :
                    hasData ? 'bg-gray-800' : 'bg-gray-850 hover:bg-gray-800'
                  }`}
                >
                  <span className={`text-xs font-bold mb-1 ${isToday ? 'text-emerald-400' : 'text-gray-300'}`}>{day}</span>
                  {data && (
                    <>
                      <div className="flex flex-wrap gap-0.5">
                        {(data.muscle_groups || '').split(',').filter(Boolean).slice(0,3).map(mg => (
                          <span key={mg} className={`text-[9px] px-1 rounded ${getMuscleColor(mg.trim())}`}>{mg.trim().slice(0,4)}</span>
                        ))}
                      </div>
                      {data.total_load > 0 && (
                        <span className="text-[9px] text-gray-500 mt-0.5">⚡{data.total_load}</span>
                      )}
                    </>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Day Detail Modal */}
      {selectedDay && (
        <Modal onClose={() => { setSelectedDay(null); setDayDetail(null); }}>
          <h2 className="text-lg font-bold mb-4">
            {new Date(selectedDay + 'T12:00:00').toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </h2>
          {dayLoading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : dayDetail ? (
            <div className="flex flex-col gap-4 max-h-96 overflow-y-auto">
              {/* Wake time */}
              <div className="bg-gray-800 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-2 font-semibold uppercase tracking-wide">Daily Stats</div>
                <div className="flex items-center gap-3">
                  <div className="flex flex-col gap-1 flex-1">
                    <label className="text-xs text-gray-400">Wake Time</label>
                    <input
                      type="time"
                      value={wakeTime}
                      onChange={e => setWakeTime(e.target.value)}
                      className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white w-32"
                    />
                  </div>
                  {dayDetail.first_log && (
                    <div className="text-xs text-gray-400">
                      <div>🏋️ First log: {dayDetail.first_log.slice(11,16)}</div>
                      <div>🏁 Last log: {dayDetail.last_log.slice(11,16)}</div>
                    </div>
                  )}
                  <Button onClick={saveWakeTime} disabled={savingWake} variant="secondary" className="self-end text-xs py-1 px-2">
                    {savingWake ? '...' : 'Save'}
                  </Button>
                </div>
              </div>

              {/* Total load */}
              {dayDetail.total_load > 0 && (
                <div className="flex gap-3">
                  <div className="bg-gray-800 rounded-lg px-4 py-3 flex-1 text-center">
                    <div className="text-xl font-bold text-emerald-400">{dayDetail.total_load}</div>
                    <div className="text-xs text-gray-500">Total Load</div>
                  </div>
                  <div className="bg-gray-800 rounded-lg px-4 py-3 flex-1 text-center">
                    <div className="text-xl font-bold text-blue-400">{dayDetail.total_exercises}</div>
                    <div className="text-xs text-gray-500">Exercises</div>
                  </div>
                </div>
              )}

              {/* Muscle breakdown */}
              {Object.keys(dayDetail.muscle_breakdown || {}).length > 0 && (
                <div>
                  <div className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-2">Muscle Groups Hit</div>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(dayDetail.muscle_breakdown).map(([mg, vol]) => (
                      <span key={mg} className={`text-xs px-2 py-0.5 rounded-full ${getMuscleColor(mg)}`}>
                        {mg} ({vol})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Exercises */}
              {dayDetail.logs && dayDetail.logs.length > 0 && (
                <div>
                  <div className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-2">Exercises</div>
                  <div className="flex flex-col gap-2">
                    {dayDetail.logs.map(log => (
                      <div key={log.id} className="bg-gray-800 rounded-lg p-3 flex gap-3">
                        {log.video_path && (
                          <video src={`/${log.video_path}`} className="w-16 h-12 object-cover rounded shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-medium">{log.exercise_name}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${getMuscleColor(log.muscle_group)}`}>{log.muscle_group}</span>
                          </div>
                          <div className="text-xs text-gray-400 flex gap-2">
                            {log.reps && <span>{log.reps} reps</span>}
                            {log.sets && <span>{log.sets} sets</span>}
                            {log.distance_km && <span>{log.distance_km} km</span>}
                            {log.duration_secs && <span>{Math.round(log.duration_secs/60)} min</span>}
                            <span className="text-gray-600">{log.logged_at.slice(11,16)}</span>
                          </div>
                          {log.notes && <p className="text-xs text-gray-500 mt-0.5 truncate">{log.notes}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {dayDetail.total_exercises === 0 && (
                <p className="text-gray-500 text-sm text-center py-4">No workouts logged on this day.</p>
              )}
            </div>
          ) : null}
        </Modal>
      )}
    </div>
  );
}
