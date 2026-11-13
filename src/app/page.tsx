'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Waves, Heart, Activity, ShieldCheck, CheckCircle2, UserCheck,
  BarChart3, Timer, Filter, Save, AlertCircle, Plus, Trash2,
  LogOut, Lock, FileSignature, Trophy, Target, Users, RefreshCw, Layers
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

// --- Types & Interfaces ---
type UserRole = 'coach' | 'parent' | 'athlete';

interface AthleteProfile {
  id: string;
  full_name: string;
  nickname: string;
  lane: number;
  age_group: string;
  gender: 'Male' | 'Female';
  athlete_code: string;
  pin_code: string;
  pdpa_signed: boolean;
  parent_name: string;
}

interface PoolsideRow extends AthleteProfile {
  targetTime: string;
  actualTime: string;
  attended: boolean;
  srpe: number;
}

interface ACWRResult {
  athlete: AthleteProfile;
  acuteLoad: number;
  chronicLoad: number;
  acwr: number;
  sessionCount28d: number;
  latestRhr: number | null;
  latestShoulder: number | null;
}

interface TSAStandard {
  id: string;
  course: '50m' | '25m';
  age_group: string;
  gender: string;
  stroke: string;
  distance_m: number;
  qualifying_time_sec: number;
  is_official: boolean;
  source_notes: string;
}

interface CompLog {
  id: string;
  athlete_id: string;
  meet_name: string;
  course: '50m' | '25m';
  stroke: string;
  distance_m: number;
  official_time_sec: number;
}

interface WorkoutItem {
  id: string;
  reps: number;
  distance: number;
  stroke: string;
  restSec: number;
}

interface WorkoutGroup {
  id: string;
  category: 'Warm-up' | 'Pre-set' | 'Main Set' | 'Cool-down';
  rounds: number;
  restBetweenRounds: number;
  items: WorkoutItem[];
}

const AGE_GROUP_LABELS: Record<string, string> = {
  group_5: 'กลุ่ม 5 (7–9 ปี)',
  group_4: 'กลุ่ม 4 (10–11 ปี)',
  group_3: 'กลุ่ม 3 (12–13 ปี)',
  group_2: 'กลุ่ม 2 (14–15 ปี)',
  group_1: 'กลุ่ม 1 (16–18 ปี)',
  open: 'รุ่นทั่วไป (Open)',
};

export default function ApexAquaProductionApp() {
  // --- 1. Authentication & RBAC State ---
  const [currentUser, setCurrentUser] = useState<{
    role: UserRole;
    name: string;
    athleteId?: string;
  } | null>(null);

  const [loginTab, setLoginTab] = useState<UserRole>('coach');
  const [coachPasscode, setCoachPasscode] = useState('');
  const [selectedAthleteLoginId, setSelectedAthleteLoginId] = useState('');
  const [athletePinInput, setAthletePinInput] = useState('');
  const [loginError, setLoginError] = useState('');

  // --- 2. Core Data State (ดึงจาก Supabase จริง) ---
  const [athletes, setAthletes] = useState<AthleteProfile[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState<'poolside' | 'readiness' | 'acwr_tsa' | 'pdpa' | 'builder'>('poolside');

  // --- 3. Add New Athlete Modal State ---
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAthlete, setNewAthlete] = useState({
    full_name: '',
    nickname: '',
    lane: 1,
    age_group: 'group_4',
    gender: 'Male' as 'Male' | 'Female',
    athlete_code: '',
    pin_code: '1234',
    parent_name: '',
  });
  const [addingAthlete, setAddingAthlete] = useState(false);

  // --- 4. Tab 1: Poolside State ---
  const [poolsideRows, setPoolsideRows] = useState<PoolsideRow[]>([]);
  const [selectedLane, setSelectedLane] = useState<number | 'all'>('all');
  const [sessionDuration, setSessionDuration] = useState<number>(90);
  const [savingPoolside, setSavingPoolside] = useState(false);
  const [poolsideMsg, setPoolsideMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // --- 5. Tab 2: Morning Readiness State ---
  const [readinessAthleteId, setReadinessAthleteId] = useState('');
  const [rhr, setRhr] = useState(64);
  const [sleepHours, setSleepHours] = useState(8);
  const [sleepQuality, setSleepQuality] = useState(4);
  const [soreness, setSoreness] = useState({
    shoulder: 1,
    lat: 1,
    core: 1,
    knee: 1,
    ankle: 1,
  });
  const [savingReadiness, setSavingReadiness] = useState(false);
  const [readinessMsg, setReadinessMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // --- 6. Tab 3: ACWR & TSA Benchmark State ---
  const [acwrList, setAcwrList] = useState<ACWRResult[]>([]);
  const [tsaStandards, setTsaStandards] = useState<TSAStandard[]>([]);
  const [compLogs, setCompLogs] = useState<CompLog[]>([]);
  const [tsaCourse, setTsaCourse] = useState<'50m' | '25m'>('50m');
  const [selectedBenchmarkAthleteId, setSelectedBenchmarkAthleteId] = useState('');
  const [newComp, setNewComp] = useState({
    meet_name: 'รายการทดสอบเวลาสโมสร',
    stroke: 'Freestyle',
    distance_m: 50,
    official_time_sec: '',
  });

  // --- 7. Tab 4: PDPA E-Consent State ---
  const [parentSignerName, setParentSignerName] = useState('');
  const [pdpaTargetAthleteId, setPdpaTargetAthleteId] = useState('');

  // --- 8. Tab 5: Workout Builder State ---
  const [workoutTitle, setWorkoutTitle] = useState('Aerobic Threshold & Speed Endurance Set');
  const [css100m, setCss100m] = useState(75);
  const [groups, setGroups] = useState<WorkoutGroup[]>([
    {
      id: 'g1',
      category: 'Warm-up',
      rounds: 1,
      restBetweenRounds: 30,
      items: [{ id: 'i1', reps: 1, distance: 400, stroke: 'Freestyle', restSec: 20 }],
    },
    {
      id: 'g2',
      category: 'Main Set',
      rounds: 2,
      restBetweenRounds: 90,
      items: [
        { id: 'i2', reps: 4, distance: 100, stroke: 'Freestyle', restSec: 15 },
        { id: 'i3', reps: 4, distance: 50, stroke: 'Butterfly', restSec: 60 },
      ],
    },
  ]);
  const [savingWorkout, setSavingWorkout] = useState(false);
  const [workoutMsg, setWorkoutMsg] = useState<string | null>(null);

  // --- Fetch Athletes & Base Data from Supabase ---
  const fetchAllData = useCallback(async () => {
    setLoadingData(true);
    try {
      const { data: profData, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'athlete')
        .order('lane', { ascending: true });

      if (profErr) throw profErr;
      const list = (profData || []) as AthleteProfile[];
      setAthletes(list);

      // Sync Poolside Rows
      setPoolsideRows((prev) =>
        list.map((a) => {
          const existing = prev.find((p) => p.id === a.id);
          return (
            existing || {
              ...a,
              targetTime: '0:45.00',
              actualTime: '',
              attended: true,
              srpe: 6,
            }
          );
        })
      );

      if (list.length > 0) {
        if (!readinessAthleteId) setReadinessAthleteId(list[0].id);
        if (!selectedAthleteLoginId) setSelectedAthleteLoginId(list[0].id);
        if (!selectedBenchmarkAthleteId) setSelectedBenchmarkAthleteId(list[0].id);
        if (!pdpaTargetAthleteId) setPdpaTargetAthleteId(list[0].id);
      }

      // Fetch Workout Logs & Readiness for ACWR
      const twentyEightDaysAgo = new Date();
      twentyEightDaysAgo.setDate(twentyEightDaysAgo.getDate() - 28);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: logsData } = await supabase
        .from('workout_logs')
        .select('*')
        .gte('workout_date', twentyEightDaysAgo.toISOString().split('T')[0]);

      const { data: readyData } = await supabase
        .from('daily_readiness')
        .select('*')
        .order('created_at', { ascending: false });

      const computedAcwr: ACWRResult[] = list.map((ath) => {
        const athLogs = (logsData || []).filter((l) => l.athlete_id === ath.id);
        const chronicTotal = athLogs.reduce((acc, cur) => acc + Number(cur.session_load_au || 0), 0);
        const acuteTotal = athLogs
          .filter((l) => new Date(l.workout_date) >= sevenDaysAgo)
          .reduce((acc, cur) => acc + Number(cur.session_load_au || 0), 0);

        const chronicAvg = chronicTotal / 4;
        const acwrVal = chronicAvg > 0 ? Number((acuteTotal / chronicAvg).toFixed(2)) : 0;

        const latestR = (readyData || []).find((r) => r.athlete_id === ath.id);
        return {
          athlete: ath,
          acuteLoad: acuteTotal,
          chronicLoad: chronicTotal,
          acwr: acwrVal,
          sessionCount28d: athLogs.length,
          latestRhr: latestR ? latestR.rhr : null,
          latestShoulder: latestR ? latestR.shoulder_soreness : null,
        };
      });
      setAcwrList(computedAcwr);

      // Fetch TSA Standards & Competition Logs
      const { data: tsaData } = await supabase.from('tsa_standards').select('*');
      setTsaStandards((tsaData || []) as TSAStandard[]);

      const { data: compData } = await supabase
        .from('competition_logs')
        .select('*')
        .order('official_time_sec', { ascending: true });
      setCompLogs((compData || []) as CompLog[]);
    } catch (err) {
      console.error('Error loading Supabase data:', err);
    } finally {
      setLoadingData(false);
    }
  }, [readinessAthleteId, selectedAthleteLoginId, selectedBenchmarkAthleteId, pdpaTargetAthleteId]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // --- Handlers: Login ---
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    if (loginTab === 'coach') {
      if (coachPasscode === 'coach2026' || coachPasscode === '1234') {
        setCurrentUser({ role: 'coach', name: 'หัวหน้าผู้ฝึกสอน (Head Coach)' });
        setActiveTab('poolside');
      } else {
        setLoginError('รหัสผ่านโค้ชไม่ถูกต้อง (ค่าเริ่มต้น: 1234)');
      }
    } else if (loginTab === 'parent') {
      const ath = athletes.find((a) => a.id === selectedAthleteLoginId);
      if (!ath) {
        setLoginError('กรุณาเลือกชื่อนักกีฬาในความดูแล (หรือให้โค้ชเพิ่มรายชื่อนักกีฬาก่อน)');
        return;
      }
      if (athletePinInput === ath.pin_code) {
        setCurrentUser({
          role: 'parent',
          name: `ผู้ปกครองของ ${ath.nickname || ath.full_name}`,
          athleteId: ath.id,
        });
        setPdpaTargetAthleteId(ath.id);
        setParentSignerName(ath.parent_name || '');
        setActiveTab('pdpa');
      } else {
        setLoginError('รหัส PIN 4 หลักไม่ถูกต้อง (ค่าเริ่มต้น: 1234)');
      }
    } else if (loginTab === 'athlete') {
      const ath = athletes.find((a) => a.id === selectedAthleteLoginId);
      if (!ath) {
        setLoginError('ยังไม่มีรายชื่อนักกีฬาในระบบ กรุณาให้โค้ชเพิ่มรายชื่อก่อน');
        return;
      }
      if (athletePinInput === ath.pin_code) {
        setCurrentUser({
          role: 'athlete',
          name: `${ath.full_name} (${ath.nickname})`,
          athleteId: ath.id,
        });
        setReadinessAthleteId(ath.id);
        setSelectedBenchmarkAthleteId(ath.id);
        setActiveTab('readiness');
      } else {
        setLoginError('รหัส PIN 4 หลักไม่ถูกต้อง (ค่าเริ่มต้น: 1234)');
      }
    }
  };

  // --- Handler: Add New Real Athlete ---
  const handleAddAthlete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAthlete.full_name.trim()) return;
    setAddingAthlete(true);
    try {
      const code = newAthlete.athlete_code.trim() || `SW-${Math.floor(1000 + Math.random() * 9000)}`;
      const { error } = await supabase.from('profiles').insert([
        {
          full_name: newAthlete.full_name.trim(),
          nickname: newAthlete.nickname.trim() || newAthlete.full_name.split(' ')[0],
          role: 'athlete',
          lane: Number(newAthlete.lane),
          age_group: newAthlete.age_group,
          gender: newAthlete.gender,
          athlete_code: code,
          pin_code: newAthlete.pin_code || '1234',
          parent_name: newAthlete.parent_name.trim(),
          pdpa_signed: false,
        },
      ]);
      if (error) throw error;
      setShowAddModal(false);
      setNewAthlete({
        full_name: '',
        nickname: '',
        lane: 1,
        age_group: 'group_4',
        gender: 'Male',
        athlete_code: '',
        pin_code: '1234',
        parent_name: '',
      });
      await fetchAllData();
    } catch (err: unknown) {
      alert('เกิดข้อผิดพลาดในการเพิ่มนักกีฬา: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setAddingAthlete(false);
    }
  };

  const handleDeleteAthlete = async (id: string, name: string) => {
    if (!confirm(`ยืนยันการลบรายชื่อ "${name}" และประวัติทั้งหมดออกจากฐานข้อมูลจริง?`)) return;
    await supabase.from('profiles').delete().eq('id', id);
    await fetchAllData();
  };

  // --- Handler: Tab 1 Save Poolside Batch ---
  const handleSavePoolside = async () => {
    const attendedRows = poolsideRows.filter((r) => r.attended);
    if (attendedRows.length === 0) return;
    setSavingPoolside(true);
    setPoolsideMsg(null);
    try {
      const payload = attendedRows.map((r) => ({
        athlete_id: r.id,
        workout_date: new Date().toISOString().split('T')[0],
        duration_minutes: sessionDuration,
        srpe: r.srpe,
        attended: true,
      }));
      const { error } = await supabase.from('workout_logs').insert(payload);
      if (error) throw error;
      setPoolsideMsg({
        type: 'ok',
        text: `บันทึกภาระงานจริงของนักกีฬา ${attendedRows.length} คน ลง Supabase เรียบร้อยแล้ว!`,
      });
      await fetchAllData();
    } catch (err: unknown) {
      setPoolsideMsg({
        type: 'err',
        text: 'บันทึกไม่สำเร็จ: ' + (err instanceof Error ? err.message : String(err)),
      });
    } finally {
      setSavingPoolside(false);
    }
  };

  // --- Handler: Tab 2 Save Morning Readiness ---
  const handleSaveReadiness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!readinessAthleteId) return;
    setSavingReadiness(true);
    setReadinessMsg(null);
    try {
      const { error } = await supabase.from('daily_readiness').insert([
        {
          athlete_id: readinessAthleteId,
          rhr,
          sleep_hours: sleepHours,
          sleep_quality: sleepQuality,
          shoulder_soreness: soreness.shoulder,
          lat_soreness: soreness.lat,
          core_soreness: soreness.core,
          knee_soreness: soreness.knee,
          ankle_soreness: soreness.ankle,
        },
      ]);
      if (error) throw error;
      setReadinessMsg({ type: 'ok', text: 'ส่งข้อมูลความพร้อมเช้าลงฐานข้อมูล Supabase เรียบร้อยแล้ว!' });
      await fetchAllData();
    } catch (err: unknown) {
      setReadinessMsg({
        type: 'err',
        text: 'เกิดข้อผิดพลาด: ' + (err instanceof Error ? err.message : String(err)),
      });
    } finally {
      setSavingReadiness(false);
    }
  };

  // --- Handler: Tab 3 Add Competition PB ---
  const handleAddCompTime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBenchmarkAthleteId || !newComp.official_time_sec) return;
    try {
      const { error } = await supabase.from('competition_logs').insert([
        {
          athlete_id: selectedBenchmarkAthleteId,
          meet_name: newComp.meet_name,
          course: tsaCourse,
          stroke: newComp.stroke,
          distance_m: Number(newComp.distance_m),
          official_time_sec: Number(newComp.official_time_sec),
        },
      ]);
      if (error) throw error;
      setNewComp({ ...newComp, official_time_sec: '' });
      await fetchAllData();
    } catch (err: unknown) {
      alert('บันทึกเวลาไม่สำเร็จ: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  // --- Handler: Tab 4 Sign PDPA E-Consent ---
  const handleSignPdpa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pdpaTargetAthleteId || !parentSignerName.trim()) return;
    try {
      await supabase.from('pdpa_consents').insert([
        {
          athlete_id: pdpaTargetAthleteId,
          parent_name: parentSignerName.trim(),
          consent_status: true,
          policy_version: 'v2.2',
        },
      ]);
      await supabase
        .from('profiles')
        .update({ pdpa_signed: true, parent_name: parentSignerName.trim() })
        .eq('id', pdpaTargetAthleteId);
      alert('ลงนามยินยอม PDPA E-Consent เรียบร้อยแล้ว! เปิดสิทธิ์การใช้งานให้นักกีฬาสมบูรณ์');
      await fetchAllData();
    } catch (err: unknown) {
      alert('เกิดข้อผิดพลาด: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  // --- Workout Builder Helpers ---
  const classifyZone = (cat: string, dist: number, rest: number) => {
    if (cat === 'Warm-up' || cat === 'Cool-down') return { code: 'REC', label: 'Recovery', color: 'text-emerald-400 border-emerald-700 bg-emerald-950/60', mult: 1.3 };
    if (dist <= 25 && rest >= 30) return { code: 'SP3', label: 'Alactic Speed', color: 'text-rose-400 border-rose-700 bg-rose-950/60', mult: 0.85 };
    if (dist <= 50 && rest >= 60) return { code: 'SP2', label: 'Lactate Prod.', color: 'text-orange-400 border-orange-700 bg-orange-950/60', mult: 0.90 };
    if (dist <= 100 && rest >= 45) return { code: 'SP1', label: 'Lactate Tol.', color: 'text-amber-400 border-amber-700 bg-amber-950/60', mult: 0.95 };
    if (dist <= 200 && rest >= 20) return { code: 'EN3', label: 'VO2max', color: 'text-purple-400 border-purple-700 bg-purple-950/60', mult: 0.98 };
    if (dist >= 100 && rest >= 10 && rest <= 20) return { code: 'EN2', label: 'Threshold (AT)', color: 'text-cyan-400 border-cyan-700 bg-cyan-950/60', mult: 1.02 };
    return { code: 'EN1', label: 'Basic Aerobic', color: 'text-blue-400 border-blue-700 bg-blue-950/60', mult: 1.12 };
  };

  const calcInterval = (dist: number, rest: number, mult: number) => {
    const swimSec = (dist / 100) * css100m * mult;
    const rawTotal = swimSec + rest;
    const rounded = Math.ceil(rawTotal / 5) * 5;
    const m = Math.floor(rounded / 60);
    const s = rounded % 60;
    return `@ ${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const totalWorkoutDist = groups.reduce(
    (gAcc, g) => gAcc + g.rounds * g.items.reduce((iAcc, i) => iAcc + i.reps * i.distance, 0),
    0
  );

  const handleSaveWorkout = async () => {
    setSavingWorkout(true);
    setWorkoutMsg(null);
    try {
      const { error } = await supabase.from('workouts').insert([
        {
          title: workoutTitle,
          total_distance_m: totalWorkoutDist,
          set_data: groups,
        },
      ]);
      if (error) throw error;
      setWorkoutMsg(`บันทึกโปรแกรม "${workoutTitle}" (${totalWorkoutDist.toLocaleString()} ม.) ลง Supabase สำเร็จ!`);
    } catch (err: unknown) {
      alert('บันทึกโปรแกรมไม่สำเร็จ: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSavingWorkout(false);
    }
  };

  // ============================================================================
  // VIEW 1: LOGIN SCREEN (RBAC & PDPA GATE)
  // ============================================================================
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-7 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
              <Waves className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">ApexAqua</h1>
            <p className="text-xs text-slate-400">
              ระบบบริหารและวิเคราะห์ศักยภาพนักกีฬาว่ายน้ำสโมสร (มาตรฐานสากล & PDPA)
            </p>
          </div>

          {/* Role Tabs */}
          <div className="grid grid-cols-3 gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 text-xs font-bold">
            <button
              type="button"
              onClick={() => { setLoginTab('coach'); setLoginError(''); }}
              className={`py-2 rounded-xl transition-all ${loginTab === 'coach' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              โค้ช / Admin
            </button>
            <button
              type="button"
              onClick={() => { setLoginTab('parent'); setLoginError(''); }}
              className={`py-2 rounded-xl transition-all ${loginTab === 'parent' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              ผู้ปกครอง
            </button>
            <button
              type="button"
              onClick={() => { setLoginTab('athlete'); setLoginError(''); }}
              className={`py-2 rounded-xl transition-all ${loginTab === 'athlete' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              นักกีฬา
            </button>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {loginTab === 'coach' ? (
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  รหัสผ่านสำหรับหัวหน้าผู้ฝึกสอน (Coach Passcode)
                </label>
                <input
                  type="password"
                  placeholder="กรอกรหัสผ่าน (ค่าเริ่มต้น: 1234)"
                  value={coachPasscode}
                  onChange={(e) => setCoachPasscode(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:border-cyan-500 outline-none"
                />
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    {loginTab === 'parent' ? 'เลือกชื่อนักกีฬาในความดูแล' : 'เลือกชื่อนักกีฬาของคุณ'}
                  </label>
                  <select
                    value={selectedAthleteLoginId}
                    onChange={(e) => setSelectedAthleteLoginId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:border-cyan-500 outline-none"
                  >
                    {athletes.length === 0 && <option value="">-- ยังไม่มีรายชื่อนักกีฬา (ให้โค้ชเพิ่มก่อน) --</option>}
                    {athletes.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.full_name} ({a.nickname}) - {AGE_GROUP_LABELS[a.age_group] || a.age_group}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    รหัส PIN ประจำตัว 4 หลัก (ค่าเริ่มต้น: 1234)
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    placeholder="••••"
                    value={athletePinInput}
                    onChange={(e) => setAthletePinInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-center tracking-widest text-lg font-mono text-white focus:border-cyan-500 outline-none"
                  />
                </div>
              </>
            )}

            {loginError && (
              <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2"
            >
              <Lock className="h-4 w-4" />
              <span>เข้าสู่ระบบ ApexAqua</span>
            </button>
          </form>

          <div className="pt-3 border-t border-slate-800/80 text-center text-[11px] text-slate-500">
            คุ้มครองข้อมูลสุขภาพเยาวชนตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA)
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // VIEW 2: PDPA CONSENT GATE (บล็อกนักกีฬาเยาวชนหากผู้ปกครองยังไม่เซ็นยินยอม)
  // ============================================================================
  const currentAthleteObj = athletes.find((a) => a.id === currentUser.athleteId);
  if (currentUser.role === 'athlete' && currentAthleteObj && !currentAthleteObj.pdpa_signed) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-amber-700/60 rounded-3xl p-7 text-center space-y-5 shadow-2xl">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <ShieldCheck className="h-9 w-9" />
          </div>
          <h2 className="text-xl font-black text-white">รอการลงนามยินยอม PDPA จากผู้ปกครอง</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            สวัสดี <b>{currentAthleteObj.nickname}</b> ตามกฎหมายคุ้มครองข้อมูลส่วนบุคคล (PDPA) สำหรับเยาวชน 
            ต้องให้ผู้ปกครองเข้าสู่ระบบในแท็บ <b>"ผู้ปกครอง"</b> เพื่อลงนาม Digital E-Consent ก่อนจึงจะเริ่มบันทึกข้อมูลสุขภาพได้
          </p>
          <button
            onClick={() => setCurrentUser(null)}
            className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition-all"
          >
            กลับหน้าล็อกอิน (เพื่อให้ผู้ปกครองเข้าลงนาม)
          </button>
        </div>
      </div>
    );
  }

  // ============================================================================
  // VIEW 3: MAIN APPLICATION DASHBOARD (RBAC FILTERED)
  // ============================================================================
  const filteredPoolside =
    selectedLane === 'all' ? poolsideRows : poolsideRows.filter((r) => r.lane === selectedLane);

  const visibleAthletesForRole =
    currentUser.role === 'coach'
      ? athletes
      : athletes.filter((a) => a.id === currentUser.athleteId);

  const visibleAcwrForRole =
    currentUser.role === 'coach'
      ? acwrList
      : acwrList.filter((item) => item.athlete.id === currentUser.athleteId);

  const selectedBenchmarkAthlete = athletes.find((a) => a.id === selectedBenchmarkAthleteId);
  const matchingStandards = tsaStandards.filter(
    (s) =>
      s.course === tsaCourse &&
      (!selectedBenchmarkAthlete ||
        (s.age_group === selectedBenchmarkAthlete.age_group &&
          s.gender === selectedBenchmarkAthlete.gender))
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 py-3">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow">
              <Waves className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-lg text-white">ApexAqua</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-700">
                  LIVE DB
                </span>
              </div>
              <p className="text-[11px] text-cyan-400 font-semibold">
                ผู้ใช้งาน: {currentUser.name}
              </p>
            </div>
          </div>

          {/* Navigation Tabs Filtered by Role */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 text-xs font-bold">
            {currentUser.role === 'coach' && (
              <button
                onClick={() => setActiveTab('poolside')}
                className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all ${
                  activeTab === 'poolside' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Timer className="h-3.5 w-3.5" /> 1. คุมริมสระ & รายชื่อทีม
              </button>
            )}

            {(currentUser.role === 'coach' || currentUser.role === 'athlete' || currentUser.role === 'parent') && (
              <button
                onClick={() => setActiveTab('readiness')}
                className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all ${
                  activeTab === 'readiness' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Heart className="h-3.5 w-3.5" /> 2. เช็กอินเช้า (Readiness)
              </button>
            )}

            <button
              onClick={() => setActiveTab('acwr_tsa')}
              className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all ${
                activeTab === 'acwr_tsa' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" /> 3. ACWR & สถิติ TSA
            </button>

            {(currentUser.role === 'coach' || currentUser.role === 'parent') && (
              <button
                onClick={() => setActiveTab('pdpa')}
                className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all ${
                  activeTab === 'pdpa' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5" /> 4. สรุปครอบครัว & PDPA
              </button>
            )}

            {currentUser.role === 'coach' && (
              <button
                onClick={() => setActiveTab('builder')}
                className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all ${
                  activeTab === 'builder' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Layers className="h-3.5 w-3.5" /> 5. จัดเซตซ้อม
              </button>
            )}

            <button
              onClick={() => setCurrentUser(null)}
              className="px-3 py-1.5 rounded-xl bg-rose-950/60 text-rose-400 hover:bg-rose-900 hover:text-white flex items-center gap-1 ml-1"
              title="ออกจากระบบ"
            >
              <LogOut className="h-3.5 w-3.5" /> ออก
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 mt-2">
        {/* ==================================================================== */}
        {/* TAB 1: POOLSIDE & REAL ROSTER MANAGEMENT                             */}
        {/* ==================================================================== */}
        {activeTab === 'poolside' && currentUser.role === 'coach' && (
          <div className="space-y-4">
            {/* Action Bar */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setShowAddModal(true)}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg"
                >
                  <Plus className="h-4 w-4" /> เพิ่มรายชื่อนักกีฬาจริง
                </button>

                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold ml-2">
                  <Filter className="h-3.5 w-3.5 text-slate-400 ml-2 mr-1" />
                  <button
                    onClick={() => setSelectedLane('all')}
                    className={`px-2.5 py-1 rounded-lg ${selectedLane === 'all' ? 'bg-slate-800 text-cyan-400' : 'text-slate-400'}`}
                  >
                    ทุกลู่ ({athletes.length})
                  </button>
                  {[1, 2, 3, 4].map((l) => (
                    <button
                      key={l}
                      onClick={() => setSelectedLane(l)}
                      className={`px-2.5 py-1 rounded-lg ${selectedLane === l ? 'bg-slate-800 text-cyan-400' : 'text-slate-400'}`}
                    >
                      ลู่ {l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
                  <span className="text-slate-400">เวลาซ้อม:</span>
                  <input
                    type="number"
                    value={sessionDuration}
                    onChange={(e) => setSessionDuration(Number(e.target.value))}
                    className="w-12 bg-transparent text-center font-bold text-cyan-400 outline-none"
                  />
                  <span className="text-slate-500">นาที</span>
                </div>

                <button
                  onClick={handleSavePoolside}
                  disabled={savingPoolside || athletes.length === 0}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg"
                >
                  <Save className="h-4 w-4" />
                  <span>{savingPoolside ? 'กำลังบันทึก...' : 'บันทึกคะแนนทั้งสระ'}</span>
                </button>
              </div>
            </div>

            {poolsideMsg && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                  poolsideMsg.type === 'ok'
                    ? 'bg-emerald-950/70 border-emerald-800 text-emerald-300'
                    : 'bg-rose-950/70 border-rose-800 text-rose-300'
                }`}
              >
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{poolsideMsg.text}</span>
              </div>
            )}

            {/* Empty State when no test data */}
            {!loadingData && athletes.length === 0 ? (
              <div className="bg-slate-900 border border-dashed border-slate-700 rounded-3xl p-12 text-center space-y-3">
                <Users className="h-12 w-12 text-slate-600 mx-auto" />
                <h3 className="text-lg font-bold text-white">ยังไม่มีรายชื่อนักกีฬาในระบบ</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  ข้อมูลทดสอบทั้งหมดถูกล้างเรียบร้อยแล้ว กดปุ่ม <b>"+ เพิ่มรายชื่อนักกีฬาจริง"</b> ด้านบนเพื่อเริ่มลงทะเบียนนักกีฬาของสโมสรคุณได้เลยครับ
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPoolside.map((row) => (
                  <div
                    key={row.id}
                    className={`bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-all ${
                      !row.attended && 'opacity-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-[240px]">
                      <button
                        onClick={() =>
                          setPoolsideRows((prev) =>
                            prev.map((p) => (p.id === row.id ? { ...p, attended: !p.attended } : p))
                          )
                        }
                        className={`h-8 w-8 rounded-xl font-black text-sm flex items-center justify-center ${
                          row.attended ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        ✓
                      </button>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-800 text-cyan-400">
                            ลู่ {row.lane}
                          </span>
                          <span className="font-bold text-sm text-white">
                            {row.full_name} ({row.nickname})
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                          <span>{AGE_GROUP_LABELS[row.age_group] || row.age_group}</span>
                          <span>• PIN: {row.pin_code}</span>
                          {row.pdpa_signed ? (
                            <span className="text-emerald-400 font-bold">• PDPA ✓</span>
                          ) : (
                            <span className="text-amber-400">• รอ PDPA</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* sRPE Borg CR-10 */}
                    <div className="flex-1 max-w-lg">
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-slate-400">
                          ความเหนื่อย sRPE: <b className="text-cyan-400">{row.attended ? `${row.srpe}/10` : '-'}</b>
                        </span>
                        <span className="font-bold text-amber-400">
                          Session Load: {row.attended ? row.srpe * sessionDuration : 0} AU
                        </span>
                      </div>
                      <div className="grid grid-cols-11 gap-1">
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                          <button
                            key={num}
                            disabled={!row.attended}
                            onClick={() =>
                              setPoolsideRows((prev) =>
                                prev.map((p) => (p.id === row.id ? { ...p, srpe: num } : p))
                              )
                            }
                            className={`h-8 rounded-lg text-xs font-bold ${
                              row.srpe === num && row.attended
                                ? num >= 8
                                  ? 'bg-rose-600 text-white'
                                  : num >= 5
                                  ? 'bg-amber-500 text-white'
                                  : 'bg-cyan-600 text-white'
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                            }`}
                          >
                            {num}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteAthlete(row.id, row.full_name)}
                      className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 self-end lg:self-center"
                      title="ลบรายชื่อนักกีฬา"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Athlete Modal */}
            {showAddModal && (
              <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
                  <h3 className="text-lg font-black text-white">เพิ่มรายชื่อนักกีฬาจริงเข้าสโมสร</h3>
                  <form onSubmit={handleAddAthlete} className="space-y-3 text-xs">
                    <div>
                      <label className="block text-slate-400 mb-1">ชื่อ - นามสกุลจริง *</label>
                      <input
                        required
                        type="text"
                        placeholder="เช่น ด.ช. ธนกฤต ใจดี"
                        value={newAthlete.full_name}
                        onChange={(e) => setNewAthlete({ ...newAthlete, full_name: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-white"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-400 mb-1">ชื่อเล่น</label>
                        <input
                          type="text"
                          placeholder="เช่น น้องกฤต"
                          value={newAthlete.nickname}
                          onChange={(e) => setNewAthlete({ ...newAthlete, nickname: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">เพศ (สำหรับเทียบเกณฑ์ TSA)</label>
                        <select
                          value={newAthlete.gender}
                          onChange={(e) =>
                            setNewAthlete({ ...newAthlete, gender: e.target.value as 'Male' | 'Female' })
                          }
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-white"
                        >
                          <option value="Male">ชาย (Male)</option>
                          <option value="Female">หญิง (Female)</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-400 mb-1">กลุ่มอายุ (TSA Group)</label>
                        <select
                          value={newAthlete.age_group}
                          onChange={(e) => setNewAthlete({ ...newAthlete, age_group: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-white"
                        >
                          <option value="group_5">กลุ่ม 5 (7–9 ปี)</option>
                          <option value="group_4">กลุ่ม 4 (10–11 ปี)</option>
                          <option value="group_3">กลุ่ม 3 (12–13 ปี)</option>
                          <option value="group_2">กลุ่ม 2 (14–15 ปี)</option>
                          <option value="group_1">กลุ่ม 1 (16–18 ปี)</option>
                          <option value="open">รุ่นทั่วไป (Open)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">ลู่ว่ายประจำ (Lane)</label>
                        <select
                          value={newAthlete.lane}
                          onChange={(e) => setNewAthlete({ ...newAthlete, lane: Number(e.target.value) })}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-white"
                        >
                          {[1, 2, 3, 4, 5, 6].map((l) => (
                            <option key={l} value={l}>
                              ลู่ {l}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-400 mb-1">ชื่อผู้ปกครอง</label>
                        <input
                          type="text"
                          placeholder="เช่น คุณแม่นิดา"
                          value={newAthlete.parent_name}
                          onChange={(e) => setNewAthlete({ ...newAthlete, parent_name: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">ตั้งรหัส PIN 4 หลัก</label>
                        <input
                          type="text"
                          maxLength={4}
                          value={newAthlete.pin_code}
                          onChange={(e) => setNewAthlete({ ...newAthlete, pin_code: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-white font-mono"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-3">
                      <button
                        type="button"
                        onClick={() => setShowAddModal(false)}
                        className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold"
                      >
                        ยกเลิก
                      </button>
                      <button
                        type="submit"
                        disabled={addingAthlete}
                        className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold"
                      >
                        {addingAthlete ? 'กำลังบันทึก...' : 'บันทึกรายชื่อ'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 2: MORNING READINESS CHECK-IN                                    */}
        {/* ==================================================================== */}
        {activeTab === 'readiness' && (
          <form
            onSubmit={handleSaveReadiness}
            className="max-w-2xl mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-xl"
          >
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                Pre-Training Readiness
              </span>
              <h2 className="text-xl font-black text-white">เช็กอินความพร้อมร่างกายตอนเช้า</h2>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">เลือกนักกีฬา</label>
              <select
                value={readinessAthleteId}
                onChange={(e) => setReadinessAthleteId(e.target.value)}
                disabled={currentUser.role !== 'coach'}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white"
              >
                {visibleAthletesForRole.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.full_name} ({a.nickname})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-slate-400">ชีพจรขณะพัก (RHR)</span>
                  <span className="font-black text-rose-400">{rhr} bpm</span>
                </div>
                <input
                  type="range"
                  min={40}
                  max={110}
                  value={rhr}
                  onChange={(e) => setRhr(Number(e.target.value))}
                  className="w-full accent-rose-500"
                />
              </div>

              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-slate-400">ชั่วโมงการนอนหลับ</span>
                  <span className="font-black text-cyan-400">{sleepHours} ชม.</span>
                </div>
                <input
                  type="range"
                  min={4}
                  max={12}
                  step={0.5}
                  value={sleepHours}
                  onChange={(e) => setSleepHours(Number(e.target.value))}
                  className="w-full accent-cyan-500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-300 block">
                แผนที่ความตึงกล้ามเนื้อ 5 จุด (1 = ปกติ, 5 = ตึงมาก/เจ็บ)
              </span>
              {(
                [
                  { key: 'shoulder', label: '1. ข้อต่อหัวไหล่ (Rotator Cuff)' },
                  { key: 'lat', label: '2. กล้ามเนื้อปีกและหลัง (Latissimus Dorsi)' },
                  { key: 'core', label: '3. แกนกลางลำตัว (Core & Lower Back)' },
                  { key: 'knee', label: '4. หัวเข่าและขาหนีบ (Breaststroke Knee)' },
                  { key: 'ankle', label: '5. ข้อเท้าและหลังเท้า (Ankle Flexibility)' },
                ] as const
              ).map((part) => (
                <div
                  key={part.key}
                  className="flex items-center justify-between bg-slate-950 px-4 py-2.5 rounded-xl border border-slate-800"
                >
                  <span className="text-xs text-slate-300">{part.label}</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <button
                        type="button"
                        key={lvl}
                        onClick={() => setSoreness({ ...soreness, [part.key]: lvl })}
                        className={`h-7 w-7 rounded-lg text-xs font-bold ${
                          soreness[part.key] === lvl
                            ? lvl >= 4
                              ? 'bg-rose-600 text-white'
                              : lvl === 3
                              ? 'bg-amber-500 text-white'
                              : 'bg-emerald-600 text-white'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {readinessMsg && (
              <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-800 text-emerald-300 text-xs">
                {readinessMsg.text}
              </div>
            )}

            <button
              type="submit"
              disabled={savingReadiness || visibleAthletesForRole.length === 0}
              className="w-full py-3.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm shadow-lg"
            >
              {savingReadiness ? 'กำลังบันทึก...' : 'ส่งข้อมูลความพร้อมเช้า'}
            </button>
          </form>
        )}

        {/* ==================================================================== */}
        {/* TAB 3: ACWR REAL-TIME & TSA BENCHMARK (50m / 25m + PB DELTA)         */}
        {/* ==================================================================== */}
        {activeTab === 'acwr_tsa' && (
          <div className="space-y-8">
            {/* Section A: ACWR Cards */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-bold uppercase text-amber-400">
                    Real-time Workload & Injury Prevention
                  </span>
                  <h2 className="text-xl font-black text-white">ดัชนีภาระงานสะสม ACWR (7 วัน / 28 วัน)</h2>
                </div>
                <button
                  onClick={fetchAllData}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-cyan-400 flex items-center gap-1.5"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> รีเฟรชข้อมูลจริง
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {visibleAcwrForRole.map((item) => {
                  const isDanger = item.acwr >= 1.5;
                  const isWarn = item.acwr >= 1.31 && item.acwr < 1.5;
                  return (
                    <div
                      key={item.athlete.id}
                      className={`bg-slate-900 border rounded-2xl p-5 space-y-3 ${
                        isDanger
                          ? 'border-rose-700'
                          : isWarn
                          ? 'border-amber-700'
                          : 'border-slate-800'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-bold text-base text-white">
                            {item.athlete.full_name} ({item.athlete.nickname})
                          </h3>
                          <span className="text-xs text-slate-400">
                            ซ้อมรอบ 28 วัน: {item.sessionCount28d} ครั้ง
                          </span>
                        </div>
                        <div className="text-right">
                          <span
                            className={`text-2xl font-black ${
                              isDanger
                                ? 'text-rose-400'
                                : isWarn
                                ? 'text-amber-400'
                                : 'text-emerald-400'
                            }`}
                          >
                            {item.acwr.toFixed(2)}
                          </span>
                          <span className="block text-[10px] font-bold text-slate-400">
                            {isDanger
                              ? 'Danger Zone (≥1.50)'
                              : isWarn
                              ? 'Early Warning (1.31-1.49)'
                              : 'Sweet Spot (0.80-1.30)'}
                          </span>
                        </div>
                      </div>
                      <div className="flex justify-between text-xs text-slate-400 bg-slate-950 p-3 rounded-xl border border-slate-800">
                        <span>Acute (7 วัน): <b className="text-cyan-400">{item.acuteLoad} AU</b></span>
                        <span>Chronic (28 วัน): <b className="text-white">{item.chronicLoad} AU</b></span>
                        <span>RHR: <b className="text-rose-400">{item.latestRhr ?? '-'} bpm</b></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section B: TSA Benchmark 50m / 25m & Personal Best (PB) */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <span className="text-[10px] font-bold uppercase text-cyan-400 flex items-center gap-1">
                    <Trophy className="h-3.5 w-3.5" /> Thailand Swimming Association (TSA) Benchmark 2026
                  </span>
                  <h2 className="text-xl font-black text-white mt-0.5">
                    ฐานข้อมูลเกณฑ์เวลาสมาคมฯ และสถิติ PB รายบุคคล
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={selectedBenchmarkAthleteId}
                    onChange={(e) => setSelectedBenchmarkAthleteId(e.target.value)}
                    disabled={currentUser.role !== 'coach'}
                    className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white"
                  >
                    {visibleAthletesForRole.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.full_name} ({AGE_GROUP_LABELS[a.age_group]})
                      </option>
                    ))}
                  </select>

                  <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold">
                    <button
                      onClick={() => setTsaCourse('50m')}
                      className={`px-3 py-1.5 rounded-lg ${
                        tsaCourse === '50m' ? 'bg-cyan-600 text-white' : 'text-slate-400'
                      }`}
                    >
                      สระ 50m (ทางการ)
                    </button>
                    <button
                      onClick={() => setTsaCourse('25m')}
                      className={`px-3 py-1.5 rounded-lg ${
                        tsaCourse === '25m' ? 'bg-cyan-600 text-white' : 'text-slate-400'
                      }`}
                    >
                      สระ 25m (เกณฑ์แปลง)
                    </button>
                  </div>
                </div>
              </div>

              {/* Add Competition / PB Time Form */}
              <form
                onSubmit={handleAddCompTime}
                className="grid grid-cols-1 sm:grid-cols-5 gap-2 bg-slate-950 p-3.5 rounded-2xl border border-slate-800 text-xs"
              >
                <input
                  type="text"
                  placeholder="ชื่อรายการแข่งขัน"
                  value={newComp.meet_name}
                  onChange={(e) => setNewComp({ ...newComp, meet_name: e.target.value })}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
                <select
                  value={newComp.stroke}
                  onChange={(e) => setNewComp({ ...newComp, stroke: e.target.value })}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                >
                  <option value="Freestyle">Freestyle (ฟรีสไตล์)</option>
                  <option value="Backstroke">Backstroke (กรรเชียง)</option>
                  <option value="Breaststroke">Breaststroke (กบ)</option>
                  <option value="Butterfly">Butterfly (ผีเสื้อ)</option>
                </select>
                <select
                  value={newComp.distance_m}
                  onChange={(e) => setNewComp({ ...newComp, distance_m: Number(e.target.value) })}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                >
                  <option value={50}>50 เมตร</option>
                  <option value={100}>100 เมตร</option>
                  <option value={200}>200 เมตร</option>
                </select>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="เวลาที่ทำได้ (วินาที เช่น 31.20)"
                  value={newComp.official_time_sec}
                  onChange={(e) => setNewComp({ ...newComp, official_time_sec: e.target.value })}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl py-2 px-3"
                >
                  + บันทึกสถิติ PB
                </button>
              </form>

              {/* TSA Standards & Delta Comparison Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {matchingStandards.map((std) => {
                  const athleteLogsForEvent = compLogs.filter(
                    (c) =>
                      c.athlete_id === selectedBenchmarkAthleteId &&
                      c.course === tsaCourse &&
                      c.stroke === std.stroke &&
                      c.distance_m === std.distance_m
                  );
                  const bestPb =
                    athleteLogsForEvent.length > 0 ? athleteLogsForEvent[0].official_time_sec : null;
                  const delta = bestPb !== null ? Number((bestPb - std.qualifying_time_sec).toFixed(2)) : null;

                  return (
                    <div
                      key={std.id}
                      className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-bold text-sm text-white">
                            {std.stroke} {std.distance_m}m ({std.course})
                          </h4>
                          <span className="text-[10px] text-cyan-400">{std.source_notes}</span>
                        </div>
                        {delta !== null && (
                          <span
                            className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                              delta <= 0
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-700'
                                : 'bg-amber-950 text-amber-400 border border-amber-700'
                            }`}
                          >
                            {delta <= 0 ? `ผ่านเกณฑ์ (${delta} วิ)` : `ขาดอีก +${delta} วิ`}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-center text-xs">
                        <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                          <span className="text-slate-500 block text-[10px]">สถิติ PB ปัจจุบัน</span>
                          <b className="text-base text-cyan-400">
                            {bestPb !== null ? `${bestPb.toFixed(2)} วิ` : 'ยังไม่มีสถิติ'}
                          </b>
                        </div>
                        <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                          <span className="text-slate-500 block text-[10px]">เกณฑ์เป้าหมาย TSA</span>
                          <b className="text-base text-white">{std.qualifying_time_sec.toFixed(2)} วิ</b>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 4: PARENT FAMILY SUMMARY & DIGITAL PDPA E-CONSENT                */}
        {/* ==================================================================== */}
        {activeTab === 'pdpa' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-2xl bg-emerald-600/20 border border-emerald-600/40 flex items-center justify-center text-emerald-400">
                  <FileSignature className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white">
                    แบบฟอร์มลงนามยินยอมข้อมูลสุขภาพเยาวชน (PDPA Digital E-Consent)
                  </h2>
                  <p className="text-xs text-slate-400">
                    ตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 สำหรับจัดเก็บข้อมูล RHR, การนอนหลับ และสถิติการฝึกซ้อม
                  </p>
                </div>
              </div>

              <form onSubmit={handleSignPdpa} className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">เลือกนักกีฬาในความดูแล</label>
                  <select
                    value={pdpaTargetAthleteId}
                    onChange={(e) => setPdpaTargetAthleteId(e.target.value)}
                    disabled={currentUser.role === 'parent'}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white"
                  >
                    {visibleAthletesForRole.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.full_name} ({a.nickname}) - สถานะ: {a.pdpa_signed ? 'ลงนามแล้ว ✓' : 'รอลงนาม'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-slate-300 space-y-2 leading-relaxed">
                  <p className="font-bold text-cyan-400">ข้อตกลงการคุ้มครองข้อมูลส่วนบุคคล (ฉบับย่อ v2.2):</p>
                  <p>
                    1. สโมสรจะนำข้อมูลความพร้อมทางร่างกาย (RHR, ชั่วโมงการนอน, ความตึงกล้ามเนื้อ) และภาระงานฝึกซ้อม 
                    ไปใช้เพื่อวางแผนการฝึกซ้อมและป้องกันการบาดเจ็บของนักกีฬาเท่านั้น
                  </p>
                  <p>
                    2. ข้อมูลทั้งหมดถูกเข้ารหัสและจำกัดสิทธิ์การเข้าถึง (Row Level Security) เฉพาะหัวหน้าผู้ฝึกสอน 
                    นักกีฬาเจ้าของข้อมูล และผู้ปกครองที่ลงนามเท่านั้น
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    ลงชื่อ-นามสกุล บิดา / มารดา / ผู้ปกครองตามกฎหมาย *
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="พิมพ์ชื่อ-นามสกุลผู้ปกครองเพื่อยืนยันการลงนามดิจิทัล"
                    value={parentSignerName}
                    onChange={(e) => setParentSignerName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg"
                >
                  ยืนยันและลงนาม PDPA Digital E-Consent
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 5: WORKOUT BUILDER (NESTED SETS & USA SWIMMING ZONES)            */}
        {/* ==================================================================== */}
        {activeTab === 'builder' && currentUser.role === 'coach' && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] font-bold uppercase text-cyan-400">
                    Nested Sets & Auto-Zone Engine
                  </span>
                  <h2 className="text-xl font-black text-white">ระบบสร้างโปรแกรมฝึกซ้อมอัจฉริยะ</h2>
                </div>
                <div className="flex items-center gap-3">
                  <div className="bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl text-xs">
                    <span className="text-slate-400">CSS 100m ฐาน: </span>
                    <input
                      type="number"
                      value={css100m}
                      onChange={(e) => setCss100m(Number(e.target.value))}
                      className="w-12 bg-transparent text-center font-bold text-cyan-400 outline-none"
                    />
                    <span className="text-slate-400"> วิ</span>
                  </div>
                  <button
                    onClick={handleSaveWorkout}
                    disabled={savingWorkout}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5"
                  >
                    <Save className="h-4 w-4" /> บันทึกโปรแกรมซ้อมลง Supabase
                  </button>
                </div>
              </div>

              {workoutMsg && (
                <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-800 text-emerald-300 text-xs">
                  {workoutMsg}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">ชื่อโปรแกรมฝึกซ้อม</label>
                  <input
                    type="text"
                    value={workoutTitle}
                    onChange={(e) => setWorkoutTitle(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-white"
                  />
                </div>
                <div className="flex items-center justify-between px-4">
                  <div>
                    <span className="text-[11px] text-slate-400 block">ระยะทางรวมทั้งหมด</span>
                    <span className="text-2xl font-black text-cyan-400">
                      {totalWorkoutDist.toLocaleString()} เมตร
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {groups.map((grp, gIdx) => (
              <div key={grp.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="h-6 w-6 rounded-full bg-cyan-950 text-cyan-400 font-bold flex items-center justify-center">
                      {gIdx + 1}
                    </span>
                    <select
                      value={grp.category}
                      onChange={(e) =>
                        setGroups(
                          groups.map((g) =>
                            g.id === grp.id
                              ? { ...g, category: e.target.value as WorkoutGroup['category'] }
                              : g
                          )
                        )
                      }
                      className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 font-bold text-white"
                    >
                      <option value="Warm-up">Warm-up</option>
                      <option value="Pre-set">Pre-set</option>
                      <option value="Main Set">Main Set</option>
                      <option value="Cool-down">Cool-down</option>
                    </select>
                    <span className="text-slate-400">ทำซ้ำ:</span>
                    <input
                      type="number"
                      min={1}
                      value={grp.rounds}
                      onChange={(e) =>
                        setGroups(
                          groups.map((g) => (g.id === grp.id ? { ...g, rounds: Number(e.target.value) } : g))
                        )
                      }
                      className="w-12 bg-slate-950 border border-slate-700 rounded-lg py-1 text-center text-amber-400 font-bold"
                    />
                    <span className="text-slate-400">รอบ</span>
                  </div>
                </div>

                <div className="space-y-2">
                  {grp.items.map((item) => {
                    const zone = classifyZone(grp.category, item.distance, item.restSec);
                    const interval = calcInterval(item.distance, item.restSec, zone.mult);
                    return (
                      <div
                        key={item.id}
                        className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="number"
                            min={1}
                            value={item.reps}
                            onChange={(e) =>
                              setGroups(
                                groups.map((g) =>
                                  g.id === grp.id
                                    ? {
                                        ...g,
                                        items: g.items.map((it) =>
                                          it.id === item.id ? { ...it, reps: Number(e.target.value) } : it
                                        ),
                                      }
                                    : g
                                )
                              )
                            }
                            className="w-12 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-center text-white font-bold"
                          />
                          <span>×</span>
                          <select
                            value={item.distance}
                            onChange={(e) =>
                              setGroups(
                                groups.map((g) =>
                                  g.id === grp.id
                                    ? {
                                        ...g,
                                        items: g.items.map((it) =>
                                          it.id === item.id
                                            ? { ...it, distance: Number(e.target.value) }
                                            : it
                                        ),
                                      }
                                    : g
                                )
                              )
                            }
                            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-cyan-400 font-bold"
                          >
                            {[25, 50, 100, 200, 400, 800].map((d) => (
                              <option key={d} value={d}>
                                {d}m
                              </option>
                            ))}
                          </select>
                          <select
                            value={item.stroke}
                            onChange={(e) =>
                              setGroups(
                                groups.map((g) =>
                                  g.id === grp.id
                                    ? {
                                        ...g,
                                        items: g.items.map((it) =>
                                          it.id === item.id ? { ...it, stroke: e.target.value } : it
                                        ),
                                      }
                                    : g
                                )
                              )
                            }
                            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white"
                          >
                            <option value="Freestyle">Freestyle</option>
                            <option value="Backstroke">Backstroke</option>
                            <option value="Breaststroke">Breaststroke</option>
                            <option value="Butterfly">Butterfly</option>
                            <option value="IM">IM</option>
                          </select>
                          <span>พัก:</span>
                          <input
                            type="number"
                            value={item.restSec}
                            onChange={(e) =>
                              setGroups(
                                groups.map((g) =>
                                  g.id === grp.id
                                    ? {
                                        ...g,
                                        items: g.items.map((it) =>
                                          it.id === item.id
                                            ? { ...it, restSec: Number(e.target.value) }
                                            : it
                                        ),
                                      }
                                    : g
                                )
                              )
                            }
                            className="w-14 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-center text-amber-400"
                          />
                          <span>วิ</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-1 rounded-lg border font-bold ${zone.color}`}>
                            {zone.code} ({zone.label})
                          </span>
                          <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-cyan-300 font-mono font-bold">
                            {interval}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}