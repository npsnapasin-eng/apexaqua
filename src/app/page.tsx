'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Waves, Heart, Moon, Activity, ShieldCheck, CheckCircle2,
  BarChart3, Timer, Filter, Save, AlertCircle,
  Zap, Clock, X, Loader2, Users,
  RefreshCw, Layers, Plus, Trash2, AlertTriangle
} from 'lucide-react';
import { supabase } from '../lib/supabase';

// --- TypeScript Definitions ตามข้อกำหนดทางวิทยาศาสตร์การกีฬา 5 มิติ ---
interface SwimmerPoolside {
  id: string;              // UUID ตรงกับ profiles.id ใน Supabase
  name: string;
  nickname: string;
  lane: number;
  group: string;
  targetTime: string;      // เช่น "1:15.00"
  actualTime: string;      // เวลาจริงที่ว่ายได้
  attended: boolean;
  srpe: number;            // Borg CR-10 (0 - 10)
  loadAu: number;          // Session Load = sRPE * duration
  rhr: number;             // Morning Resting Heart Rate
  readinessStatus: 'green' | 'yellow' | 'red';
  sorenessSummary: string;
}

interface MuscleMapState {
  shoulder: { level: number; type: 'normal' | 'sharp' };
  lat: { level: number; type: 'normal' | 'sharp' };
  core: { level: number; type: 'normal' | 'sharp' };
  knee: { level: number; type: 'normal' | 'sharp' };
  ankle: { level: number; type: 'normal' | 'sharp' };
}

type EnergyZoneCode = 'REC' | 'EN1' | 'EN2' | 'EN3' | 'SP1' | 'SP2' | 'SP3';
type StrokeType = 'Freestyle' | 'Backstroke' | 'Breaststroke' | 'Butterfly' | 'IM';
type SetCategory = 'Warm-up' | 'Pre-set' | 'Main Set' | 'Cool-down';

interface WorkoutSetItem {
  id: string;
  reps: number;
  distanceM: number;
  stroke: StrokeType;
  restSec: number;
}

interface WorkoutSetGroup {
  id: string;
  category: SetCategory;
  rounds: number;
  restBetweenRoundsSec: number;
  items: WorkoutSetItem[];
}

interface AthleteACWRStats {
  athleteId: string;
  name: string;
  nickname: string;
  group: string;
  acuteLoad7d: number;
  chronicLoad28d: number;
  acwr: number;
  status: 'undertraining' | 'sweet_spot' | 'early_warning' | 'danger';
  latestRhr: number | null;
  latestShoulderSoreness: number | null;
  latestCheckinDate: string | null;
  sessionsCount28d: number;
}

// ข้อมูลตั้งต้นนักกีฬาทั้ง 4 คน ผูก UUID ตรงกับตาราง profiles ใน Supabase
const INITIAL_SWIMMERS: SwimmerPoolside[] = [
  {
    id: '22222222-2222-2222-2222-222222222221',
    name: 'ปภังกร ว่องไว',
    nickname: 'เป๊ก',
    lane: 1,
    group: 'กลุ่ม 5 (8 ปี)',
    targetTime: '0:42.50',
    actualTime: '0:41.90',
    attended: true,
    srpe: 6,
    loadAu: 540,
    rhr: 66,
    readinessStatus: 'green',
    sorenessSummary: 'สบายดี (1/5)',
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'ชลธิชา สายนที',
    nickname: 'น้ำใส',
    lane: 2,
    group: 'กลุ่ม 2 (15 ปี)',
    targetTime: '1:02.50',
    actualTime: '1:01.80',
    attended: true,
    srpe: 7,
    loadAu: 630,
    rhr: 58,
    readinessStatus: 'green',
    sorenessSummary: 'สบายดี (1/5)',
  },
  {
    id: '22222222-2222-2222-2222-222222222223',
    name: 'ธนวัฒน์ พัฒนชัย',
    nickname: 'ต้นน้ำ',
    lane: 3,
    group: 'กลุ่ม 4 (11 ปี)',
    targetTime: '1:12.00',
    actualTime: '1:11.40',
    attended: true,
    srpe: 8,
    loadAu: 720,
    rhr: 64,
    readinessStatus: 'yellow',
    sorenessSummary: 'ตึงไหล่เล็กน้อย (3/5)',
  },
  {
    id: '22222222-2222-2222-2222-222222222224',
    name: 'กิตติศักดิ์ เรืองเดช',
    nickname: 'เจมส์',
    lane: 4,
    group: 'กลุ่ม 1 (17 ปี)',
    targetTime: '0:58.50',
    actualTime: '0:59.20',
    attended: true,
    srpe: 9,
    loadAu: 810,
    rhr: 74,
    readinessStatus: 'red',
    sorenessSummary: 'ระบมหัวไหล่ (4/5)',
  },
];

// USA Swimming Energy Zone Definitions
const ENERGY_ZONES = [
  { code: 'REC', name: 'Recovery', hr: '< 60%', color: 'border-emerald-500 text-emerald-400 bg-emerald-950/40' },
  { code: 'EN1', name: 'Basic Aerobic', hr: '120–150 bpm', color: 'border-teal-500 text-teal-400 bg-teal-950/40' },
  { code: 'EN2', name: 'Threshold (AT)', hr: '150–175 bpm', color: 'border-cyan-500 text-cyan-400 bg-cyan-950/40' },
  { code: 'EN3', name: 'VO2max', hr: '175–Max bpm', color: 'border-blue-500 text-blue-400 bg-blue-950/40' },
  { code: 'SP1', name: 'Lactate Tolerance', hr: 'Race Pace', color: 'border-amber-500 text-amber-400 bg-amber-950/40' },
  { code: 'SP2', name: 'Lactate Production', hr: 'Max Sprints', color: 'border-orange-500 text-orange-400 bg-orange-950/40' },
  { code: 'SP3', name: 'Alactic Speed (ATP-CP)', hr: 'All-out < 15s', color: 'border-rose-500 text-rose-400 bg-rose-950/40' },
];

// ตัวคูณความหนักของแต่ละโซนเทียบกับ Critical Swim Speed (CSS)
const ZONE_PACE_MULTIPLIERS: Record<EnergyZoneCode, number> = {
  REC: 1.25,
  EN1: 1.15,
  EN2: 1.02,
  EN3: 0.96,
  SP1: 0.90,
  SP2: 0.82,
  SP3: 0.75,
};

// ฟังก์ชัน Auto-Tagging โซนพลังงาน USA Swimming ตามเงื่อนไขวิทยาศาสตร์การกีฬา
function classifyEnergyZone(distanceM: number, restSec: number, category: SetCategory): EnergyZoneCode {
  if (category === 'Warm-up' || category === 'Cool-down') return 'REC';
  if (distanceM <= 25 && restSec >= 30) return 'SP3';
  if (distanceM <= 50 && restSec >= 60) return 'SP2';
  if (distanceM <= 100 && restSec >= 45 && restSec <= 90) return 'SP1';
  if (distanceM <= 200 && restSec >= 20 && restSec <= 44) return 'EN3';
  if (distanceM >= 100 && restSec >= 10 && restSec <= 20) return 'EN2';
  if (restSec < 10 || distanceM >= 400) return 'EN1';
  return 'EN1';
}

// ฟังก์ชันคำนวณ Personalized Interval Pace อิงจาก CSS 100m ปัดขึ้นเป็นรอบ 5 วินาที
function calculatePersonalizedInterval(distanceM: number, zone: EnergyZoneCode, restSec: number, css100mSec: number) {
  const pacePer100 = css100mSec * ZONE_PACE_MULTIPLIERS[zone];
  const targetSwimSec = Math.round((distanceM / 100) * pacePer100);
  const rawInterval = targetSwimSec + restSec;
  const intervalSec = Math.ceil(rawInterval / 5) * 5;
  const mins = Math.floor(intervalSec / 60);
  const secs = intervalSec % 60;
  return {
    targetSwimSec,
    intervalSec,
    formatted: `@ ${mins}:${secs < 10 ? '0' : ''}${secs}`,
  };
}

export default function ApexAquaMainPage() {
  // แท็บการทำงานหลัก 5 โมดูล
  const [activeTab, setActiveTab] = useState<'poolside' | 'readiness' | 'analytics' | 'parent' | 'builder'>('poolside');

  // --- 1. Poolside Command State (ลู่ 1-4 & Actual Times) ---
  const [swimmers, setSwimmers] = useState<SwimmerPoolside[]>(INITIAL_SWIMMERS);
  const [selectedLane, setSelectedLane] = useState<number | 'all'>('all');
  const [sessionDuration, setSessionDuration] = useState<number>(90);
  const [isSavingPoolside, setIsSavingPoolside] = useState<boolean>(false);
  const [poolsideFeedback, setPoolsideFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // --- 2. Morning Readiness State (เช็กอินเช้า & กล้ามเนื้อ 5 จุด) ---
  const [readinessAthleteId, setReadinessAthleteId] = useState<string>('22222222-2222-2222-2222-222222222221');
  const [rhr, setRhr] = useState<number>(62);
  const [sleepHours, setSleepHours] = useState<number>(8);
  const [sleepQuality, setSleepQuality] = useState<number>(4);
  const [isSavingReadiness, setIsSavingReadiness] = useState<boolean>(false);
  const [readinessFeedback, setReadinessFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [muscleSoreness, setMuscleSoreness] = useState<MuscleMapState>({
    shoulder: { level: 1, type: 'normal' },
    lat: { level: 1, type: 'normal' },
    core: { level: 1, type: 'normal' },
    knee: { level: 1, type: 'normal' },
    ankle: { level: 1, type: 'normal' },
  });

  // --- 3. ACWR Analytics State (เชื่อมต่อฐานข้อมูลจริง Real-time) ---
  const [selectedAthleteId, setSelectedAthleteId] = useState<string>('22222222-2222-2222-2222-222222222223');
  const [acwrStatsList, setAcwrStatsList] = useState<AthleteACWRStats[]>([]);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState<boolean>(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  // --- 4. Parent Digest & PDPA State ---
  const [parentAthleteId, setParentAthleteId] = useState<string>('22222222-2222-2222-2222-222222222221');

  // --- 5. Workout Builder State (Nested Sets & Auto-Zone) ---
  const [workoutTitle, setWorkoutTitle] = useState<string>('Aerobic Threshold & Speed Endurance Set');
  const [cssBase100m, setCssBase100m] = useState<number>(75); // ค่า CSS 100m มาตรฐาน (วินาที)
  const [isSavingWorkout, setIsSavingWorkout] = useState<boolean>(false);
  const [workoutFeedback, setWorkoutFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [setGroups, setSetGroups] = useState<WorkoutSetGroup[]>([
    {
      id: 'grp-1',
      category: 'Warm-up',
      rounds: 1,
      restBetweenRoundsSec: 30,
      items: [
        { id: 'itm-1', reps: 1, distanceM: 400, stroke: 'Freestyle', restSec: 20 },
        { id: 'itm-2', reps: 4, distanceM: 50, stroke: 'IM', restSec: 15 },
      ],
    },
    {
      id: 'grp-2',
      category: 'Main Set',
      rounds: 2,
      restBetweenRoundsSec: 90,
      items: [
        { id: 'itm-3', reps: 4, distanceM: 100, stroke: 'Freestyle', restSec: 15 },
        { id: 'itm-4', reps: 4, distanceM: 50, stroke: 'Butterfly', restSec: 60 },
      ],
    },
    {
      id: 'grp-3',
      category: 'Cool-down',
      rounds: 1,
      restBetweenRoundsSec: 0,
      items: [
        { id: 'itm-5', reps: 1, distanceM: 200, stroke: 'Backstroke', restSec: 15 },
      ],
    },
  ]);

  // ฟังก์ชันดึงข้อมูลจริงจาก Supabase สำหรับแท็บ 3 (ACWR & Readiness)
  const fetchRealTimeAnalytics = useCallback(async () => {
    setIsLoadingAnalytics(true);
    setAnalyticsError(null);
    try {
      const athleteIds = swimmers.map(s => s.id);
      const now = new Date();
      const date28DaysAgo = new Date(now);
      date28DaysAgo.setDate(now.getDate() - 28);
      const date7DaysAgo = new Date(now);
      date7DaysAgo.setDate(now.getDate() - 7);

      const iso28 = date28DaysAgo.toISOString().split('T')[0];

      const [logsRes, readinessRes] = await Promise.all([
        supabase
          .from('workout_logs')
          .select('athlete_id, workout_date, duration_minutes, srpe, session_load_au, attended, created_at')
          .in('athlete_id', athleteIds)
          .gte('workout_date', iso28),
        supabase
          .from('daily_readiness')
          .select('athlete_id, checkin_date, rhr, shoulder_soreness, created_at')
          .in('athlete_id', athleteIds)
          .order('created_at', { ascending: false })
      ]);

      if (logsRes.error) throw logsRes.error;
      if (readinessRes.error) throw readinessRes.error;

      const logs = logsRes.data || [];
      const readinessRows = readinessRes.data || [];

      const computed: AthleteACWRStats[] = swimmers.map((swimmer) => {
        const athleteLogs = logs.filter(l => l.athlete_id === swimmer.id && l.attended !== false);

        // ภาระงาน 28 วันล่าสุด และ 7 วันล่าสุด
        let totalLoad28d = 0;
        let totalLoad7d = 0;

        athleteLogs.forEach(log => {
          const load = log.session_load_au !== null && log.session_load_au !== undefined
            ? Number(log.session_load_au)
            : Number(log.duration_minutes || 0) * Number(log.srpe || 0);

          totalLoad28d += load;

          const logDate = new Date(log.workout_date || log.created_at);
          if (logDate >= date7DaysAgo) {
            totalLoad7d += load;
          }
        });

        // คำนวณ Acute Load (เฉลี่ยต่อวันในรอบ 7 วัน) และ Chronic Load (เฉลี่ยต่อวันในรอบ 28 วัน)
        const acuteAvg7d = totalLoad7d / 7;
        const chronicAvg28d = totalLoad28d / 28;
        const acwrRaw = chronicAvg28d > 0 ? acuteAvg7d / chronicAvg28d : 0;
        const acwr = Number(acwrRaw.toFixed(2));

        let status: AthleteACWRStats['status'] = 'sweet_spot';
        if (acwr < 0.80) status = 'undertraining';
        else if (acwr <= 1.30) status = 'sweet_spot';
        else if (acwr <= 1.49) status = 'early_warning';
        else status = 'danger';

        const latestReadiness = readinessRows.find(r => r.athlete_id === swimmer.id);

        return {
          athleteId: swimmer.id,
          name: swimmer.name,
          nickname: swimmer.nickname,
          group: swimmer.group,
          acuteLoad7d: Math.round(totalLoad7d),
          chronicLoad28d: Math.round(totalLoad28d),
          acwr,
          status,
          latestRhr: latestReadiness?.rhr ?? null,
          latestShoulderSoreness: latestReadiness?.shoulder_soreness ?? null,
          latestCheckinDate: latestReadiness?.checkin_date ?? null,
          sessionsCount28d: athleteLogs.length,
        };
      });

      setAcwrStatsList(computed);
      setLastSyncedAt(new Date().toLocaleTimeString('th-TH'));
    } catch (err: unknown) {
      console.error('Error fetching ACWR analytics:', err);
      const message = err instanceof Error ? err.message : 'ไม่สามารถดึงข้อมูลจาก Supabase ได้';
      setAnalyticsError(message);
    } finally {
      setIsLoadingAnalytics(false);
    }
  }, [swimmers]);

  // โหลดข้อมูลอัตโนมัติเมื่อเปิดแท็บ 3
  useEffect(() => {
    if (activeTab === 'analytics') {
      fetchRealTimeAnalytics();
    }
  }, [activeTab, fetchRealTimeAnalytics]);

  // คำนวณสรุป Poolside
  const filteredSwimmers = useMemo(() => {
    return selectedLane === 'all'
      ? swimmers
      : swimmers.filter(s => s.lane === selectedLane);
  }, [swimmers, selectedLane]);

  const totalPoolLoad = useMemo(() => {
    return swimmers.reduce((acc, curr) => acc + (curr.attended ? curr.loadAu : 0), 0);
  }, [swimmers]);

  // ฟังก์ชันควบคุม Poolside
  const handleDurationChange = (newDuration: number) => {
    const safeDuration = Math.max(10, newDuration || 0);
    setSessionDuration(safeDuration);
    setSwimmers(prev =>
      prev.map(s => ({
        ...s,
        loadAu: s.attended ? s.srpe * safeDuration : 0,
      }))
    );
  };

  const handleActualTimeChange = (id: string, time: string) => {
    setSwimmers(prev => prev.map(s => (s.id === id ? { ...s, actualTime: time } : s)));
  };

  const handleSrpeChange = (id: string, val: number) => {
    setSwimmers(prev =>
      prev.map(s => {
        if (s.id === id) {
          return {
            ...s,
            srpe: val,
            loadAu: s.attended ? val * sessionDuration : 0,
          };
        }
        return s;
      })
    );
  };

  const toggleAttendance = (id: string) => {
    setSwimmers(prev =>
      prev.map(s => {
        if (s.id === id) {
          const nextAttended = !s.attended;
          return {
            ...s,
            attended: nextAttended,
            loadAu: nextAttended ? s.srpe * sessionDuration : 0,
          };
        }
        return s;
      })
    );
  };

  // บันทึกข้อมูลริมสระขึ้น Supabase (ตาราง workout_logs)
  const handleSavePoolsideBatch = async () => {
    setIsSavingPoolside(true);
    setPoolsideFeedback(null);

    const attendedSwimmers = swimmers.filter(s => s.attended);

    if (attendedSwimmers.length === 0) {
      setPoolsideFeedback({
        type: 'error',
        message: 'ไม่พบนักกีฬาที่เช็กชื่อเข้าซ้อม (attended = true) กรุณาเช็กชื่ออย่างน้อย 1 คน',
      });
      setIsSavingPoolside(false);
      return;
    }

    try {
      const logs = attendedSwimmers.map(s => ({
        athlete_id: s.id,
        duration_minutes: sessionDuration,
        srpe: s.srpe,
        attended: s.attended,
        // ไม่ต้องส่ง session_load_au เพราะตารางคำนวณแบบ Generated Column
      }));

      const { error } = await supabase.from('workout_logs').insert(logs);

      if (error) {
        throw error;
      }

      setPoolsideFeedback({
        type: 'success',
        message: `บันทึกสำเร็จ: ส่งข้อมูลภาระงานนักกีฬา ${logs.length} คน (รวม ${totalPoolLoad.toLocaleString()} AU) ลงตาราง workout_logs บน Supabase เรียบร้อยแล้ว`,
      });
    } catch (err: unknown) {
      console.error('Supabase workout_logs insert error:', err);
      const message = err instanceof Error ? err.message : 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้';
      setPoolsideFeedback({
        type: 'error',
        message: `เกิดข้อผิดพลาดในการบันทึก: ${message}`,
      });
    } finally {
      setIsSavingPoolside(false);
    }
  };

  // บันทึก Morning Readiness ขึ้น Supabase (ตาราง daily_readiness)
  const handleSubmitReadiness = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingReadiness(true);
    setReadinessFeedback(null);

    try {
      const payload = {
        athlete_id: readinessAthleteId,
        rhr: rhr,
        sleep_hours: sleepHours,
        sleep_quality: sleepQuality,
        shoulder_soreness: muscleSoreness.shoulder.level,
        lat_soreness: muscleSoreness.lat.level,
        core_soreness: muscleSoreness.core.level,
        knee_soreness: muscleSoreness.knee.level,
        ankle_soreness: muscleSoreness.ankle.level,
      };

      const { error } = await supabase.from('daily_readiness').insert([payload]);

      if (error) {
        throw error;
      }

      const selectedSwimmer = swimmers.find(s => s.id === readinessAthleteId);
      setReadinessFeedback({
        type: 'success',
        message: `บันทึกความพร้อมของ ${selectedSwimmer?.name || 'นักกีฬา'} (RHR ${rhr} bpm, นอน ${sleepHours} ชม.) ลงตาราง daily_readiness บน Supabase สำเร็จ!`,
      });
    } catch (err: unknown) {
      console.error('Supabase daily_readiness insert error:', err);
      const message = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเชื่อมต่อ Supabase';
      setReadinessFeedback({
        type: 'error',
        message: `บันทึกไม่สำเร็จ: ${message}`,
      });
    } finally {
      setIsSavingReadiness(false);
    }
  };

  const handleMuscleLevelChange = (key: keyof MuscleMapState, level: number) => {
    setMuscleSoreness(prev => ({
      ...prev,
      [key]: { ...prev[key], level },
    }));
  };

  const handleMuscleTypeToggle = (key: keyof MuscleMapState) => {
    setMuscleSoreness(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        type: prev[key].type === 'normal' ? 'sharp' : 'normal',
      },
    }));
  };

  // --- Workout Builder Calculations & Handlers ---
  const workoutMetrics = useMemo(() => {
    let totalDistance = 0;
    const strokeDistances: Record<StrokeType, number> = {
      Freestyle: 0,
      Backstroke: 0,
      Breaststroke: 0,
      Butterfly: 0,
      IM: 0,
    };

    setGroups.forEach(group => {
      group.items.forEach(item => {
        const dist = group.rounds * item.reps * item.distanceM;
        totalDistance += dist;
        strokeDistances[item.stroke] = (strokeDistances[item.stroke] || 0) + dist;
      });
    });

    const strokeBreakdown = (Object.keys(strokeDistances) as StrokeType[])
      .map(stroke => ({
        stroke,
        distance: strokeDistances[stroke],
        percentage: totalDistance > 0 ? Math.round((strokeDistances[stroke] / totalDistance) * 100) : 0,
      }))
      .filter(s => s.distance > 0);

    return { totalDistance, strokeBreakdown };
  }, [setGroups]);

  const handleAddGroup = (category: SetCategory) => {
    const newGroup: WorkoutSetGroup = {
      id: `grp-${Date.now()}`,
      category,
      rounds: 1,
      restBetweenRoundsSec: category === 'Main Set' ? 60 : 20,
      items: [
        { id: `itm-${Date.now()}-1`, reps: 4, distanceM: 50, stroke: 'Freestyle', restSec: 15 },
      ],
    };
    setSetGroups(prev => [...prev, newGroup]);
  };

  const handleRemoveGroup = (groupId: string) => {
    setSetGroups(prev => prev.filter(g => g.id !== groupId));
  };

  const handleUpdateGroup = (
    groupId: string,
    field: 'rounds' | 'restBetweenRoundsSec' | 'category',
    value: number | SetCategory
  ) => {
    setSetGroups(prev => prev.map(g => (g.id === groupId ? { ...g, [field]: value } : g)));
  };

  const handleAddItem = (groupId: string) => {
    setSetGroups(prev =>
      prev.map(g => {
        if (g.id === groupId) {
          return {
            ...g,
            items: [
              ...g.items,
              { id: `itm-${Date.now()}`, reps: 4, distanceM: 100, stroke: 'Freestyle', restSec: 15 },
            ],
          };
        }
        return g;
      })
    );
  };

  const handleRemoveItem = (groupId: string, itemId: string) => {
    setSetGroups(prev =>
      prev.map(g => {
        if (g.id === groupId) {
          return { ...g, items: g.items.filter(i => i.id !== itemId) };
        }
        return g;
      })
    );
  };

  const handleUpdateItem = (
    groupId: string,
    itemId: string,
    field: keyof WorkoutSetItem,
    value: number | StrokeType
  ) => {
    setSetGroups(prev =>
      prev.map(g => {
        if (g.id === groupId) {
          return {
            ...g,
            items: g.items.map(i => (i.id === itemId ? { ...i, [field]: value } : i)),
          };
        }
        return g;
      })
    );
  };

  const handleSaveWorkoutToSupabase = async () => {
    if (!workoutTitle.trim()) {
      setWorkoutFeedback({ type: 'error', message: 'กรุณาระบุชื่อโปรแกรมฝึกซ้อมก่อนบันทึก' });
      return;
    }
    setIsSavingWorkout(true);
    setWorkoutFeedback(null);

    try {
      const enrichedSetData = setGroups.map(group => ({
        ...group,
        items: group.items.map(item => {
          const autoZone = classifyEnergyZone(item.distanceM, item.restSec, group.category);
          const intervalInfo = calculatePersonalizedInterval(item.distanceM, autoZone, item.restSec, cssBase100m);
          return {
            ...item,
            auto_energy_zone: autoZone,
            target_swim_sec: intervalInfo.targetSwimSec,
            interval_sec: intervalInfo.intervalSec,
            interval_formatted: intervalInfo.formatted,
          };
        }),
      }));

      const payload = {
        club_id: '11111111-1111-1111-1111-111111111111',
        title: workoutTitle.trim(),
        total_distance_m: workoutMetrics.totalDistance,
        set_data: enrichedSetData,
      };

      const { error } = await supabase.from('workouts').insert([payload]);

      if (error) throw error;

      setWorkoutFeedback({
        type: 'success',
        message: `บันทึกโปรแกรม "${workoutTitle}" (ระยะทางรวม ${workoutMetrics.totalDistance.toLocaleString()} ม.) ลงตาราง workouts บน Supabase สำเร็จ!`,
      });
    } catch (err: unknown) {
      console.error('Supabase workouts insert error:', err);
      const message = err instanceof Error ? err.message : 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้';
      setWorkoutFeedback({
        type: 'error',
        message: `เกิดข้อผิดพลาดในการบันทึกโปรแกรมซ้อม: ${message}`,
      });
    } finally {
      setIsSavingWorkout(false);
    }
  };

  const selectedAthleteStats = useMemo(() => {
    return acwrStatsList.find(a => a.athleteId === selectedAthleteId) || null;
  }, [acwrStatsList, selectedAthleteId]);

  const selectedParentSwimmer = useMemo(() => {
    return swimmers.find(s => s.id === parentAthleteId) || swimmers[0];
  }, [swimmers, parentAthleteId]);

  const musclePointsList: { key: keyof MuscleMapState; title: string; subtitle: string }[] = [
    { key: 'shoulder', title: '1. หัวไหล่ (Rotator Cuff)', subtitle: 'ข้อต่อสำคัญที่สุดของนักว่ายน้ำ' },
    { key: 'lat', title: '2. กล้ามเนื้อปีก (Latissimus Dorsi)', subtitle: 'กล้ามเนื้อหลักในการดึงน้ำ' },
    { key: 'core', title: '3. แกนกลางลำตัว (Core / Lower Back)', subtitle: 'การทรงตัวและท่าผีเสื้อ/กบ' },
    { key: 'knee', title: '4. ข้อเข่า / ขาหนีบ (Knee / Adductor)', subtitle: 'จังหวะถีบขากบและกลับตัว' },
    { key: 'ankle', title: '5. ข้อเท้า / น่อง (Ankle / Calf)', subtitle: 'ความยืดหยุ่นและการเตะขา' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16 selection:bg-cyan-500 selection:text-slate-950">

      {/* 1. Header Navigation Bar */}
      <header className="border-b border-slate-800 bg-slate-900/90 sticky top-0 z-50 backdrop-blur-md px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">

          {/* Logo & Platform Tag */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-cyan-600 to-sky-400 flex items-center justify-center text-white shadow-lg shadow-cyan-600/30">
              <Waves className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black tracking-tight text-white">ApexAqua</span>
                <span className="text-[10px] bg-cyan-950 text-cyan-400 border border-cyan-800/80 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  Supabase Live Sync
                </span>
              </div>
              <p className="text-[11px] text-slate-400">ระบบบริหารและวิเคราะห์ศักยภาพนักกีฬาว่ายน้ำสโมสร (Multi-tenant SaaS)</p>
            </div>
          </div>

          {/* Module Switcher Tabs */}
          <div className="flex bg-slate-950 p-1.5 rounded-2xl border border-slate-800/80 text-xs font-bold gap-1 overflow-x-auto max-w-full">
            <button
              onClick={() => setActiveTab('poolside')}
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'poolside' ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Timer className="h-3.5 w-3.5" />
              <span>1. คุมริมสระ (Poolside & Splits)</span>
            </button>

            <button
              onClick={() => setActiveTab('readiness')}
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'readiness' ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Heart className="h-3.5 w-3.5 text-rose-400" />
              <span>2. เช็กอินเช้า (Readiness 5 จุด)</span>
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'analytics' ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30' : 'text-slate-400 hover:text-white'
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5 text-amber-400" />
              <span>3. ดัชนี ACWR & TSA</span>
            </button>

            <button
              onClick={() => setActiveTab('parent')}
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'parent' ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30' : 'text-slate-400 hover:text-white'
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span>4. สรุปครอบครัว (PDPA)</span>
            </button>

            <button
              onClick={() => setActiveTab('builder')}
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'builder' ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="h-3.5 w-3.5 text-sky-300" />
              <span>5. จัดเซตซ้อม (Workout Builder)</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. Main Content Container */}
      <main className="max-w-7xl mx-auto p-4 md:p-6 mt-2 space-y-6">

        {/* ------------------------------------------------------------- */}
        {/* TAB 1: POOLSIDE COMMAND (LANE MANAGEMENT & ACTUAL SPLIT TIMES) */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'poolside' && (
          <div className="space-y-5">
            {/* Control & Lane Filter Bar */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                  <Filter className="h-4 w-4 text-cyan-400" /> กรองลู่ว่าย (Lane 1–4):
                </span>
                <div className="flex gap-1.5 bg-slate-950 p-1 rounded-2xl border border-slate-800 text-xs font-bold">
                  <button
                    onClick={() => setSelectedLane('all')}
                    className={`px-3.5 py-1.5 rounded-xl transition-all ${
                      selectedLane === 'all' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    ทุกลู่ ({swimmers.length})
                  </button>
                  {[1, 2, 3, 4].map(lane => (
                    <button
                      key={lane}
                      onClick={() => setSelectedLane(lane)}
                      className={`px-3.5 py-1.5 rounded-xl transition-all ${
                        selectedLane === lane ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      ลู่ {lane}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 bg-slate-950 px-3.5 py-2 rounded-2xl border border-slate-800 text-xs">
                  <Clock className="h-4 w-4 text-cyan-400" />
                  <span className="text-slate-400 font-medium">ระยะเวลาซ้อม:</span>
                  <input
                    type="number"
                    min={15}
                    max={240}
                    step={5}
                    value={sessionDuration}
                    onChange={e => handleDurationChange(Number(e.target.value))}
                    className="w-14 bg-slate-900 border border-slate-700 rounded-lg px-2 py-0.5 text-center text-cyan-400 font-black outline-none"
                  />
                  <span className="text-slate-400">นาที</span>
                </div>

                <div className="bg-amber-950/40 border border-amber-800/70 px-3.5 py-2 rounded-2xl text-xs">
                  <span className="text-amber-300/80">ภาระงานรวมทีม: </span>
                  <b className="text-amber-400 font-black">{totalPoolLoad.toLocaleString()} AU</b>
                </div>

                <button
                  onClick={handleSavePoolsideBatch}
                  disabled={isSavingPoolside}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-2xl shadow-lg shadow-emerald-600/25 flex items-center gap-2 transition-all active:scale-95"
                >
                  {isSavingPoolside ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>กำลังส่งขึ้นคลาวด์...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      <span>บันทึกคะแนนทั้งสระ</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Supabase Save Feedback */}
            {poolsideFeedback && (
              <div
                className={`p-4 rounded-2xl text-xs flex items-center gap-2.5 border ${
                  poolsideFeedback.type === 'success'
                    ? 'bg-emerald-950/80 border-emerald-700 text-emerald-300'
                    : 'bg-rose-950/80 border-rose-700 text-rose-300'
                }`}
              >
                {poolsideFeedback.type === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
                )}
                <span className="font-medium">{poolsideFeedback.message}</span>
              </div>
            )}

            {/* Swimmer Lane Cards */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
              <div className="divide-y divide-slate-800/80">
                {filteredSwimmers.map(swimmer => {
                  const readinessBadge =
                    swimmer.readinessStatus === 'red'
                      ? 'bg-rose-950 text-rose-400 border-rose-800'
                      : swimmer.readinessStatus === 'yellow'
                      ? 'bg-amber-950 text-amber-400 border-amber-800'
                      : 'bg-emerald-950 text-emerald-400 border-emerald-800';

                  return (
                    <div
                      key={swimmer.id}
                      className={`p-5 transition-all flex flex-col xl:flex-row xl:items-center justify-between gap-4 ${
                        swimmer.attended ? 'bg-slate-900/70' : 'bg-slate-950/50 opacity-55'
                      }`}
                    >
                      {/* Athlete Info & Attendance Toggle */}
                      <div className="flex items-start sm:items-center gap-3.5 min-w-[270px]">
                        <button
                          onClick={() => toggleAttendance(swimmer.id)}
                          className={`h-9 w-9 rounded-xl flex items-center justify-center text-xs font-black transition-all shrink-0 ${
                            swimmer.attended
                              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                              : 'bg-slate-800 text-slate-500 border border-slate-700'
                          }`}
                          title={swimmer.attended ? 'มาซ้อม (คลิกเพื่อเปลี่ยนเป็นขาด)' : 'ขาดซ้อม (คลิกเพื่อเช็กชื่อ)'}
                        >
                          {swimmer.attended ? '✓' : 'ขาด'}
                        </button>

                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[11px] bg-cyan-950 border border-cyan-800 px-2 py-0.5 rounded-lg font-black text-cyan-400">
                              ลู่ {swimmer.lane}
                            </span>
                            <span className="font-bold text-sm text-white">
                              {swimmer.name} ({swimmer.nickname})
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-slate-400">
                            <span>{swimmer.group}</span>
                            <span>•</span>
                            <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${readinessBadge}`}>
                              RHR {swimmer.rhr} bpm • {swimmer.sorenessSummary}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Actual Split Time vs Target */}
                      <div className="flex items-center gap-2.5 bg-slate-950/80 px-3.5 py-2.5 rounded-2xl border border-slate-800">
                        <Timer className="h-4 w-4 text-cyan-400 shrink-0" />
                        <div className="text-xs">
                          <span className="text-slate-500 block text-[10px]">
                            เวลาเป้าหมาย: <b className="text-slate-300 font-mono">{swimmer.targetTime}</b>
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-slate-400 text-[11px] font-bold">เวลาจริง:</span>
                            <input
                              type="text"
                              value={swimmer.actualTime}
                              placeholder="1:12.50"
                              disabled={!swimmer.attended}
                              onChange={e => handleActualTimeChange(swimmer.id, e.target.value)}
                              className="w-24 bg-slate-900 border border-slate-700 px-2 py-0.5 rounded-lg text-cyan-300 font-mono text-xs font-bold focus:border-cyan-500 outline-none"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Borg CR-10 sRPE Scale (0 - 10) */}
                      <div className="flex-1 max-w-lg">
                        <div className="flex justify-between items-center text-xs mb-1.5">
                          <span className="text-slate-400">
                            ความเหนื่อย sRPE (Borg CR-10):{' '}
                            <b className="text-cyan-400">{swimmer.attended ? `${swimmer.srpe} / 10` : '-'}</b>
                          </span>
                          <span className="font-bold text-amber-400">
                            Session Load: {swimmer.loadAu.toLocaleString()} AU
                          </span>
                        </div>

                        <div className="grid grid-cols-11 gap-1">
                          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                            <button
                              key={num}
                              disabled={!swimmer.attended}
                              onClick={() => handleSrpeChange(swimmer.id, num)}
                              className={`h-8 rounded-lg text-[11px] font-black transition-all ${
                                swimmer.srpe === num && swimmer.attended
                                  ? num >= 8
                                    ? 'bg-rose-600 text-white shadow'
                                    : num >= 5
                                    ? 'bg-amber-500 text-white shadow'
                                    : 'bg-cyan-600 text-white shadow'
                                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 disabled:opacity-30'
                              }`}
                            >
                              {num}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 2: MORNING READINESS CHECK-IN (RHR, SLEEP & 5 MUSCLE MAP) */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'readiness' && (
          <div className="max-w-2xl mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
            <div className="border-b border-slate-800 pb-4 mb-6">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 bg-rose-950/70 px-2.5 py-0.5 rounded border border-rose-800">
                มิติที่ 2: Pre-Training Readiness & Injury Prevention
              </span>
              <h2 className="text-xl font-black text-white mt-1.5">
                แบบประเมินความพร้อมเช้าก่อนลงสระ (Daily Readiness)
              </h2>
              <p className="text-xs text-slate-400">
                บันทึกข้อมูล RHR การนอนหลับ และจุดตึงกล้ามเนื้อ 5 ตำแหน่งสำคัญส่งตรงเข้าตาราง daily_readiness บน Supabase
              </p>
            </div>

            {readinessFeedback && (
              <div
                className={`mb-5 p-4 rounded-2xl text-xs flex items-center gap-2.5 border ${
                  readinessFeedback.type === 'success'
                    ? 'bg-emerald-950/80 border-emerald-700 text-emerald-300'
                    : 'bg-rose-950/80 border-rose-700 text-rose-300'
                }`}
              >
                {readinessFeedback.type === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
                )}
                <span className="font-medium">{readinessFeedback.message}</span>
              </div>
            )}

            <form onSubmit={handleSubmitReadiness} className="space-y-5">
              {/* เลือกนักกีฬาจาก UUID ทั้ง 4 คน */}
              <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-cyan-400" /> เลือกนักกีฬาที่ต้องการเช็กอิน:
                </label>
                <select
                  value={readinessAthleteId}
                  onChange={e => setReadinessAthleteId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white focus:border-cyan-500 outline-none"
                >
                  {swimmers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.nickname}) — {s.group} [ลู่ {s.lane}]
                    </option>
                  ))}
                </select>
              </div>

              {/* 1. Resting Heart Rate (RHR) */}
              <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-2">
                    <Heart className="h-4 w-4 text-rose-500" /> ชีพจรขณะพักตอนตื่นนอน (RHR)
                  </label>
                  <span className="text-base font-black text-rose-400">{rhr} bpm</span>
                </div>
                <input
                  type="range"
                  min={45}
                  max={100}
                  value={rhr}
                  onChange={e => setRhr(Number(e.target.value))}
                  className="w-full accent-rose-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                  <span>45 bpm (ฟื้นตัวดีเยี่ยม)</span>
                  <span>เกณฑ์ปกติ: 55–70 bpm</span>
                  <span>100 bpm (ล้า/เสี่ยงป่วย)</span>
                </div>
              </div>

              {/* 2. Sleep Duration & Quality */}
              <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-2">
                    <Moon className="h-4 w-4 text-indigo-400" /> ระยะเวลาการนอนหลับเมื่อคืน
                  </label>
                  <span className="text-base font-black text-indigo-400">{sleepHours} ชั่วโมง</span>
                </div>
                <input
                  type="range"
                  min={4}
                  max={12}
                  step={0.5}
                  value={sleepHours}
                  onChange={e => setSleepHours(Number(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />

                <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">คุณภาพการหลับ (1 = หลับไม่สนิท, 5 = หลับสนิทมาก):</span>
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map(lvl => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setSleepQuality(lvl)}
                        className={`h-8 w-8 rounded-xl text-xs font-black transition-all ${
                          sleepQuality === lvl
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 3. 5-Point Muscle Soreness Map */}
              <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-2 mb-3">
                  <Activity className="h-4 w-4 text-cyan-400" /> แผนที่กล้ามเนื้อ 5 จุดวิกฤต (1 = สบายดี, 5 = ระบม/ตึงมาก)
                </label>

                <div className="space-y-2.5">
                  {musclePointsList.map(item => {
                    const currentVal = muscleSoreness[item.key].level;
                    const currentType = muscleSoreness[item.key].type;

                    return (
                      <div
                        key={item.key}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-900/90 p-3 rounded-2xl border border-slate-800 text-xs"
                      >
                        <div>
                          <span className="text-slate-200 font-bold block">{item.title}</span>
                          <span className="text-[10px] text-slate-500">{item.subtitle}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleMuscleTypeToggle(item.key)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                              currentType === 'sharp'
                                ? 'bg-rose-950 text-rose-400 border-rose-700'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}
                          >
                            {currentType === 'sharp' ? 'เจ็บแปลบ/ข้อต่อ' : 'เมื่อยปกติ'}
                          </button>

                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map(val => (
                              <button
                                key={val}
                                type="button"
                                onClick={() => handleMuscleLevelChange(item.key, val)}
                                className={`h-7 w-7 rounded-lg text-xs font-black transition-all ${
                                  currentVal === val
                                    ? val >= 4
                                      ? 'bg-rose-600 text-white'
                                      : val === 3
                                      ? 'bg-amber-500 text-white'
                                      : 'bg-cyan-600 text-white'
                                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                }`}
                              >
                                {val}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                disabled={isSavingReadiness}
                className="w-full py-3.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 active:scale-[0.99] text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-cyan-600/25 transition-all flex items-center justify-center gap-2"
              >
                {isSavingReadiness ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>กำลังส่งข้อมูลขึ้น Supabase...</span>
                  </>
                ) : (
                  <span>ส่งข้อมูลความพร้อมเข้าสู่ระบบ (Supabase)</span>
                )}
              </button>
            </form>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 3: ACWR WORKLOAD INTELLIGENCE & TSA BENCHMARK (REAL-TIME) */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">

            {/* ACWR Framework Header & Real-Time Cloud Sync */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800">
                      มิติที่ 3: Real-Time Workload & Injury Risk Engine
                    </span>
                    {lastSyncedAt && (
                      <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2 py-0.5 rounded-full">
                        ซิงค์ล่าสุด: {lastSyncedAt}
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl font-black text-white mt-1">
                    ดัชนีภาระงานสะสม ACWR (เชื่อมต่อฐานข้อมูล Supabase จริง)
                  </h2>
                  <p className="text-xs text-slate-400">ดึงข้อมูลจาก workout_logs และ daily_readiness คำนวณ Acute 7 วัน เทียบ Chronic 28 วัน แบบเรียลไทม์</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={fetchRealTimeAnalytics}
                    disabled={isLoadingAnalytics}
                    className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-lg shadow-cyan-600/20 flex items-center gap-1.5 transition-all"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isLoadingAnalytics ? 'animate-spin' : ''}`} />
                    <span>{isLoadingAnalytics ? 'กำลังดึงข้อมูล...' : 'รีเฟรชข้อมูลจริงจากคลาวด์'}</span>
                  </button>
                </div>
              </div>

              {analyticsError && (
                <div className="mb-5 p-3.5 rounded-2xl bg-rose-950/80 border border-rose-700 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
                  <span>เกิดข้อผิดพลาดในการดึงข้อมูล: {analyticsError}</span>
                </div>
              )}

              {/* 3 Status Zones Reference */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-center mb-6">
                <div className="bg-emerald-950/40 border border-emerald-800/80 p-3.5 rounded-2xl">
                  <span className="text-xs font-black text-emerald-400 block">0.80 – 1.30</span>
                  <span className="text-sm font-bold text-emerald-200">Sweet Spot (ปลอดภัย)</span>
                  <p className="text-[10px] text-emerald-300/80 mt-0.5">โซนสมดุล ร่างกายฟื้นฟูทันและเกิดการพัฒนาสมรรถภาพสูงสุด</p>
                </div>

                <div className="bg-amber-950/40 border border-amber-800/80 p-3.5 rounded-2xl">
                  <span className="text-xs font-black text-amber-400 block">1.31 – 1.49</span>
                  <span className="text-sm font-bold text-amber-200">Early Warning (เฝ้าระวัง)</span>
                  <p className="text-[10px] text-amber-300/80 mt-0.5">ภาระงานพุ่งสูงเร็ว ควรตรวจเช็กข้อต่อหัวไหล่ (Rotator Cuff)</p>
                </div>

                <div className="bg-rose-950/40 border border-rose-800/80 p-3.5 rounded-2xl">
                  <span className="text-xs font-black text-rose-400 block">≥ 1.50</span>
                  <span className="text-sm font-bold text-rose-200">Danger Zone (เสี่ยงเจ็บ)</span>
                  <p className="text-[10px] text-rose-300/80 mt-0.5">เสี่ยงบาดเจ็บกล้ามเนื้อและภาวะฝึกซ้อมเกิน ลด Volume ทันที</p>
                </div>
              </div>

              {/* การ์ดสถานะรายบุคคลทั้ง 4 คนจาก Supabase */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {acwrStatsList.map(stat => {
                  const isSelected = stat.athleteId === selectedAthleteId;
                  const badgeStyle =
                    stat.status === 'danger'
                      ? 'bg-rose-950 text-rose-400 border-rose-700'
                      : stat.status === 'early_warning'
                      ? 'bg-amber-950 text-amber-400 border-amber-700'
                      : stat.status === 'sweet_spot'
                      ? 'bg-emerald-950 text-emerald-400 border-emerald-700'
                      : 'bg-slate-800 text-slate-300 border-slate-700';

                  const barColor =
                    stat.status === 'danger'
                      ? 'bg-rose-500'
                      : stat.status === 'early_warning'
                      ? 'bg-amber-500'
                      : stat.status === 'sweet_spot'
                      ? 'bg-emerald-500'
                      : 'bg-cyan-500';

                  const statusLabel =
                    stat.status === 'danger'
                      ? 'Danger Zone (เสี่ยงเจ็บ ≥ 1.50)'
                      : stat.status === 'early_warning'
                      ? 'Early Warning (เฝ้าระวัง 1.31–1.49)'
                      : stat.status === 'sweet_spot'
                      ? 'Sweet Spot (ปลอดภัย 0.80–1.30)'
                      : 'Undertraining (< 0.80)';

                  const coachAdvice =
                    stat.status === 'danger'
                      ? 'คำเตือนวิกฤต: ภาระงานพุ่งสูงเกินเกณฑ์ ควรลดเซตสปรินต์และเน้นฟื้นฟู REC ทันที'
                      : stat.status === 'early_warning'
                      ? 'เฝ้าระวัง: เริ่มเข้าใกล้ขีดจำกัด ควรติดตามอาการตึงหัวไหล่ (Rotator Cuff) อย่างใกล้ชิด'
                      : stat.status === 'sweet_spot'
                      ? 'สมดุลดีเยี่ยม: ร่างกายตอบสนองต่อการฝึกซ้อมได้ดี คงความเข้มข้นตามแผน Periodization'
                      : 'ภาระงานสะสมยังต่ำกว่าเกณฑ์สมดุล สามารถเพิ่มความเข้มข้นหรือ Volume ได้อย่างปลอดภัย';

                  const hasReadinessAlert =
                    (stat.latestRhr !== null && stat.latestRhr >= 72) ||
                    (stat.latestShoulderSoreness !== null && stat.latestShoulderSoreness >= 3);

                  return (
                    <div
                      key={stat.athleteId}
                      onClick={() => setSelectedAthleteId(stat.athleteId)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-slate-950 border-cyan-500 ring-1 ring-cyan-500/40'
                          : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-sm text-white">
                              {stat.name} ({stat.nickname})
                            </h3>
                            <span className="text-[10px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                              {stat.group}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            บันทึกซ้อมในรอบ 28 วัน: <b className="text-slate-200">{stat.sessionsCount28d}</b> ครั้ง
                          </p>
                        </div>

                        <div className="text-right">
                          <span
                            className={`text-xl font-black block leading-none ${
                              stat.status === 'danger'
                                ? 'text-rose-400'
                                : stat.status === 'early_warning'
                                ? 'text-amber-400'
                                : stat.status === 'sweet_spot'
                                ? 'text-emerald-400'
                                : 'text-cyan-400'
                            }`}
                          >
                            {stat.acwr.toFixed(2)}
                          </span>
                          <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeStyle}`}>
                            {statusLabel}
                          </span>
                        </div>
                      </div>

                      {/* แถบวัด ACWR */}
                      <div className="mt-3">
                        <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                          <span>Acute (7 วัน): <b className="text-cyan-400">{stat.acuteLoad7d.toLocaleString()} AU</b></span>
                          <span>Chronic (28 วัน): <b className="text-slate-200">{stat.chronicLoad28d.toLocaleString()} AU</b></span>
                        </div>
                        <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                            style={{ width: `${Math.min(100, (stat.acwr / 2.0) * 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* ข้อมูลความพร้อมเช้าล่าสุดจาก daily_readiness */}
                      <div
                        className={`mt-3 p-2.5 rounded-xl border text-[11px] flex flex-wrap items-center justify-between gap-2 ${
                          hasReadinessAlert
                            ? 'bg-rose-950/40 border-rose-800/80 text-rose-200'
                            : 'bg-slate-900/90 border-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          {hasReadinessAlert ? (
                            <AlertTriangle className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                          ) : (
                            <Heart className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                          )}
                          <span>
                            RHR ล่าสุด: <b>{stat.latestRhr !== null ? `${stat.latestRhr} bpm` : 'ไม่มีข้อมูล'}</b>
                          </span>
                        </div>
                        <div>
                          <span>
                            ความตึงหัวไหล่:{' '}
                            <b
                              className={
                                stat.latestShoulderSoreness && stat.latestShoulderSoreness >= 3
                                  ? 'text-rose-400'
                                  : 'text-emerald-400'
                              }
                            >
                              {stat.latestShoulderSoreness !== null ? `${stat.latestShoulderSoreness}/5` : '-'}
                            </b>
                          </span>
                        </div>
                      </div>

                      <p className="mt-2.5 text-[11px] text-slate-400 leading-relaxed">{coachAdvice}</p>
                    </div>
                  );
                })}
              </div>

              {/* รายละเอียดเชิงลึกของนักกีฬาที่เลือก */}
              {selectedAthleteStats && (
                <div className="mt-5 p-4 rounded-2xl bg-slate-950/90 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="text-slate-400">กำลังดูรายละเอียดเชิงลึก: </span>
                    <b className="text-white">{selectedAthleteStats.name}</b>
                    <span className="text-slate-500 ml-2">
                      (ค่าเฉลี่ยรายวัน 7 วัน = {Math.round(selectedAthleteStats.acuteLoad7d / 7)} AU/วัน vs 28 วัน ={' '}
                      {Math.round(selectedAthleteStats.chronicLoad28d / 28)} AU/วัน)
                    </span>
                  </div>
                  <span className="text-[11px] text-cyan-400 font-bold">
                    สูตรคำนวณ: ACWR = Acute Avg (7d) ÷ Chronic Avg (28d)
                  </span>
                </div>
              )}
            </div>

            {/* TSA Standards Benchmark Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">
                    มิติที่ 4: TSA Benchmark & Personal Best
                  </span>
                  <h3 className="text-lg font-black text-white mt-1">
                    เปรียบเทียบสถิติกับเกณฑ์เวลาสมาคมกีฬาทางน้ำแห่งประเทศไทย (TSA 2026)
                  </h3>
                </div>
                <span className="text-xs bg-slate-800 px-3 py-1 rounded-xl text-slate-300 font-bold">สระ 50m ทางการ</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-950/80 text-slate-400 font-bold uppercase border-b border-slate-800">
                    <tr>
                      <th className="p-3">ท่าว่าย & ระยะทาง</th>
                      <th className="p-3">สถิติดีที่สุด (PB)</th>
                      <th className="p-3">เกณฑ์เวลา TSA</th>
                      <th className="p-3">ส่วนต่าง (Delta Time)</th>
                      <th className="p-3 text-right">สถานะเป้าหมาย</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    <tr className="hover:bg-slate-800/40">
                      <td className="p-3 font-bold text-white">Freestyle 50m</td>
                      <td className="p-3 font-mono text-cyan-400">0:28.40</td>
                      <td className="p-3 font-mono text-slate-400">0:28.10</td>
                      <td className="p-3 font-mono font-bold text-amber-400">+0.30 วินาที</td>
                      <td className="p-3 text-right">
                        <span className="bg-amber-950 text-amber-400 px-2 py-0.5 rounded text-[10px] font-bold border border-amber-800">
                          ใกล้แตะเกณฑ์
                        </span>
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-800/40">
                      <td className="p-3 font-bold text-white">Freestyle 100m</td>
                      <td className="p-3 font-mono text-cyan-400">1:01.80</td>
                      <td className="p-3 font-mono text-slate-400">1:02.50</td>
                      <td className="p-3 font-mono font-bold text-emerald-400">-0.70 วินาที</td>
                      <td className="p-3 text-right">
                        <span className="bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded text-[10px] font-bold border border-emerald-800">
                          ผ่านเกณฑ์สมาคมฯ
                        </span>
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-800/40">
                      <td className="p-3 font-bold text-white">Butterfly 50m</td>
                      <td className="p-3 font-mono text-cyan-400">0:31.20</td>
                      <td className="p-3 font-mono text-slate-400">0:30.40</td>
                      <td className="p-3 font-mono font-bold text-rose-400">+0.80 วินาที</td>
                      <td className="p-3 text-right">
                        <span className="bg-rose-950 text-rose-400 px-2 py-0.5 rounded text-[10px] font-bold border border-rose-800">
                          ต้องพัฒนาสปรินต์
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 4: FAMILY SUMMARY CARD & PDPA YOUTH DATA GOVERNANCE       */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'parent' && (
          <div className="max-w-3xl mx-auto space-y-5">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/80 px-2.5 py-0.5 rounded border border-emerald-800">
                    มิติที่ 5: PDPA Youth Health Protection & Family Digest
                  </span>
                  <h2 className="text-xl font-black text-white mt-1.5">
                    รายงานความก้าวหน้าและสุขภาพนักกีฬาเยาวชน (ฉบับผู้ปกครอง)
                  </h2>
                  <p className="text-xs text-slate-400">
                    คุ้มครองข้อมูลส่วนบุคคลตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA) และสิทธิ์เข้าถึงแบบ Row Level Security
                  </p>
                </div>

                <select
                  value={parentAthleteId}
                  onChange={e => setParentAthleteId(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none"
                >
                  {swimmers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.nickname})
                    </option>
                  ))}
                </select>
              </div>

              {/* PDPA E-Consent Status Banner */}
              <div className="bg-emerald-950/30 border border-emerald-800/80 rounded-2xl p-4 flex items-start gap-3">
                <ShieldCheck className="h-6 w-6 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-emerald-300">สถานะความยินยอมผู้ปกครอง (Digital E-Consent):</span>
                    <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                      ยืนยันแล้ว (Active)
                    </span>
                  </div>
                  <p className="text-slate-400 leading-relaxed">
                    ข้อมูลชีพจร (RHR) ความล้าของกล้ามเนื้อ และสถิติเวลาของ <b>{selectedParentSwimmer.name}</b>{' '}
                    ถูกเข้ารหัสและเปิดสิทธิ์ให้เฉพาะผู้ปกครองตามกฎหมายและผู้ฝึกสอนประจำสโมสรเข้าถึงได้เท่านั้น
                  </p>
                </div>
              </div>

              {/* Friendly Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl">
                  <span className="text-[11px] text-slate-400 block">ความพร้อมร่างกายล่าสุด</span>
                  <span className="text-lg font-black text-emerald-400 mt-1 block">
                    {selectedParentSwimmer.readinessStatus === 'green'
                      ? 'พร้อมฝึกซ้อมเต็มที่'
                      : selectedParentSwimmer.readinessStatus === 'yellow'
                      ? 'ควรยืดเหยียดไหล่เพิ่ม'
                      : 'แนะนำพักฟื้นร่างกาย'}
                  </span>
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    ชีพจรเช้า: {selectedParentSwimmer.rhr} bpm
                  </span>
                </div>

                <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl">
                  <span className="text-[11px] text-slate-400 block">ภาระงานฝึกซ้อมล่าสุด</span>
                  <span className="text-lg font-black text-cyan-400 mt-1 block">
                    {selectedParentSwimmer.loadAu} AU
                  </span>
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    ระดับความตั้งใจ sRPE: {selectedParentSwimmer.srpe}/10
                  </span>
                </div>

                <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl">
                  <span className="text-[11px] text-slate-400 block">เวลาจริงเทียบเป้าหมาย</span>
                  <span className="text-lg font-black text-amber-400 mt-1 block font-mono">
                    {selectedParentSwimmer.actualTime || '-'}
                  </span>
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    เกณฑ์เป้าหมาย: {selectedParentSwimmer.targetTime}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 5: WORKOUT BUILDER (NESTED SETS & AUTO USA SWIMMING ZONES) */}
        {/* ------------------------------------------------------------- */}
        {activeTab === 'builder' && (
          <div className="space-y-5">

            {/* Top Summary & Stroke Breakdown Bar */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400 bg-sky-950 px-2.5 py-0.5 rounded border border-sky-800">
                    มิติที่ 3: Nested Sets & Auto-Zone Engine
                  </span>
                  <h2 className="text-xl font-black text-white mt-1">
                    ระบบสร้างโปรแกรมฝึกซ้อมอัจฉริยะ (USA Swimming Zones & Interval Pace)
                  </h2>
                  <p className="text-xs text-slate-400">จัดโครงสร้างเซตซ้อมแบบซ้อนรอบ ระบบวิเคราะห์โซนพลังงานและคำนวณรอบปล่อยตัวให้อัตโนมัติ</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* CSS Base Pace Config */}
                  <div className="flex items-center gap-2 bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 text-xs">
                    <Timer className="h-4 w-4 text-cyan-400" />
                    <span className="text-slate-400">CSS 100m ฐาน:</span>
                    <input
                      type="number"
                      min={45}
                      max={150}
                      value={cssBase100m}
                      onChange={e => setCssBase100m(Number(e.target.value) || 75)}
                      className="w-14 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-center text-cyan-400 font-bold outline-none"
                    />
                    <span className="text-slate-400">วิ</span>
                  </div>

                  <button
                    onClick={handleSaveWorkoutToSupabase}
                    disabled={isSavingWorkout}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/20 flex items-center gap-2 transition-all active:scale-95"
                  >
                    {isSavingWorkout ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>กำลังบันทึกโปรแกรม...</span>
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        <span>บันทึกโปรแกรมซ้อมลง Supabase</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Feedback Alert */}
              {workoutFeedback && (
                <div
                  className={`p-3.5 rounded-2xl text-xs flex items-center gap-2.5 border ${
                    workoutFeedback.type === 'success'
                      ? 'bg-emerald-950/80 border-emerald-700 text-emerald-300'
                      : 'bg-rose-950/80 border-rose-700 text-rose-300'
                  }`}
                >
                  {workoutFeedback.type === 'success' ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
                  )}
                  <span className="font-medium">{workoutFeedback.message}</span>
                </div>
              )}

              {/* Workout Title & Live Metrics Overview */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-center">
                <div className="lg:col-span-1">
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">ชื่อโปรแกรมฝึกซ้อม (Workout Title)</label>
                  <input
                    type="text"
                    value={workoutTitle}
                    onChange={e => setWorkoutTitle(e.target.value)}
                    placeholder="ระบุชื่อชุดซ้อม เช่น Aerobic Endurance & Sprint"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white focus:border-cyan-500 outline-none"
                  />
                </div>

                <div className="lg:col-span-2 bg-slate-950/90 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-[11px] text-slate-400 block">ระยะทางรวมทั้งหมด (Total Distance)</span>
                    <span className="text-2xl font-black text-cyan-400">
                      {workoutMetrics.totalDistance.toLocaleString()}{' '}
                      <span className="text-sm font-bold text-slate-400">เมตร</span>
                    </span>
                  </div>

                  {/* Stroke Breakdown Pills */}
                  <div className="flex-1 w-full sm:w-auto">
                    <span className="text-[11px] text-slate-400 block mb-1.5">สัดส่วนระยะทางแยกตามท่าว่าย (% Stroke Breakdown)</span>
                    <div className="flex flex-wrap gap-1.5">
                      {workoutMetrics.strokeBreakdown.length > 0 ? (
                        workoutMetrics.strokeBreakdown.map(sb => (
                          <span
                            key={sb.stroke}
                            className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-200"
                          >
                            {sb.stroke}: <b className="text-cyan-400">{sb.percentage}%</b> ({sb.distance}m)
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-500">ยังไม่มีรายการซ้อม</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Nested Set Groups List */}
            <div className="space-y-4">
              {setGroups.map((group, gIndex) => {
                const groupDistance = group.rounds * group.items.reduce((acc, i) => acc + i.reps * i.distanceM, 0);

                return (
                  <div key={group.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">

                    {/* Group Header (Rounds & Rest between rounds) */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="h-7 w-7 rounded-xl bg-cyan-600/20 border border-cyan-500/40 text-cyan-400 font-black text-xs flex items-center justify-center">
                          {gIndex + 1}
                        </span>
                        <select
                          value={group.category}
                          onChange={e => handleUpdateGroup(group.id, 'category', e.target.value as SetCategory)}
                          className="bg-slate-950 border border-slate-700 text-white text-xs font-black rounded-xl px-3 py-1.5 outline-none"
                        >
                          <option value="Warm-up">Warm-up (อบอุ่นร่างกาย)</option>
                          <option value="Pre-set">Pre-set (เซตเตรียมความพร้อม)</option>
                          <option value="Main Set">Main Set (เซตหลัก)</option>
                          <option value="Cool-down">Cool-down (คลายกล้ามเนื้อ)</option>
                        </select>

                        <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800 text-xs">
                          <span className="text-slate-400">ทำซ้ำ:</span>
                          <input
                            type="number"
                            min={1}
                            max={20}
                            value={group.rounds}
                            onChange={e => handleUpdateGroup(group.id, 'rounds', Math.max(1, Number(e.target.value)))}
                            className="w-10 bg-slate-900 border border-slate-700 rounded text-center text-amber-400 font-bold outline-none"
                          />
                          <span className="text-slate-400">รอบ (Rounds)</span>
                        </div>

                        <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800 text-xs">
                          <span className="text-slate-400">พักระหว่างรอบ:</span>
                          <input
                            type="number"
                            min={0}
                            max={600}
                            step={5}
                            value={group.restBetweenRoundsSec}
                            onChange={e =>
                              handleUpdateGroup(group.id, 'restBetweenRoundsSec', Math.max(0, Number(e.target.value)))
                            }
                            className="w-12 bg-slate-900 border border-slate-700 rounded text-center text-cyan-400 font-bold outline-none"
                          />
                          <span className="text-slate-400">วิ</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-300">
                          ระยะทางกลุ่มนี้: <b className="text-cyan-400">{groupDistance.toLocaleString()} ม.</b>
                        </span>
                        <button
                          onClick={() => handleRemoveGroup(group.id)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/50 rounded-lg transition-colors"
                          title="ลบกลุ่มเซตนี้"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Sub-Items Rows */}
                    <div className="space-y-2.5">
                      {group.items.map(item => {
                        const autoZone = classifyEnergyZone(item.distanceM, item.restSec, group.category);
                        const zoneObj = ENERGY_ZONES.find(z => z.code === autoZone) || ENERGY_ZONES[1];
                        const intervalData = calculatePersonalizedInterval(
                          item.distanceM,
                          autoZone,
                          item.restSec,
                          cssBase100m
                        );

                        return (
                          <div
                            key={item.id}
                            className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800/90 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
                          >
                            {/* Inputs: Reps x Distance | Stroke | Rest */}
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-xl border border-slate-800">
                                <span className="text-slate-400">จำนวน:</span>
                                <input
                                  type="number"
                                  min={1}
                                  max={50}
                                  value={item.reps}
                                  onChange={e =>
                                    handleUpdateItem(group.id, item.id, 'reps', Math.max(1, Number(e.target.value)))
                                  }
                                  className="w-11 bg-slate-950 border border-slate-700 rounded text-center text-white font-bold py-0.5 outline-none"
                                />
                                <span className="text-slate-400">×</span>
                              </div>

                              <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-xl border border-slate-800">
                                <span className="text-slate-400">ระยะ:</span>
                                <select
                                  value={item.distanceM}
                                  onChange={e =>
                                    handleUpdateItem(group.id, item.id, 'distanceM', Number(e.target.value))
                                  }
                                  className="bg-slate-950 border border-slate-700 rounded text-cyan-400 font-bold px-2 py-0.5 outline-none"
                                >
                                  {[25, 50, 75, 100, 150, 200, 300, 400, 800, 1500].map(d => (
                                    <option key={d} value={d}>
                                      {d}m
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-xl border border-slate-800">
                                <span className="text-slate-400">ท่า:</span>
                                <select
                                  value={item.stroke}
                                  onChange={e =>
                                    handleUpdateItem(group.id, item.id, 'stroke', e.target.value as StrokeType)
                                  }
                                  className="bg-slate-950 border border-slate-700 rounded text-white font-bold px-2 py-0.5 outline-none"
                                >
                                  <option value="Freestyle">Freestyle</option>
                                  <option value="Backstroke">Backstroke</option>
                                  <option value="Breaststroke">Breaststroke</option>
                                  <option value="Butterfly">Butterfly</option>
                                  <option value="IM">IM (เดี่ยวผสม)</option>
                                </select>
                              </div>

                              <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-xl border border-slate-800">
                                <span className="text-slate-400">พัก:</span>
                                <input
                                  type="number"
                                  min={0}
                                  max={300}
                                  step={5}
                                  value={item.restSec}
                                  onChange={e =>
                                    handleUpdateItem(group.id, item.id, 'restSec', Math.max(0, Number(e.target.value)))
                                  }
                                  className="w-12 bg-slate-950 border border-slate-700 rounded text-center text-amber-400 font-bold py-0.5 outline-none"
                                />
                                <span className="text-slate-400">วิ</span>
                              </div>
                            </div>

                            {/* Auto-Tagged Zone & Personalized Interval Output */}
                            <div className="flex flex-wrap items-center justify-between lg:justify-end gap-2.5">
                              {/* Auto Energy Zone Badge */}
                              <div
                                className={`px-2.5 py-1 rounded-xl border text-[11px] font-black flex items-center gap-1.5 ${zoneObj.color}`}
                              >
                                <Zap className="h-3 w-3" />
                                <span>{autoZone}</span>
                                <span className="font-medium opacity-80 hidden sm:inline">({zoneObj.name})</span>
                              </div>

                              {/* Auto Interval Pace */}
                              <div
                                className="px-3 py-1 rounded-xl bg-slate-900 border border-cyan-800/70 text-xs font-mono font-black text-cyan-300 flex items-center gap-1.5"
                                title={`เวลาว่ายเป้าหมาย ~${intervalData.targetSwimSec} วิ + พัก ${item.restSec} วิ (ปัดขึ้นรอบ 5 วิ)`}
                              >
                                <Clock className="h-3.5 w-3.5 text-cyan-400" />
                                <span>{intervalData.formatted}</span>
                              </div>

                              <button
                                onClick={() => handleRemoveItem(group.id, item.id)}
                                className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg transition-colors"
                                title="ลบรายการย่อย"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Add Sub-item Button */}
                    <div>
                      <button
                        onClick={() => handleAddItem(group.id)}
                        className="text-xs font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-950/40 border border-cyan-800/60 hover:bg-cyan-950/70 transition-all"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>เพิ่มรายการย่อยในกลุ่มนี้</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add New Set Group Buttons */}
            <div className="bg-slate-900/60 border border-dashed border-slate-700 rounded-3xl p-4 flex flex-wrap items-center justify-center gap-2.5">
              <span className="text-xs font-bold text-slate-400 mr-1">เพิ่มกลุ่มเซตซ้อมใหม่:</span>
              {(['Warm-up', 'Pre-set', 'Main Set', 'Cool-down'] as SetCategory[]).map(cat => (
                <button
                  key={cat}
                  onClick={() => handleAddGroup(cat)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-cyan-600 text-xs font-bold text-slate-200 hover:text-white transition-all flex items-center gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>+ {cat}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* 3. Footer */}
      <footer className="max-w-7xl mx-auto px-4 mt-8 pt-4 border-t border-slate-900 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p>© 2026 ApexAqua Platform. สถาปัตยกรรมมาตรฐานวิทยาศาสตร์การกีฬาและการคุ้มครองข้อมูลเยาวชน</p>
        <div className="flex items-center gap-4 text-[11px]">
          <span>USA Swimming Energy Zones</span>
          <span>•</span>
          <span>Borg CR-10 sRPE</span>
          <span>•</span>
          <span>ACWR Model</span>
        </div>
      </footer>
    </div>
  );
}