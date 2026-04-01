"use client";
import React, { useEffect, useState } from "react";
import { getLeaderboard } from "../api/leaderboardApi.js";
import { PodiumCard, RankRow } from "../components/leaderboard/LeaderboardTable.jsx";
import UserStatsDrawer from "../components/leaderboard/UserStatsDrawer.jsx";
import Spinner from "../components/shared/Spinner.jsx";
import { getChallenges, searchUser, sendChallenge } from "../api/challengesApi.js";
import { useAuth } from "../context/AuthContext.jsx";


// ── Challenges tab ─────────────────────────────────────────────────────────────
function ChallengesTab() {
  const { user } = useAuth();
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showNew, setShowNew]       = useState(false);
  const [query, setQuery]           = useState("");
  const [found, setFound]           = useState(null);
  const [searching, setSearching]   = useState(false);
  const [duration, setDuration]     = useState(7);
  const [sending, setSending]       = useState(false);
  const [err, setErr]               = useState("");

  function load() {
    setLoading(true);
    getChallenges().then(r => setChallenges(r.data.challenges || [])).catch(() => {}).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  async function handleSearch() {
    if (!query.trim()) return;
    setSearching(true); setFound(null); setErr("");
    try {
      const r = await searchUser(query.trim());
      if (r.data.user) setFound(r.data.user);
      else setErr("User not found");
    } catch { setErr("User not found"); }
    finally { setSearching(false); }
  }

  async function handleSend() {
    if (!found) return;
    setSending(true); setErr("");
    try {
      await sendChallenge({ challenged_id: found.id, duration_days: duration });
      setShowNew(false); setQuery(""); setFound(null);
      load();
    } catch (e) { setErr(e?.response?.data?.error || "Failed"); }
    finally { setSending(false); }
  }

  function daysLeft(endDate) {
    const diff = Math.ceil((new Date(endDate) - new Date()) / 86400000);
    return diff > 0 ? `${diff}d left` : "Ended";
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">{challenges.length} active challenge{challenges.length !== 1 ? "s" : ""}</span>
        <button onClick={() => setShowNew(o => !o)}
          className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition-colors">
          + New Challenge
        </button>
      </div>

      {showNew && (
        <div className="bg-gray-900 rounded-xl p-4 border border-gray-700 flex flex-col gap-3">
          <div className="text-sm font-bold text-white">Challenge a friend</div>
          <div className="flex gap-2">
            <input value={query} onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              placeholder="Search by username"
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500" />
            <button onClick={handleSearch} disabled={searching}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors">
              {searching ? "…" : "Search"}
            </button>
          </div>
          {found && (
            <div className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2">
              <span className="text-sm text-white">{found.name} <span className="text-gray-500">@{found.username}</span></span>
              <span className="text-xs text-emerald-400">Found ✓</span>
            </div>
          )}
          {err && <p className="text-red-400 text-xs">{err}</p>}
          <div>
            <div className="text-xs text-gray-500 mb-1">Duration</div>
            <div className="flex gap-2">
              {[7, 14, 30].map(d => (
                <button key={d} onClick={() => setDuration(d)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${duration === d ? "bg-emerald-700 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}>
                  {d} days
                </button>
              ))}
            </div>
          </div>
          <button onClick={handleSend} disabled={!found || sending}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-sm rounded-lg transition-colors">
            {sending ? "Sending…" : "Send Challenge →"}
          </button>
        </div>
      )}

      {loading ? <div className="flex justify-center py-8"><Spinner /></div> :
        challenges.length === 0 ? (
          <div className="text-center py-8 text-gray-600 text-sm">No active challenges. Challenge a friend!</div>
        ) : (
          <div className="flex flex-col gap-3">
            {challenges.map(c => {
              const isChallenger = c.challenger_id === user?.id;
              const myScore = isChallenger ? c.my_score : c.their_score;
              const theirScore = isChallenger ? c.their_score : c.my_score;
              const opponentName = isChallenger ? c.challenged_name : c.challenger_name;
              const winning = myScore >= theirScore;
              const maxScore = Math.max(myScore, theirScore, 1);
              return (
                <div key={c.id} className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-bold text-white">vs {opponentName}</span>
                    <span className="text-xs text-gray-500">{daysLeft(c.end_date)}</span>
                  </div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex-1">
                      <div className="text-xs text-gray-500 mb-1">You</div>
                      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(myScore / maxScore) * 100}%` }} />
                      </div>
                    </div>
                    <div className={`text-lg font-black tabular-nums ${winning ? "text-emerald-400" : "text-gray-400"}`}>
                      {myScore} – {theirScore}
                    </div>
                    <div className="flex-1">
                      <div className="text-xs text-gray-500 mb-1 text-right">{opponentName}</div>
                      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-orange-500 rounded-full ml-auto" style={{ width: `${(theirScore / maxScore) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] text-gray-600 text-center">{c.start_date} → {c.end_date}</div>
                </div>
              );
            })}
          </div>
        )
      }
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LeaderboardPage() {
  const [users,   setUsers]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [tab,     setTab]       = useState("global");
  const [selected, setSelected] = useState(null); // { userId, rank }

  useEffect(() => {
    if (tab !== "global") return;
    setLoading(true);
    getLeaderboard().then(r => setUsers(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [tab]);

  const now = new Date();
  const monthName = now.toLocaleString("default", { month: "long", year: "numeric" });

  const top3 = users.slice(0, 3);
  const rest  = users.slice(3);

  return (
    <div className="flex flex-col gap-4 pb-24" style={{ paddingTop: 'max(env(safe-area-inset-top), 16px)' }}>
      <div className="px-4">
        <h1 className="text-2xl font-bold">Leaderboard</h1>
        <p className="text-gray-400 text-sm mt-0.5">{monthName} · Ranked by personal records</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 rounded-xl p-1 mx-4">
        {[["global","🏆 Global"],["challenges","⚔️ Challenges"]].map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${tab === k ? "bg-gray-800 text-white" : "text-gray-500"}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === "global" ? (
        loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 text-gray-600 text-sm px-4">No athletes yet. Log some workouts!</div>
        ) : (
          <>
            {/* Podium — top 3 */}
            {top3.length > 0 && (
              <div className="flex gap-3 px-4">
                {top3.map((u, i) => (
                  <PodiumCard
                    key={u.id}
                    rank={i + 1}
                    user={u}
                    onClick={() => setSelected({ userId: u.id, rank: i + 1 })}
                  />
                ))}
              </div>
            )}

            {/* Ranks 4–10 */}
            {rest.length > 0 && (
              <div className="bg-gray-900 rounded-2xl mx-4 overflow-hidden divide-y divide-gray-800">
                {rest.map((u, i) => (
                  <RankRow
                    key={u.id}
                    rank={i + 4}
                    user={u}
                    onClick={() => setSelected({ userId: u.id, rank: i + 4 })}
                  />
                ))}
              </div>
            )}
          </>
        )
      ) : (
        <div className="px-4">
          <ChallengesTab />
        </div>
      )}

      {/* User stats drawer */}
      {selected && (
        <UserStatsDrawer
          userId={selected.userId}
          rank={selected.rank}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
