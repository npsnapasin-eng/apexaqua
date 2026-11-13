'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Waves, ShieldCheck, CheckCircle2,
  BarChart3, Timer, Filter, Save, AlertCircle, Plus, Trash2,
  LogOut, Lock, FileSignature, Trophy, Users, RefreshCw, Layers,
  Upload, Download, FileSpreadsheet, Calendar, UserCog, Mail, Baby,
  Sun, Moon, Globe
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

// --- Types & Interfaces ---
type UserRole = 'coach' | 'parent' | 'athlete';
type LangCode = 'th' | 'en' | 'zh';
type ThemeMode = 'dark' | 'light';

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
  parent_email: string;
}

interface StaffMember {
  id: string;
  full_name: string;
  email: string;
  staff_role: 'head_coach' | 'assistant_coach';
  can_edit_workouts: boolean;
  can_manage_athletes: boolean;
}

interface PoolsideRow extends AthleteProfile {
  targetTime: string;
  actualTime: string;
  attended: boolean;
  srpe: number;
}

interface WorkoutLogRecord {
  id: string;
  athlete_id: string;
  workout_date: string;
  duration_minutes: number;
  srpe: number;
  session_load_au: number;
  attended: boolean;
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

// --- Multi-Language Dictionary (TH / EN / ZH) ---
const I18N: Record<LangCode, Record<string, string>> = {
  th: {
    subtitle: 'ระบบบริหารและวิเคราะห์ศักยภาพนักกีฬาว่ายน้ำสโมสร',
    roleCoach: 'โค้ช / Staff',
    roleParent: 'ผู้ปกครอง',
    roleAthlete: 'นักกีฬา',
    signIn: 'เข้าสู่ระบบ (Sign In)',
    signUp: 'ลงทะเบียนใหม่ (Sign Up)',
    emailLabel: 'อีเมลผู้ใช้งาน (Email)',
    passwordLabel: 'รหัสผ่าน (Password อย่างน้อย 6 ตัวอักษร)',
    selectAthlete: 'เลือกชื่อนักกีฬา',
    pinLabel: 'รหัส PIN ประจำตัว 4 หลัก',
    loginBtn: 'เข้าสู่ระบบ ApexAqua',
    pdpaFooter: 'คุ้มครองข้อมูลสุขภาพเยาวชนตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA)',
    tabPoolside: '1. คุมริมสระ & รายชื่อ',
    tabReadiness: '2. เช็กอินเช้า',
    tabAcwr: '3. ACWR, ประวัติ & TSA',
    tabPdpa: '4. ครอบครัว & PDPA',
    tabBuilder: '5. จัดเซตซ้อม',
    tabStaff: '6. ทีมงานโค้ช',
    logout: 'ออกจากระบบ',
    dayMode: 'โหมดกลางวัน',
    nightMode: 'โหมดกลางคืน',
    childrenLabel: 'บุตรหลานในความดูแล',
    addAthleteBtn: '+ เพิ่มรายชื่อนักกีฬาจริง',
    allLanes: 'ทุกลู่',
    lane: 'ลู่',
    duration: 'เวลาซ้อม',
    mins: 'นาที',
    saveAllPool: 'บันทึกคะแนนทั้งสระ',
    srpeLabel: 'ความเหนื่อย sRPE',
    readinessTitle: 'เช็กอินความพร้อมร่างกายตอนเช้า',
    rhrLabel: 'ชีพจรขณะพัก (RHR)',
    sleepLabel: 'ชั่วโมงการนอนหลับ',
    hrs: 'ชม.',
    sorenessTitle: 'แผนที่ความตึงกล้ามเนื้อ 5 จุด (1 = ปกติ, 5 = ตึงมาก)',
    submitReadiness: 'ส่งข้อมูลความพร้อมเช้า',
    acwrTitle: 'ดัชนีภาระงานสะสม ACWR (7 วัน / 28 วัน)',
    refreshBtn: 'รีเฟรชข้อมูลจริง',
    historyTitle: 'ตารางประวัติการซ้อมย้อนหลังรายวัน',
    exportCsvBtn: 'ดาวน์โหลดไฟล์ Excel (CSV)',
    tsaTitle: 'ฐานข้อมูลเกณฑ์เวลาสมาคมฯ (สระ 50m & แปลงสระ 25m อัตโนมัติ)',
    downloadTemplate: 'โหลดไฟล์ตัวอย่าง CSV',
    uploadCsv: 'อัปโหลดเกณฑ์ 50m (CSV)',
    course50: 'สระ 50m (ทางการ)',
    course25: 'สระ 25m (เกณฑ์แปลง)',
    addPbBtn: '+ บันทึกสถิติ PB',
    pdpaTitle: 'แบบฟอร์มลงนามยินยอมข้อมูลสุขภาพเยาวชน (PDPA Digital E-Consent)',
    signPdpaBtn: 'ยืนยันและลงนาม PDPA Digital E-Consent',
    builderTitle: 'ระบบสร้างโปรแกรมฝึกซ้อมอัจฉริยะ',
    saveWorkoutBtn: 'บันทึกโปรแกรมซ้อมลง Supabase',
    totalDist: 'ระยะทางรวมทั้งหมด',
    meters: 'เมตร',
    addGroupBtn: '+ เพิ่มกลุ่มเซตซ้อมใหม่',
    staffTitle: 'จัดการสิทธิ์ทีมงานผู้ฝึกสอน (ผู้ช่วยโค้ช)',
  },
  en: {
    subtitle: 'Club Swimming Sports Science & Performance Platform',
    roleCoach: 'Coach / Staff',
    roleParent: 'Parent',
    roleAthlete: 'Athlete',
    signIn: 'Sign In',
    signUp: 'Sign Up (New)',
    emailLabel: 'Email Address',
    passwordLabel: 'Password (min. 6 characters)',
    selectAthlete: 'Select Athlete',
    pinLabel: '4-Digit Personal PIN',
    loginBtn: 'Sign In to ApexAqua',
    pdpaFooter: 'Youth health data protected under PDPA compliance.',
    tabPoolside: '1. Poolside & Roster',
    tabReadiness: '2. Readiness',
    tabAcwr: '3. ACWR & TSA',
    tabPdpa: '4. Family & PDPA',
    tabBuilder: '5. Workout Builder',
    tabStaff: '6. Staff RBAC',
    logout: 'Sign Out',
    dayMode: 'Day Mode',
    nightMode: 'Night Mode',
    childrenLabel: 'Children in Family Account',
    addAthleteBtn: '+ Add Real Athlete',
    allLanes: 'All Lanes',
    lane: 'Lane',
    duration: 'Duration',
    mins: 'mins',
    saveAllPool: 'Save Pool Session',
    srpeLabel: 'Exertion sRPE',
    readinessTitle: 'Morning Pre-Training Readiness Check-in',
    rhrLabel: 'Resting Heart Rate (RHR)',
    sleepLabel: 'Sleep Duration',
    hrs: 'hrs',
    sorenessTitle: '5-Point Muscle Soreness Map (1 = Fresh, 5 = Very Sore)',
    submitReadiness: 'Submit Morning Readiness',
    acwrTitle: 'Cumulative Workload Index ACWR (7d / 28d)',
    refreshBtn: 'Refresh Live Data',
    historyTitle: 'Daily Training Audit History',
    exportCsvBtn: 'Export Excel (CSV)',
    tsaTitle: 'TSA Time Standards (50m Official & 25m Auto-Converted)',
    downloadTemplate: 'CSV Template',
    uploadCsv: 'Import 50m CSV',
    course50: '50m Pool (Official)',
    course25: '25m Pool (Converted)',
    addPbBtn: '+ Log PB Time',
    pdpaTitle: 'Youth Health Data Digital E-Consent (PDPA)',
    signPdpaBtn: 'Confirm & Sign PDPA Digital E-Consent',
    builderTitle: 'Smart Nested Workout Builder & Auto-Zone Engine',
    saveWorkoutBtn: 'Save Workout to Cloud',
    totalDist: 'Total Workout Distance',
    meters: 'm',
    addGroupBtn: '+ Add New Set Group',
    staffTitle: 'Coaching Staff & Permissions Management',
  },
  zh: {
    subtitle: '游泳俱乐部运动科学与竞技表现管理平台',
    roleCoach: '教练 / 管理',
    roleParent: '家长',
    roleAthlete: '运动员',
    signIn: '登录 (Sign In)',
    signUp: '首次注册 (Sign Up)',
    emailLabel: '电子邮箱 (Email)',
    passwordLabel: '密码 (至少6位字符)',
    selectAthlete: '选择运动员姓名',
    pinLabel: '4位数个人PIN码',
    loginBtn: '进入 ApexAqua 系统',
    pdpaFooter: '青少年健康数据受 PDPA 个人数据保护法严格保护',
    tabPoolside: '1. 池边控制与名单',
    tabReadiness: '2. 晨间状态打卡',
    tabAcwr: '3. ACWR负荷与达标',
    tabPdpa: '4. 家庭与PDPA授权',
    tabBuilder: '5. 智能训练计划',
    tabStaff: '6. 教练团队权限',
    logout: '退出系统',
    dayMode: '日间模式',
    nightMode: '夜间模式',
    childrenLabel: '家庭关联运动员',
    addAthleteBtn: '+ 添加正式运动员',
    allLanes: '全部泳道',
    lane: '泳道',
    duration: '训练时长',
    mins: '分钟',
    saveAllPool: '保存全队训练负荷',
    srpeLabel: '疲劳度 sRPE',
    readinessTitle: '晨间训练前身体准备度打卡',
    rhrLabel: '晨起静息心率 (RHR)',
    sleepLabel: '睡眠时长',
    hrs: '小时',
    sorenessTitle: '5部位肌肉酸痛评估 (1 = 正常, 5 = 极度酸痛)',
    submitReadiness: '提交晨间准备度数据',
    acwrTitle: '急慢性训练负荷比 ACWR (7天 / 28天)',
    refreshBtn: '刷新实时数据',
    historyTitle: '每日训练负荷历史记录表',
    exportCsvBtn: '导出 Excel (CSV)',
    tsaTitle: '泳协达标成绩库 (50米官方标准 & 25米自动换算)',
    downloadTemplate: '下载 CSV 模板',
    uploadCsv: '导入 50米标准 (CSV)',
    course50: '50米长池 (官方)',
    course25: '25米短池 (换算标准)',
    addPbBtn: '+ 记录个人最佳 PB',
    pdpaTitle: '青少年健康数据数字知情同意书 (PDPA E-Consent)',
    signPdpaBtn: '确认并签署 PDPA 数字授权书',
    builderTitle: '智能循环训练计划与能量区间引擎',
    saveWorkoutBtn: '保存训练计划至云端',
    totalDist: '训练总距离',
    meters: '米',
    addGroupBtn: '+ 添加新训练组',
    staffTitle: '助理教练团队与权限管理',
  },
};

const AGE_GROUP_LABELS: Record<string, string> = {
  group_5: 'Group 5 (7–9 yrs)',
  group_4: 'Group 4 (10–11 yrs)',
  group_3: 'Group 3 (12–13 yrs)',
  group_2: 'Group 2 (14–15 yrs)',
  group_1: 'Group 1 (16–18 yrs)',
  open: 'Open',
};

const TURN_ADVANTAGE_PER_50M: Record<string, number> = {
  Freestyle: 0.65,
  Backstroke: 0.70,
  Breaststroke: 1.10,
  Butterfly: 0.75,
  IM: 0.85,
};

export default function ApexAquaEnterpriseApp() {
  // --- Theme & Language State ---
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [lang, setLang] = useState<LangCode>('th');
  const t = I18N[lang];
  const isLight = theme === 'light';

  // Dynamic Theme Classes (Enlarged Text Foundations for Field Operations)
  const bgPage = isLight ? 'bg-slate-100 text-slate-900 text-sm md:text-base' : 'bg-slate-950 text-slate-100 text-sm md:text-base';
  const bgCard = isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900 border-slate-800 shadow-xl';
  const bgSubCard = isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800';
  const bgInput = isLight ? 'bg-white border-slate-300 text-slate-900 text-sm md:text-base' : 'bg-slate-950 border-slate-700 text-white text-sm md:text-base';
  const textMain = isLight ? 'text-slate-900 font-bold' : 'text-white font-bold';
  const textMuted = isLight ? 'text-slate-600 font-medium' : 'text-slate-300 font-medium';

  // --- 1. Authentication & Session State ---
  const [currentUser, setCurrentUser] = useState<{
    role: UserRole;
    name: string;
    email?: string;
    athleteId?: string;
    staffPermissions?: {
      isHeadCoach: boolean;
      canEditWorkouts: boolean;
      canManageAthletes: boolean;
    };
  } | null>(null);

  const [loginTab, setLoginTab] = useState<UserRole>('coach');
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [selectedAthleteLoginId, setSelectedAthleteLoginId] = useState('');
  const [athletePinInput, setAthletePinInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [activeParentChildId, setActiveParentChildId] = useState<string>('');

  // --- 2. Core Data State ---
  const [athletes, setAthletes] = useState<AthleteProfile[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState<'poolside' | 'readiness' | 'acwr_tsa' | 'pdpa' | 'builder' | 'staff'>('poolside');

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
    parent_email: '',
  });
  const [addingAthlete, setAddingAthlete] = useState(false);

  // --- 4. Staff Management State ---
  const [newStaff, setNewStaff] = useState({
    full_name: '',
    email: '',
    staff_role: 'assistant_coach' as 'head_coach' | 'assistant_coach',
    can_edit_workouts: false,
    can_manage_athletes: false,
  });

  // --- 5. Tab 1: Poolside State ---
  const [poolsideRows, setPoolsideRows] = useState<PoolsideRow[]>([]);
  const [selectedLane, setSelectedLane] = useState<number | 'all'>('all');
  const [sessionDuration, setSessionDuration] = useState<number>(90);
  const [savingPoolside, setSavingPoolside] = useState(false);
  const [poolsideMsg, setPoolsideMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // --- 6. Tab 2: Morning Readiness State ---
  const [readinessAthleteId, setReadinessAthleteId] = useState('');
  const [rhr, setRhr] = useState(64);
  const [sleepHours, setSleepHours] = useState(8);
  const [soreness, setSoreness] = useState({
    shoulder: 1,
    lat: 1,
    core: 1,
    knee: 1,
    ankle: 1,
  });
  const [savingReadiness, setSavingReadiness] = useState(false);
  const [readinessMsg, setReadinessMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // --- 7. Tab 3: ACWR, History & TSA Benchmark State ---
  const [acwrList, setAcwrList] = useState<ACWRResult[]>([]);
  const [allWorkoutLogs, setAllWorkoutLogs] = useState<WorkoutLogRecord[]>([]);
  const [tsaStandards, setTsaStandards] = useState<TSAStandard[]>([]);
  const [compLogs, setCompLogs] = useState<CompLog[]>([]);
  const [tsaCourse, setTsaCourse] = useState<'50m' | '25m'>('50m');
  const [selectedBenchmarkAthleteId, setSelectedBenchmarkAthleteId] = useState('');
  const [importingCsv, setImportingCsv] = useState(false);
  const [csvImportMsg, setCsvImportMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [newComp, setNewComp] = useState({
    meet_name: 'Club Time Trial',
    stroke: 'Freestyle',
    distance_m: 50,
    official_time_sec: '',
  });

  // --- 8. Tab 4: PDPA E-Consent State ---
  const [parentSignerName, setParentSignerName] = useState('');
  const [pdpaTargetAthleteId, setPdpaTargetAthleteId] = useState('');

  // --- 9. Tab 5: Workout Builder State ---
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

  // --- Fetch All Data from Supabase ---
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

      const { data: staffData } = await supabase
        .from('club_staff')
        .select('*')
        .order('created_at', { ascending: true });
      setStaffList((staffData || []) as StaffMember[]);

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

      const twentyEightDaysAgo = new Date();
      twentyEightDaysAgo.setDate(twentyEightDaysAgo.getDate() - 28);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: logsData } = await supabase
        .from('workout_logs')
        .select('*')
        .order('workout_date', { ascending: false });

      const typedLogs = (logsData || []) as WorkoutLogRecord[];
      setAllWorkoutLogs(typedLogs);

      const { data: readyData } = await supabase
        .from('daily_readiness')
        .select('*')
        .order('created_at', { ascending: false });

      const computedAcwr: ACWRResult[] = list.map((ath) => {
        const athLogs28d = typedLogs.filter(
          (l) => l.athlete_id === ath.id && new Date(l.workout_date) >= twentyEightDaysAgo
        );
        const chronicTotal = athLogs28d.reduce((acc, cur) => acc + Number(cur.session_load_au || 0), 0);
        const acuteTotal = athLogs28d
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
          sessionCount28d: athLogs28d.length,
          latestRhr: latestR ? latestR.rhr : null,
          latestShoulder: latestR ? latestR.shoulder_soreness : null,
        };
      });
      setAcwrList(computedAcwr);

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

  // Helper function to format seconds into mm:ss.ms
  const formatSecondsToSwimTime = (secVal: number | null) => {
    if (secVal === null || secVal === undefined || isNaN(secVal)) return '-';
    const mins = Math.floor(secVal / 60);
    const secs = (secVal % 60).toFixed(2);
    const paddedSecs = Number(secs) < 10 ? `0${secs}` : secs;
    return mins > 0 ? `${mins}:${paddedSecs}` : `${secs}s`;
  };

  // --- Shared Theme & Language Switcher Bar Component ---
  const renderControlsBar = () => (
    <div className="flex items-center gap-2.5">
      {/* Language Switcher (TH / EN / ZH) */}
      <div className={`flex items-center rounded-xl border p-1 text-xs md:text-sm font-bold ${bgSubCard}`}>
        <Globe className="h-4 w-4 text-cyan-500 mx-1.5" />
        {(['th', 'en', 'zh'] as LangCode[]).map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => setLang(code)}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              lang === code
                ? 'bg-cyan-600 text-white shadow'
                : `${textMuted} hover:text-cyan-500`
            }`}
          >
            {code === 'th' ? 'TH' : code === 'en' ? 'EN' : '中文'}
          </button>
        ))}
      </div>

      {/* Day / Night Theme Toggle */}
      <button
        type="button"
        onClick={() => setTheme(isLight ? 'dark' : 'light')}
        className={`px-3.5 py-2 rounded-xl border text-xs md:text-sm font-bold flex items-center gap-2 transition-all ${
          isLight
            ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
            : 'bg-slate-800 border-slate-700 text-amber-400 hover:bg-slate-700'
        }`}
        title={isLight ? t.nightMode : t.dayMode}
      >
        {isLight ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        <span className="hidden sm:inline">{isLight ? t.nightMode : t.dayMode}</span>
      </button>
    </div>
  );

  // --- Handlers: Login & Sign Up ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    if (loginTab === 'athlete') {
      const ath = athletes.find((a) => a.id === selectedAthleteLoginId);
      if (!ath) {
        setLoginError('No athlete profile found.');
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
        setLoginError('Invalid 4-digit PIN.');
      }
      return;
    }

    setAuthLoading(true);
    try {
      const cleanEmail = emailInput.trim().toLowerCase();
      if (!cleanEmail || !passwordInput) throw new Error('Email & Password required');

      if (authMode === 'signup') {
        const { error: signUpErr } = await supabase.auth.signUp({
          email: cleanEmail,
          password: passwordInput,
        });
        if (signUpErr) throw signUpErr;
      } else {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: passwordInput,
        });
        if (signInErr) throw signInErr;
      }

      if (loginTab === 'coach') {
        const staffRecord = staffList.find((s) => s.email.toLowerCase() === cleanEmail);
        const isFirstOrHead = !staffRecord ? staffList.length === 0 : staffRecord.staff_role === 'head_coach';

        if (!staffRecord && !isFirstOrHead) {
          await supabase.auth.signOut();
          throw new Error('Unauthorized staff email.');
        }

        setCurrentUser({
          role: 'coach',
          name: staffRecord ? staffRecord.full_name : `Head Coach (${cleanEmail})`,
          email: cleanEmail,
          staffPermissions: {
            isHeadCoach: isFirstOrHead,
            canEditWorkouts: isFirstOrHead ? true : Boolean(staffRecord?.can_edit_workouts),
            canManageAthletes: isFirstOrHead ? true : Boolean(staffRecord?.can_manage_athletes),
          },
        });
        setActiveTab('poolside');
      } else if (loginTab === 'parent') {
        const myChildren = athletes.filter(
          (a) => a.parent_email && a.parent_email.toLowerCase() === cleanEmail
        );
        if (myChildren.length === 0) {
          throw new Error('No athletes linked to this parent email.');
        }

        const firstChild = myChildren[0];
        setActiveParentChildId(firstChild.id);
        setReadinessAthleteId(firstChild.id);
        setSelectedBenchmarkAthleteId(firstChild.id);
        setPdpaTargetAthleteId(firstChild.id);
        setParentSignerName(firstChild.parent_name || '');

        setCurrentUser({
          role: 'parent',
          name: `Parent (${cleanEmail})`,
          email: cleanEmail,
          athleteId: firstChild.id,
        });
        setActiveTab('pdpa');
      }
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : String(err));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setActiveParentChildId('');
  };

  const handleSwitchParentChild = (childId: string) => {
    setActiveParentChildId(childId);
    setReadinessAthleteId(childId);
    setSelectedBenchmarkAthleteId(childId);
    setPdpaTargetAthleteId(childId);
    const childObj = athletes.find((a) => a.id === childId);
    if (childObj) setParentSignerName(childObj.parent_name || '');
    setCurrentUser((prev) => (prev ? { ...prev, athleteId: childId } : null));
  };

  // --- Staff Management Handlers ---
  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaff.full_name.trim() || !newStaff.email.trim()) return;
    try {
      const { error } = await supabase.from('club_staff').insert([
        {
          full_name: newStaff.full_name.trim(),
          email: newStaff.email.trim().toLowerCase(),
          staff_role: newStaff.staff_role,
          can_edit_workouts: newStaff.staff_role === 'head_coach' ? true : newStaff.can_edit_workouts,
          can_manage_athletes: newStaff.staff_role === 'head_coach' ? true : newStaff.can_manage_athletes,
        },
      ]);
      if (error) throw error;
      setNewStaff({
        full_name: '',
        email: '',
        staff_role: 'assistant_coach',
        can_edit_workouts: false,
        can_manage_athletes: false,
      });
      await fetchAllData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleToggleStaffPerm = async (
    staff: StaffMember,
    field: 'can_edit_workouts' | 'can_manage_athletes'
  ) => {
    await supabase
      .from('club_staff')
      .update({ [field]: !staff[field] })
      .eq('id', staff.id);
    await fetchAllData();
  };

  const handleDeleteStaff = async (id: string) => {
    if (!confirm('Remove staff access?')) return;
    await supabase.from('club_staff').delete().eq('id', id);
    await fetchAllData();
  };

  // --- Athlete Management Handlers ---
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
          parent_email: newAthlete.parent_email.trim().toLowerCase(),
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
        parent_email: '',
      });
      await fetchAllData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setAddingAthlete(false);
    }
  };

  const handleDeleteAthlete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    await supabase.from('profiles').delete().eq('id', id);
    await fetchAllData();
  };

  // --- Poolside & Readiness Handlers ---
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
        text: `Saved session load for ${attendedRows.length} athletes!`,
      });
      await fetchAllData();
    } catch (err: unknown) {
      setPoolsideMsg({
        type: 'err',
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSavingPoolside(false);
    }
  };

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
          sleep_quality: 4,
          shoulder_soreness: soreness.shoulder,
          lat_soreness: soreness.lat,
          core_soreness: soreness.core,
          knee_soreness: soreness.knee,
          ankle_soreness: soreness.ankle,
        },
      ]);
      if (error) throw error;
      setReadinessMsg({ type: 'ok', text: 'Morning readiness saved to cloud!' });
      await fetchAllData();
    } catch (err: unknown) {
      setReadinessMsg({
        type: 'err',
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSavingReadiness(false);
    }
  };

  // --- CSV Import / Export & TSA Handlers ---
  const handleDownloadSampleCsv = () => {
    const csvContent =
      'season_year,age_group,gender,stroke,distance_m,qualifying_time_50m_sec\n' +
      '2026,group_5,Female,Freestyle,50,38.00\n' +
      '2026,group_5,Male,Freestyle,50,36.80\n' +
      '2026,group_4,Female,Freestyle,50,32.80\n' +
      '2026,group_4,Male,Freestyle,50,31.50\n' +
      '2026,group_3,Male,Freestyle,100,62.50\n' +
      '2026,group_4,Male,Breaststroke,50,41.00\n';
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'TSA_Standards_50m_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportingCsv(true);
    setCsvImportMsg(null);
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
      const dataLines = lines.slice(1);
      const rowsToInsert: Omit<TSAStandard, 'id'>[] = [];

      for (const line of dataLines) {
        const cols = line.split(',').map((c) => c.trim());
        if (cols.length < 6) continue;
        const [yearStr, ageGroup, gender, stroke, distStr, time50Str] = cols;
        const dist = Number(distStr);
        const time50 = Number(time50Str);
        if (!dist || !time50) continue;

        rowsToInsert.push({
          course: '50m',
          age_group: ageGroup,
          gender,
          stroke,
          distance_m: dist,
          qualifying_time_sec: time50,
          is_official: true,
          source_notes: `TSA Official ${yearStr} (CSV)`,
        });

        const turns = dist / 50;
        const advantagePerTurn = TURN_ADVANTAGE_PER_50M[stroke] ?? 0.65;
        const time25 = Number((time50 - turns * advantagePerTurn).toFixed(2));

        rowsToInsert.push({
          course: '25m',
          age_group: ageGroup,
          gender,
          stroke,
          distance_m: dist,
          qualifying_time_sec: time25,
          is_official: false,
          source_notes: `Auto-Converted 25m (-${(turns * advantagePerTurn).toFixed(2)}s)`,
        });
      }

      if (rowsToInsert.length === 0) throw new Error('Invalid CSV format');

      const payloadWithYear = rowsToInsert.map((r) => ({ ...r, season_year: 2026 }));
      const { error } = await supabase.from('tsa_standards').insert(payloadWithYear);
      if (error) throw error;

      setCsvImportMsg(`Imported ${rowsToInsert.length / 2} 50m events + ${rowsToInsert.length / 2} auto-converted 25m events!`);
      await fetchAllData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setImportingCsv(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleExportHistoryCsv = () => {
    const visibleLogs =
      currentUser?.role === 'coach'
        ? allWorkoutLogs
        : allWorkoutLogs.filter((l) => l.athlete_id === currentUser?.athleteId);

    const header = 'Date,Athlete,Nickname,Group,Duration(min),sRPE,SessionLoad(AU)\n';
    const body = visibleLogs
      .map((log) => {
        const ath = athletes.find((a) => a.id === log.athlete_id);
        return [
          log.workout_date,
          `"${ath?.full_name || '-'}"`,
          `"${ath?.nickname || '-'}"`,
          `"${AGE_GROUP_LABELS[ath?.age_group || ''] || ath?.age_group || '-'}"`,
          log.duration_minutes,
          log.srpe,
          log.session_load_au,
        ].join(',');
      })
      .join('\n');

    const blob = new Blob(['\uFEFF' + header + body], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ApexAqua_History_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
      alert(err instanceof Error ? err.message : String(err));
    }
  };

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
      alert('PDPA Digital E-Consent Signed!');
      await fetchAllData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  // --- Workout Builder Helpers ---
  const handleAddGroup = () => {
    const newGrp: WorkoutGroup = {
      id: `grp-${Date.now()}`,
      category: groups.length === 1 ? 'Pre-set' : groups.length === 2 ? 'Main Set' : 'Cool-down',
      rounds: 1,
      restBetweenRounds: 30,
      items: [{ id: `itm-${Date.now()}`, reps: 4, distance: 50, stroke: 'Freestyle', restSec: 20 }],
    };
    setGroups([...groups, newGrp]);
  };

  const handleDeleteGroup = (groupId: string) => {
    if (groups.length <= 1) return;
    setGroups(groups.filter((g) => g.id !== groupId));
  };

  const handleAddItemToGroup = (groupId: string) => {
    setGroups(
      groups.map((g) =>
        g.id === groupId
          ? {
              ...g,
              items: [
                ...g.items,
                { id: `itm-${Date.now()}`, reps: 4, distance: 50, stroke: 'Freestyle', restSec: 15 },
              ],
            }
          : g
      )
    );
  };

  const handleDeleteItemFromGroup = (groupId: string, itemId: string) => {
    setGroups(
      groups.map((g) => {
        if (g.id !== groupId || g.items.length <= 1) return g;
        return { ...g, items: g.items.filter((it) => it.id !== itemId) };
      })
    );
  };

  const classifyZone = (cat: string, dist: number, rest: number) => {
    if (cat === 'Warm-up' || cat === 'Cool-down')
      return { code: 'REC', label: 'Recovery', color: 'text-emerald-500 border-emerald-500/40 bg-emerald-500/10', mult: 1.3 };
    if (dist <= 25 && rest >= 30)
      return { code: 'SP3', label: 'Alactic Speed', color: 'text-rose-500 border-rose-500/40 bg-rose-500/10', mult: 0.85 };
    if (dist <= 50 && rest >= 60)
      return { code: 'SP2', label: 'Lactate Prod.', color: 'text-orange-500 border-orange-500/40 bg-orange-500/10', mult: 0.90 };
    if (dist <= 100 && rest >= 45)
      return { code: 'SP1', label: 'Lactate Tol.', color: 'text-amber-500 border-amber-500/40 bg-amber-500/10', mult: 0.95 };
    if (dist <= 200 && rest >= 20)
      return { code: 'EN3', label: 'VO2max', color: 'text-purple-500 border-purple-500/40 bg-purple-500/10', mult: 0.98 };
    if (dist >= 100 && rest >= 10 && rest <= 20)
      return { code: 'EN2', label: 'Threshold (AT)', color: 'text-cyan-500 border-cyan-500/40 bg-cyan-500/10', mult: 1.02 };
    return { code: 'EN1', label: 'Basic Aerobic', color: 'text-blue-500 border-blue-500/40 bg-blue-500/10', mult: 1.12 };
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
      setWorkoutMsg(`Saved "${workoutTitle}" (${totalWorkoutDist.toLocaleString()} m)!`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingWorkout(false);
    }
  };

  // ============================================================================
  // VIEW 1: LOGIN SCREEN (Responsive Split-Screen & Enlarged Field UI)
  // ============================================================================
  if (!currentUser) {
    return (
      <div className={`min-h-screen ${bgPage} flex flex-col items-center justify-center p-4 md:p-8 transition-colors`}>
        {/* Top Controls on Login Page */}
        <div className="absolute top-4 right-4 z-20">{renderControlsBar()}</div>

        <div className={`w-full max-w-5xl border rounded-3xl grid grid-cols-1 lg:grid-cols-12 overflow-hidden shadow-2xl ${bgCard}`}>
          {/* Left Hero Column */}
          <div className="lg:col-span-5 bg-gradient-to-br from-cyan-900/40 via-slate-900 to-blue-950/40 p-8 md:p-10 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800">
            <div className="space-y-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-xl">
                <Waves className="h-8 w-8" />
              </div>
              <h1 className={`text-3xl md:text-4xl font-black tracking-tight ${textMain}`}>ApexAqua</h1>
              <p className={`text-sm md:text-base leading-relaxed ${textMuted}`}>{t.subtitle}</p>
            </div>

            <div className="space-y-3 pt-6">
              <div className="flex items-center gap-3 text-xs md:text-sm text-cyan-400 font-semibold">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <span>USA Swimming Energy Zones & ACWR Analytics</span>
              </div>
              <div className="flex items-center gap-3 text-xs md:text-sm text-cyan-400 font-semibold">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <span>Optimized Large Touch Targets for Poolside Operations</span>
              </div>
            </div>
          </div>

          {/* Right Form Column */}
          <div className="lg:col-span-7 p-8 md:p-10 space-y-6 flex flex-col justify-center">
            <div className={`grid grid-cols-3 gap-2 p-1.5 rounded-2xl border text-xs md:text-sm font-bold ${bgSubCard}`}>
              <button
                type="button"
                onClick={() => { setLoginTab('coach'); setLoginError(''); }}
                className={`py-3 rounded-xl transition-all ${loginTab === 'coach' ? 'bg-cyan-600 text-white shadow-md' : textMuted}`}
              >
                {t.roleCoach}
              </button>
              <button
                type="button"
                onClick={() => { setLoginTab('parent'); setLoginError(''); }}
                className={`py-3 rounded-xl transition-all ${loginTab === 'parent' ? 'bg-emerald-600 text-white shadow-md' : textMuted}`}
              >
                {t.roleParent}
              </button>
              <button
                type="button"
                onClick={() => { setLoginTab('athlete'); setLoginError(''); }}
                className={`py-3 rounded-xl transition-all ${loginTab === 'athlete' ? 'bg-blue-600 text-white shadow-md' : textMuted}`}
              >
                {t.roleAthlete}
              </button>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              {loginTab === 'athlete' ? (
                <>
                  <div>
                    <label className={`block text-sm font-bold mb-2 ${textMain}`}>{t.selectAthlete}</label>
                    <select
                      value={selectedAthleteLoginId}
                      onChange={(e) => setSelectedAthleteLoginId(e.target.value)}
                      className={`w-full border rounded-xl px-4 py-3.5 text-base outline-none ${bgInput}`}
                    >
                      {athletes.length === 0 && <option value="">-- No Athletes --</option>}
                      {athletes.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.full_name} ({a.nickname})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={`block text-sm font-bold mb-2 ${textMain}`}>{t.pinLabel}</label>
                    <input
                      type="password"
                      maxLength={4}
                      placeholder="••••"
                      value={athletePinInput}
                      onChange={(e) => setAthletePinInput(e.target.value)}
                      className={`w-full border rounded-xl px-4 py-3.5 text-center tracking-widest text-xl font-mono outline-none ${bgInput}`}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-center gap-6 text-sm border-b border-slate-700/30 pb-3">
                    <button
                      type="button"
                      onClick={() => { setAuthMode('signin'); setLoginError(''); }}
                      className={`font-bold pb-1 ${authMode === 'signin' ? 'text-cyan-500 border-b-2 border-cyan-500' : textMuted}`}
                    >
                      {t.signIn}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAuthMode('signup'); setLoginError(''); }}
                      className={`font-bold pb-1 ${authMode === 'signup' ? 'text-emerald-500 border-b-2 border-emerald-500' : textMuted}`}
                    >
                      {t.signUp}
                    </button>
                  </div>

                  <div>
                    <label className={`block text-sm font-bold mb-1.5 ${textMain}`}>{t.emailLabel}</label>
                    <div className="relative">
                      <Mail className="h-5 w-5 text-slate-400 absolute left-4 top-4" />
                      <input
                        type="email"
                        required
                        placeholder="name@example.com"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        className={`w-full border rounded-xl pl-12 pr-4 py-3.5 text-base outline-none ${bgInput}`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block text-sm font-bold mb-1.5 ${textMain}`}>{t.passwordLabel}</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      placeholder="••••••"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      className={`w-full border rounded-xl px-4 py-3.5 text-base outline-none ${bgInput}`}
                    />
                  </div>
                </>
              )}

              {loginError && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-500 text-sm flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black text-base shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <Lock className="h-5 w-5" />
                <span>{authLoading ? '...' : t.loginBtn}</span>
              </button>
            </form>

            <div className={`pt-2 text-center text-xs ${textMuted}`}>
              {t.pdpaFooter}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // VIEW 2: PDPA CONSENT GATE
  // ============================================================================
  const currentAthleteObj = athletes.find((a) => a.id === currentUser.athleteId);
  if (currentUser.role === 'athlete' && currentAthleteObj && !currentAthleteObj.pdpa_signed) {
    return (
      <div className={`min-h-screen ${bgPage} flex items-center justify-center p-4`}>
        <div className={`max-w-md w-full border rounded-3xl p-8 text-center space-y-6 ${bgCard}`}>
          <div className="mx-auto h-16 w-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
            <ShieldCheck className="h-10 w-10" />
          </div>
          <h2 className={`text-2xl font-black ${textMain}`}>PDPA Parental Consent Required</h2>
          <p className={`text-sm leading-relaxed ${textMuted}`}>
            <b>{currentAthleteObj.nickname}</b>: Parent must sign Digital E-Consent under the Parent tab first.
          </p>
          <button
            onClick={handleLogout}
            className="w-full py-3.5 rounded-xl bg-cyan-600 text-sm font-bold text-white shadow-lg"
          >
            {t.logout}
          </button>
        </div>
      </div>
    );
  }

  // ============================================================================
  // VIEW 3: MAIN APPLICATION DASHBOARD (Full-Width Responsive & Enlarged Field Text)
  // ============================================================================
  const parentChildrenList =
    currentUser.role === 'parent' && currentUser.email
      ? athletes.filter((a) => a.parent_email && a.parent_email.toLowerCase() === currentUser.email)
      : [];

  const filteredPoolside =
    selectedLane === 'all' ? poolsideRows : poolsideRows.filter((r) => r.lane === selectedLane);

  const visibleAthletesForRole =
    currentUser.role === 'coach'
      ? athletes
      : currentUser.role === 'parent'
      ? parentChildrenList
      : athletes.filter((a) => a.id === currentUser.athleteId);

  const activeChildId =
    currentUser.role === 'parent' ? activeParentChildId : currentUser.athleteId;

  const visibleAcwrForRole =
    currentUser.role === 'coach'
      ? acwrList
      : acwrList.filter((item) => item.athlete.id === activeChildId);

  const visibleHistoryLogs =
    currentUser.role === 'coach'
      ? allWorkoutLogs
      : allWorkoutLogs.filter((l) => l.athlete_id === activeChildId);

  const selectedBenchmarkAthlete = athletes.find((a) => a.id === selectedBenchmarkAthleteId);
  const matchingStandards = tsaStandards.filter(
    (s) =>
      s.course === tsaCourse &&
      (!selectedBenchmarkAthlete ||
        (s.age_group === selectedBenchmarkAthlete.age_group &&
          s.gender === selectedBenchmarkAthlete.gender))
  );

  const canManageAthletes = currentUser.staffPermissions?.canManageAthletes ?? false;
  const canEditWorkouts = currentUser.staffPermissions?.canEditWorkouts ?? false;
  const isHeadCoach = currentUser.staffPermissions?.isHeadCoach ?? false;

  return (
    <div className={`min-h-screen ${bgPage} pb-24 transition-colors`}>
      {/* Top Navbar */}
      <header className={`sticky top-0 z-40 backdrop-blur border-b px-4 md:px-8 py-3.5 ${isLight ? 'bg-white/95 border-slate-200' : 'bg-slate-900/95 border-slate-800'}`}>
        <div className="max-w-[1440px] mx-auto flex flex-col gap-3.5">
          {/* Top Row: Logo + Theme & Language Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg">
                <Waves className="h-7 w-7" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <span className={`font-black text-xl tracking-tight ${textMain}`}>ApexAqua</span>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/30">
                    LIVE
                  </span>
                </div>
                <p className="text-xs text-cyan-500 font-bold">{currentUser.name}</p>
              </div>
            </div>

            {renderControlsBar()}
          </div>

          {/* Bottom Row: Navigation Tabs (Scrollable & Large Touch Targets for Poolside) */}
          <div className={`flex items-center gap-2 p-2 rounded-2xl border text-sm font-bold overflow-x-auto whitespace-nowrap scrollbar-none ${bgSubCard}`}>
            {currentUser.role === 'coach' && (
              <button
                onClick={() => setActiveTab('poolside')}
                className={`px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shrink-0 ${
                  activeTab === 'poolside' ? 'bg-cyan-600 text-white shadow-md' : textMuted
                }`}
              >
                <Timer className="h-4 w-4" /> {t.tabPoolside}
              </button>
            )}

            <button
              onClick={() => setActiveTab('readiness')}
              className={`px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shrink-0 ${
                activeTab === 'readiness' ? 'bg-cyan-600 text-white shadow-md' : textMuted
              }`}
            >
              <Heart className="h-4 w-4" /> {t.tabReadiness}
            </button>

            <button
              onClick={() => setActiveTab('acwr_tsa')}
              className={`px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shrink-0 ${
                activeTab === 'acwr_tsa' ? 'bg-cyan-600 text-white shadow-md' : textMuted
              }`}
            >
              <BarChart3 className="h-4 w-4" /> {t.tabAcwr}
            </button>

            {(currentUser.role === 'coach' || currentUser.role === 'parent') && (
              <button
                onClick={() => setActiveTab('pdpa')}
                className={`px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shrink-0 ${
                  activeTab === 'pdpa' ? 'bg-cyan-600 text-white shadow-md' : textMuted
                }`}
              >
                <ShieldCheck className="h-4 w-4" /> {t.tabPdpa}
              </button>
            )}

            {currentUser.role === 'coach' && (
              <button
                onClick={() => setActiveTab('builder')}
                className={`px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shrink-0 ${
                  activeTab === 'builder' ? 'bg-cyan-600 text-white shadow-md' : textMuted
                }`}
              >
                <Layers className="h-4 w-4" /> {t.tabBuilder}
              </button>
            )}

            {currentUser.role === 'coach' && isHeadCoach && (
              <button
                onClick={() => setActiveTab('staff')}
                className={`px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shrink-0 ${
                  activeTab === 'staff' ? 'bg-amber-600 text-white shadow-md' : 'text-amber-500 font-bold'
                }`}
              >
                <UserCog className="h-4 w-4" /> {t.tabStaff}
              </button>
            )}

            <button
              onClick={handleLogout}
              className="ml-auto px-4 py-2.5 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-600 hover:text-white flex items-center gap-1.5 transition-all shrink-0 font-bold"
            >
              <LogOut className="h-4 w-4" /> {t.logout}
            </button>
          </div>
        </div>
      </header>

      {/* PARENT FAMILY MULTI-CHILD SWITCHER BAR */}
      {currentUser.role === 'parent' && parentChildrenList.length > 0 && (
        <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-4 md:px-8 py-3">
          <div className="max-w-[1440px] mx-auto flex flex-wrap items-center gap-3 text-sm">
            <span className="text-emerald-600 dark:text-emerald-400 font-black flex items-center gap-2 mr-2">
              <Baby className="h-5 w-5" /> {t.childrenLabel} ({parentChildrenList.length}):
            </span>
            {parentChildrenList.map((child) => (
              <button
                key={child.id}
                onClick={() => handleSwitchParentChild(child.id)}
                className={`px-4 py-2 rounded-xl font-bold transition-all shadow-sm ${
                  activeParentChildId === child.id
                    ? 'bg-emerald-600 text-white shadow-md'
                    : `${bgCard} ${textMain} hover:border-emerald-500`
                }`}
              >
                {child.nickname || child.full_name}
              </button>
            ))}
          </div>
        </div>
      )}

      <main className="max-w-[1440px] mx-auto px-4 md:px-8 mt-4">
        {/* ==================================================================== */}
        {/* TAB 1: POOLSIDE & REAL ROSTER MANAGEMENT                             */}
        {/* ==================================================================== */}
        {activeTab === 'poolside' && currentUser.role === 'coach' && (
          <div className="space-y-5">
            <div className={`border rounded-3xl p-5 flex flex-wrap items-center justify-between gap-4 ${bgCard}`}>
              <div className="flex flex-wrap items-center gap-3">
                {canManageAthletes && (
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="px-5 py-3 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold flex items-center gap-2 shadow-xl transition-all"
                  >
                    <Plus className="h-5 w-5" /> {t.addAthleteBtn}
                  </button>
                )}

                <div className={`flex items-center gap-1.5 p-1.5 rounded-2xl border text-sm font-bold ml-2 ${bgSubCard}`}>
                  <Filter className="h-4 w-4 text-slate-400 ml-2.5 mr-1" />
                  <button
                    onClick={() => setSelectedLane('all')}
                    className={`px-3.5 py-2 rounded-xl transition-all ${selectedLane === 'all' ? 'bg-cyan-600 text-white shadow' : textMuted}`}
                  >
                    {t.allLanes} ({athletes.length})
                  </button>
                  {[1, 2, 3, 4].map((l) => (
                    <button
                      key={l}
                      onClick={() => setSelectedLane(l)}
                      className={`px-3.5 py-2 rounded-xl transition-all ${selectedLane === l ? 'bg-cyan-600 text-white shadow' : textMuted}`}
                    >
                      {t.lane} {l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-sm font-bold ${bgSubCard}`}>
                  <span className={textMuted}>{t.duration}:</span>
                  <input
                    type="number"
                    value={sessionDuration}
                    onChange={(e) => setSessionDuration(Number(e.target.value))}
                    className="w-14 bg-transparent text-center font-black text-cyan-500 outline-none text-base"
                  />
                  <span className={textMuted}>{t.mins}</span>
                </div>

                <button
                  onClick={handleSavePoolside}
                  disabled={savingPoolside || athletes.length === 0}
                  className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-black flex items-center gap-2 shadow-xl transition-all"
                >
                  <Save className="h-5 w-5" />
                  <span>{savingPoolside ? '...' : t.saveAllPool}</span>
                </button>
              </div>
            </div>

            {poolsideMsg && (
              <div className="p-4 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-500 text-sm font-bold flex items-center gap-2.5">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <span>{poolsideMsg.text}</span>
              </div>
            )}

            {!loadingData && athletes.length === 0 ? (
              <div className={`border-2 border-dashed rounded-3xl p-16 text-center space-y-4 ${bgCard}`}>
                <Users className="h-16 w-16 text-slate-400 mx-auto" />
                <h3 className={`text-xl font-bold ${textMain}`}>No Athletes Registered Yet</h3>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {filteredPoolside.map((row) => (
                  <div
                    key={row.id}
                    className={`border rounded-3xl p-5 flex flex-col justify-between gap-4 transition-all ${bgCard} ${
                      !row.attended && 'opacity-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3.5">
                        <button
                          onClick={() =>
                            setPoolsideRows((prev) =>
                              prev.map((p) => (p.id === row.id ? { ...p, attended: !p.attended } : p))
                            )
                          }
                          className={`h-11 w-11 rounded-2xl font-black text-base flex items-center justify-center shadow-md transition-all ${
                            row.attended ? 'bg-emerald-600 text-white shadow-emerald-600/30' : 'bg-slate-200 text-slate-500 dark:bg-slate-800'
                          }`}
                        >
                          ✓
                        </button>
                        <div>
                          <div className="flex items-center gap-2.5">
                            <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-500 border border-cyan-500/30">
                              {t.lane} {row.lane}
                            </span>
                            <span className={`font-black text-base md:text-lg ${textMain}`}>
                              {row.full_name} ({row.nickname})
                            </span>
                          </div>
                          <div className={`flex flex-wrap items-center gap-2.5 text-xs mt-1 ${textMuted}`}>
                            <span>{AGE_GROUP_LABELS[row.age_group] || row.age_group}</span>
                            <span>• PIN: {row.pin_code}</span>
                            {row.parent_email && <span className="text-cyan-500">• {row.parent_email}</span>}
                            {row.pdpa_signed ? (
                              <span className="text-emerald-500 font-black">• PDPA ✓</span>
                            ) : (
                              <span className="text-amber-500 font-bold">• Pending PDPA</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {canManageAthletes && (
                        <button
                          onClick={() => handleDeleteAthlete(row.id, row.full_name)}
                          className="p-2.5 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      )}
                    </div>

                    {/* sRPE Scale Buttons (Enlarged for Field Taps) */}
                    <div className="space-y-2 pt-2 border-t border-slate-700/20">
                      <div className="flex justify-between text-sm">
                        <span className={textMuted}>
                          {t.srpeLabel}: <b className="text-cyan-500 font-black text-base">{row.attended ? `${row.srpe}/10` : '-'}</b>
                        </span>
                        <span className="font-black text-amber-500 text-base">
                          Session Load: {row.attended ? row.srpe * sessionDuration : 0} AU
                        </span>
                      </div>
                      <div className="grid grid-cols-11 gap-1.5">
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                          <button
                            key={num}
                            disabled={!row.attended}
                            onClick={() =>
                              setPoolsideRows((prev) =>
                                prev.map((p) => (p.id === row.id ? { ...p, srpe: num } : p))
                              )
                            }
                            className={`h-11 rounded-xl text-xs md:text-sm font-black transition-all shadow-sm ${
                              row.srpe === num && row.attended
                                ? num >= 8
                                  ? 'bg-rose-600 text-white ring-2 ring-rose-400'
                                  : num >= 5
                                  ? 'bg-amber-500 text-white ring-2 ring-amber-300'
                                  : 'bg-cyan-600 text-white ring-2 ring-cyan-300'
                                : isLight
                                ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            }`}
                          >
                            {num}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add Athlete Modal */}
            {showAddModal && (
              <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
                <div className={`border rounded-3xl max-w-lg w-full p-8 space-y-5 shadow-2xl ${bgCard}`}>
                  <h3 className={`text-xl font-black ${textMain}`}>{t.addAthleteBtn}</h3>
                  <form onSubmit={handleAddAthlete} className="space-y-4 text-sm">
                    <div>
                      <label className={`block mb-1.5 font-bold ${textMuted}`}>Full Name *</label>
                      <input
                        required
                        type="text"
                        value={newAthlete.full_name}
                        onChange={(e) => setNewAthlete({ ...newAthlete, full_name: e.target.value })}
                        className={`w-full border rounded-xl px-4 py-3 ${bgInput}`}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={`block mb-1.5 font-bold ${textMuted}`}>Nickname</label>
                        <input
                          type="text"
                          value={newAthlete.nickname}
                          onChange={(e) => setNewAthlete({ ...newAthlete, nickname: e.target.value })}
                          className={`w-full border rounded-xl px-4 py-3 ${bgInput}`}
                        />
                      </div>
                      <div>
                        <label className={`block mb-1.5 font-bold ${textMuted}`}>Gender</label>
                        <select
                          value={newAthlete.gender}
                          onChange={(e) =>
                            setNewAthlete({ ...newAthlete, gender: e.target.value as 'Male' | 'Female' })
                          }
                          className={`w-full border rounded-xl px-4 py-3 ${bgInput}`}
                        >
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={`block mb-1.5 font-bold ${textMuted}`}>Age Group</label>
                        <select
                          value={newAthlete.age_group}
                          onChange={(e) => setNewAthlete({ ...newAthlete, age_group: e.target.value })}
                          className={`w-full border rounded-xl px-4 py-3 ${bgInput}`}
                        >
                          {Object.entries(AGE_GROUP_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={`block mb-1.5 font-bold ${textMuted}`}>{t.lane}</label>
                        <select
                          value={newAthlete.lane}
                          onChange={(e) => setNewAthlete({ ...newAthlete, lane: Number(e.target.value) })}
                          className={`w-full border rounded-xl px-4 py-3 ${bgInput}`}
                        >
                          {[1, 2, 3, 4, 5, 6].map((l) => (
                            <option key={l} value={l}>
                              {t.lane} {l}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={`block mb-1.5 font-bold ${textMuted}`}>Parent Name</label>
                        <input
                          type="text"
                          value={newAthlete.parent_name}
                          onChange={(e) => setNewAthlete({ ...newAthlete, parent_name: e.target.value })}
                          className={`w-full border rounded-xl px-4 py-3 ${bgInput}`}
                        />
                      </div>
                      <div>
                        <label className={`block mb-1.5 font-bold ${textMuted}`}>Athlete PIN (4 Digits)</label>
                        <input
                          type="text"
                          maxLength={4}
                          value={newAthlete.pin_code}
                          onChange={(e) => setNewAthlete({ ...newAthlete, pin_code: e.target.value })}
                          className={`w-full border rounded-xl px-4 py-3 font-mono text-center text-lg ${bgInput}`}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-cyan-500 font-bold mb-1.5">Parent Email (Family Account) *</label>
                      <input
                        required
                        type="email"
                        placeholder="parent@example.com"
                        value={newAthlete.parent_email}
                        onChange={(e) => setNewAthlete({ ...newAthlete, parent_email: e.target.value })}
                        className={`w-full border rounded-xl px-4 py-3 ${bgInput}`}
                      />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                      <button
                        type="button"
                        onClick={() => setShowAddModal(false)}
                        className="px-5 py-3 rounded-xl bg-slate-200 text-slate-800 font-bold hover:bg-slate-300"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={addingAthlete}
                        className="px-6 py-3 rounded-xl bg-cyan-600 text-white font-bold hover:bg-cyan-500 shadow-lg"
                      >
                        Save Athlete
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
            className={`max-w-3xl mx-auto border rounded-3xl p-8 space-y-6 ${bgCard}`}
          >
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-cyan-500">
                Pre-Training Readiness
              </span>
              <h2 className={`text-2xl font-black mt-1 ${textMain}`}>{t.readinessTitle}</h2>
            </div>

            <div>
              <label className={`block text-sm font-bold mb-2 ${textMain}`}>{t.selectAthlete}</label>
              <select
                value={readinessAthleteId}
                onChange={(e) => setReadinessAthleteId(e.target.value)}
                disabled={currentUser.role !== 'coach'}
                className={`w-full border rounded-xl px-4 py-3.5 text-base ${bgInput}`}
              >
                {visibleAthletesForRole.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.full_name} ({a.nickname})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className={`p-5 rounded-2xl border ${bgSubCard}`}>
                <div className="flex justify-between text-sm mb-3">
                  <span className={textMuted}>{t.rhrLabel}</span>
                  <span className="font-black text-rose-500 text-lg">{rhr} bpm</span>
                </div>
                <input
                  type="range"
                  min={40}
                  max={110}
                  value={rhr}
                  onChange={(e) => setRhr(Number(e.target.value))}
                  className="w-full accent-rose-500 h-2.5 cursor-pointer"
                />
              </div>

              <div className={`p-5 rounded-2xl border ${bgSubCard}`}>
                <div className="flex justify-between text-sm mb-3">
                  <span className={textMuted}>{t.sleepLabel}</span>
                  <span className="font-black text-cyan-500 text-lg">
                    {sleepHours} {t.hrs}
                  </span>
                </div>
                <input
                  type="range"
                  min={4}
                  max={12}
                  step={0.5}
                  value={sleepHours}
                  onChange={(e) => setSleepHours(Number(e.target.value))}
                  className="w-full accent-cyan-500 h-2.5 cursor-pointer"
                />
              </div>
            </div>

            <div className="space-y-3">
              <span className={`text-sm font-black block ${textMain}`}>{t.sorenessTitle}</span>
              {(
                [
                  { key: 'shoulder', label: '1. Shoulder (Rotator Cuff)' },
                  { key: 'lat', label: '2. Back / Latissimus Dorsi' },
                  { key: 'core', label: '3. Core & Lower Back' },
                  { key: 'knee', label: '4. Knee & Adductors' },
                  { key: 'ankle', label: '5. Ankle & Calves' },
                ] as const
              ).map((part) => (
                <div
                  key={part.key}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between px-5 py-3.5 rounded-2xl border gap-3 ${bgSubCard}`}
                >
                  <span className={`text-sm font-bold ${textMain}`}>{part.label}</span>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <button
                        type="button"
                        key={lvl}
                        onClick={() => setSoreness({ ...soreness, [part.key]: lvl })}
                        className={`h-11 w-11 rounded-xl text-sm font-black transition-all shadow-sm ${
                          soreness[part.key] === lvl
                            ? lvl >= 4
                              ? 'bg-rose-600 text-white ring-2 ring-rose-400'
                              : lvl === 3
                              ? 'bg-amber-500 text-white ring-2 ring-amber-300'
                              : 'bg-emerald-600 text-white ring-2 ring-emerald-300'
                            : isLight
                            ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
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
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-500 text-sm font-bold">
                {readinessMsg.text}
              </div>
            )}

            <button
              type="submit"
              disabled={savingReadiness || visibleAthletesForRole.length === 0}
              className="w-full py-4 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white font-black text-base shadow-xl transition-all"
            >
              {savingReadiness ? '...' : t.submitReadiness}
            </button>
          </form>
        )}

        {/* ==================================================================== */}
        {/* TAB 3: ACWR, HISTORY EXPORT & TSA BENCHMARK                          */}
        {/* ==================================================================== */}
        {activeTab === 'acwr_tsa' && (
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-black uppercase text-amber-500 tracking-wider">
                    Real-time Workload & Injury Prevention
                  </span>
                  <h2 className={`text-2xl font-black mt-0.5 ${textMain}`}>{t.acwrTitle}</h2>
                </div>
                <button
                  onClick={fetchAllData}
                  className={`px-4 py-2.5 rounded-2xl border text-sm font-bold text-cyan-500 flex items-center gap-2 shadow-sm ${bgCard}`}
                >
                  <RefreshCw className="h-4 w-4" /> {t.refreshBtn}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {visibleAcwrForRole.map((item) => {
                  const isDanger = item.acwr >= 1.5;
                  const isWarn = item.acwr >= 1.31 && item.acwr < 1.5;
                  return (
                    <div
                      key={item.athlete.id}
                      className={`border rounded-3xl p-6 space-y-4 ${bgCard} ${
                        isDanger ? 'border-rose-500 ring-1 ring-rose-500' : isWarn ? 'border-amber-500 ring-1 ring-amber-500' : ''
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className={`font-black text-lg ${textMain}`}>
                            {item.athlete.full_name} ({item.athlete.nickname})
                          </h3>
                          <span className={`text-xs ${textMuted}`}>28d Sessions: {item.sessionCount28d}</span>
                        </div>
                        <div className="text-right">
                          <span
                            className={`text-3xl font-black ${
                              isDanger ? 'text-rose-500' : isWarn ? 'text-amber-500' : 'text-emerald-500'
                            }`}
                          >
                            {item.acwr.toFixed(2)}
                          </span>
                          <span className={`block text-xs font-bold ${textMuted}`}>
                            {isDanger ? 'Danger Zone' : isWarn ? 'Early Warning' : 'Sweet Spot'}
                          </span>
                        </div>
                      </div>
                      <div className={`flex justify-between text-sm p-4 rounded-2xl border ${bgSubCard} ${textMuted}`}>
                        <span>Acute (7d): <b className="text-cyan-500 text-base">{item.acuteLoad} AU</b></span>
                        <span>Chronic (28d): <b className={`${textMain} text-base`}>{item.chronicLoad} AU</b></span>
                        <span>RHR: <b className="text-rose-500 text-base">{item.latestRhr ?? '-'} bpm</b></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Daily Training History Table */}
            <div className={`border rounded-3xl p-6 md:p-8 space-y-5 ${bgCard}`}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-black uppercase text-emerald-500 flex items-center gap-1.5 tracking-wider">
                    <Calendar className="h-4 w-4" /> Daily Training Audit Logs
                  </span>
                  <h2 className={`text-xl font-black mt-0.5 ${textMain}`}>{t.historyTitle}</h2>
                </div>
                <button
                  onClick={handleExportHistoryCsv}
                  disabled={visibleHistoryLogs.length === 0}
                  className="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-black flex items-center gap-2 shadow-lg transition-all"
                >
                  <Download className="h-5 w-5" /> {t.exportCsvBtn}
                </button>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-700/30">
                <table className="w-full text-left text-sm">
                  <thead className={`border-b border-slate-700/30 font-bold ${bgSubCard} ${textMuted}`}>
                    <tr>
                      <th className="py-4 px-5">Date</th>
                      <th className="py-4 px-5">Athlete</th>
                      <th className="py-4 px-5 text-center">{t.duration}</th>
                      <th className="py-4 px-5 text-center">sRPE</th>
                      <th className="py-4 px-5 text-right">Load (AU)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/20 font-medium">
                    {visibleHistoryLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className={`py-10 text-center ${textMuted}`}>
                          No training logs recorded yet.
                        </td>
                      </tr>
                    ) : (
                      visibleHistoryLogs.slice(0, 20).map((log) => {
                        const ath = athletes.find((a) => a.id === log.athlete_id);
                        return (
                          <tr key={log.id} className="hover:bg-slate-500/5 transition-colors">
                            <td className={`py-4 px-5 font-mono ${textMuted}`}>{log.workout_date}</td>
                            <td className={`py-4 px-5 font-bold ${textMain}`}>
                              {ath ? `${ath.full_name} (${ath.nickname})` : '-'}
                            </td>
                            <td className={`py-4 px-5 text-center ${textMuted}`}>{log.duration_minutes}</td>
                            <td className="py-4 px-5 text-center">
                              <span className="px-3 py-1 rounded-lg bg-cyan-500/10 text-cyan-500 font-bold text-xs md:text-sm">
                                {log.srpe} / 10
                              </span>
                            </td>
                            <td className="py-4 px-5 text-right font-black text-amber-500 text-base">
                              {log.session_load_au} AU
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* TSA Benchmark 50m / 25m + CSV Import */}
            <div className={`border rounded-3xl p-6 md:p-8 space-y-6 ${bgCard}`}>
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-700/20 pb-5">
                <div>
                  <span className="text-xs font-black uppercase text-cyan-500 flex items-center gap-1.5 tracking-wider">
                    <Trophy className="h-4 w-4" /> TSA Benchmark 2026
                  </span>
                  <h2 className={`text-2xl font-black mt-1 ${textMain}`}>{t.tsaTitle}</h2>
                </div>

                {currentUser.role === 'coach' && (
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={handleDownloadSampleCsv}
                      className={`px-4 py-2.5 rounded-xl border text-sm font-bold flex items-center gap-2 ${bgSubCard} ${textMain}`}
                    >
                      <FileSpreadsheet className="h-4 w-4 text-emerald-500" /> {t.downloadTemplate}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      onChange={handleCsvUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={importingCsv}
                      onClick={() => fileInputRef.current?.click()}
                      className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold flex items-center gap-2 shadow-lg"
                    >
                      <Upload className="h-4 w-4" />
                      <span>{importingCsv ? '...' : t.uploadCsv}</span>
                    </button>
                  </div>
                )}
              </div>

              {csvImportMsg && (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-500 text-sm font-bold">
                  {csvImportMsg}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-4">
                <select
                  value={selectedBenchmarkAthleteId}
                  onChange={(e) => setSelectedBenchmarkAthleteId(e.target.value)}
                  disabled={currentUser.role !== 'coach'}
                  className={`border rounded-xl px-4 py-3 text-sm font-bold ${bgInput}`}
                >
                  {visibleAthletesForRole.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.full_name} ({AGE_GROUP_LABELS[a.age_group]})
                    </option>
                  ))}
                </select>

                <div className={`flex p-1.5 rounded-2xl border text-sm font-bold ${bgSubCard}`}>
                  <button
                    onClick={() => setTsaCourse('50m')}
                    className={`px-4 py-2 rounded-xl transition-all ${tsaCourse === '50m' ? 'bg-cyan-600 text-white shadow' : textMuted}`}
                  >
                    {t.course50}
                  </button>
                  <button
                    onClick={() => setTsaCourse('25m')}
                    className={`px-4 py-2 rounded-xl transition-all ${tsaCourse === '25m' ? 'bg-cyan-600 text-white shadow' : textMuted}`}
                  >
                    {t.course25}
                  </button>
                </div>
              </div>

              <form
                onSubmit={handleAddCompTime}
                className={`grid grid-cols-1 sm:grid-cols-5 gap-3 p-4 rounded-2xl border text-sm ${bgSubCard}`}
              >
                <input
                  type="text"
                  placeholder="Meet Name"
                  value={newComp.meet_name}
                  onChange={(e) => setNewComp({ ...newComp, meet_name: e.target.value })}
                  className={`border rounded-xl px-4 py-3 ${bgInput}`}
                />
                <select
                  value={newComp.stroke}
                  onChange={(e) => setNewComp({ ...newComp, stroke: e.target.value })}
                  className={`border rounded-xl px-4 py-3 ${bgInput}`}
                >
                  <option value="Freestyle">Freestyle</option>
                  <option value="Backstroke">Backstroke</option>
                  <option value="Breaststroke">Breaststroke</option>
                  <option value="Butterfly">Butterfly</option>
                </select>
                <select
                  value={newComp.distance_m}
                  onChange={(e) => setNewComp({ ...newComp, distance_m: Number(e.target.value) })}
                  className={`border rounded-xl px-4 py-3 ${bgInput}`}
                >
                  <option value={50}>50m</option>
                  <option value={100}>100m</option>
                  <option value={200}>200m</option>
                </select>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="Seconds (e.g. 31.20)"
                  value={newComp.official_time_sec}
                  onChange={(e) => setNewComp({ ...newComp, official_time_sec: e.target.value })}
                  className={`border rounded-xl px-4 py-3 ${bgInput}`}
                />
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl py-3 px-4 shadow-md transition-all"
                >
                  {t.addPbBtn}
                </button>
              </form>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
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
                    <div key={std.id} className={`border rounded-3xl p-5 space-y-4 ${bgSubCard}`}>
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h4 className={`font-black text-base ${textMain}`}>
                            {std.stroke} {std.distance_m}m ({std.course})
                          </h4>
                          <span className="text-xs text-cyan-500">{std.source_notes}</span>
                        </div>
                        {delta !== null && (
                          <span
                            className={`text-xs font-black px-3 py-1 rounded-full shrink-0 ${
                              delta <= 0
                                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/40'
                                : 'bg-amber-500/10 text-amber-500 border border-amber-500/40'
                            }`}
                          >
                            {delta <= 0 ? `Qualified (${delta}s)` : `+${delta}s`}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-center text-sm">
                        <div className={`p-3.5 rounded-2xl border ${bgCard}`}>
                          <span className={`block text-xs font-bold mb-1 ${textMuted}`}>Current PB</span>
                          <b className="text-lg font-mono text-cyan-500 font-black">
                            {formatSecondsToSwimTime(bestPb)}
                          </b>
                        </div>
                        <div className={`p-3.5 rounded-2xl border ${bgCard}`}>
                          <span className={`block text-xs font-bold mb-1 ${textMuted}`}>TSA Target</span>
                          <b className={`text-lg font-mono font-black ${textMain}`}>
                            {formatSecondsToSwimTime(std.qualifying_time_sec)}
                          </b>
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
            <div className={`border rounded-3xl p-8 space-y-6 ${bgCard}`}>
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500 shadow-sm">
                  <FileSignature className="h-8 w-8" />
                </div>
                <div>
                  <h2 className={`text-2xl font-black ${textMain}`}>{t.pdpaTitle}</h2>
                </div>
              </div>

              <form onSubmit={handleSignPdpa} className="space-y-5 pt-2">
                <div>
                  <label className={`block text-sm font-bold mb-2 ${textMain}`}>{t.selectAthlete}</label>
                  <select
                    value={pdpaTargetAthleteId}
                    onChange={(e) => setPdpaTargetAthleteId(e.target.value)}
                    disabled={currentUser.role === 'parent'}
                    className={`w-full border rounded-xl px-4 py-3.5 text-base ${bgInput}`}
                  >
                    {visibleAthletesForRole.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.full_name} ({a.nickname}) - {a.pdpa_signed ? 'Signed ✓' : 'Pending'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={`border rounded-2xl p-5 text-sm space-y-3 leading-relaxed ${bgSubCard} ${textMuted}`}>
                  <p className="font-bold text-cyan-500 text-base">PDPA Youth Health Consent v2.2:</p>
                  <p>
                    1. Physiological readiness (RHR, sleep hours, muscle soreness) and training workload data are collected solely for athlete safety and performance planning.
                  </p>
                  <p>
                    2. All records are protected by Row Level Security (RLS) accessible only to authorized club coaches and the signing parent/guardian.
                  </p>
                </div>

                <div>
                  <label className={`block text-sm font-bold mb-2 ${textMain}`}>Parent / Legal Guardian Full Name *</label>
                  <input
                    required
                    type="text"
                    value={parentSignerName}
                    onChange={(e) => setParentSignerName(e.target.value)}
                    className={`w-full border rounded-xl px-4 py-3.5 text-base ${bgInput}`}
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-base shadow-xl transition-all"
                >
                  {t.signPdpaBtn}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 5: WORKOUT BUILDER                                               */}
        {/* ==================================================================== */}
        {activeTab === 'builder' && currentUser.role === 'coach' && (
          <div className="space-y-5">
            <div className={`border rounded-3xl p-6 md:p-8 space-y-5 ${bgCard}`}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-black uppercase text-cyan-500 tracking-wider">
                    Nested Sets & Auto-Zone Engine
                  </span>
                  <h2 className={`text-2xl font-black mt-1 ${textMain}`}>{t.builderTitle}</h2>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className={`border px-4 py-2.5 rounded-2xl text-sm font-bold ${bgSubCard}`}>
                    <span className={textMuted}>CSS 100m: </span>
                    <input
                      type="number"
                      value={css100m}
                      onChange={(e) => setCss100m(Number(e.target.value))}
                      className="w-14 bg-transparent text-center font-black text-cyan-500 outline-none text-base"
                    />
                    <span className={textMuted}>s</span>
                  </div>
                  {canEditWorkouts && (
                    <button
                      onClick={handleSaveWorkout}
                      disabled={savingWorkout}
                      className="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-black flex items-center gap-2 shadow-lg transition-all"
                    >
                      <Save className="h-5 w-5" /> {t.saveWorkoutBtn}
                    </button>
                  )}
                </div>
              </div>

              {workoutMsg && (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-500 text-sm font-bold">
                  {workoutMsg}
                </div>
              )}

              <div className={`grid grid-cols-1 md:grid-cols-2 gap-5 p-5 rounded-2xl border ${bgSubCard}`}>
                <div>
                  <label className={`text-xs font-bold block mb-1.5 ${textMuted}`}>Workout Title</label>
                  <input
                    type="text"
                    disabled={!canEditWorkouts}
                    value={workoutTitle}
                    onChange={(e) => setWorkoutTitle(e.target.value)}
                    className={`w-full border rounded-xl px-4 py-3 text-base font-bold ${bgInput}`}
                  />
                </div>
                <div className="flex items-center justify-between px-4">
                  <div>
                    <span className={`text-xs font-bold block mb-0.5 ${textMuted}`}>{t.totalDist}</span>
                    <span className="text-3xl font-black text-cyan-500">
                      {totalWorkoutDist.toLocaleString()} <span className="text-base font-bold">{t.meters}</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {groups.map((grp, gIdx) => (
              <div key={grp.id} className={`border rounded-3xl p-6 space-y-4 ${bgCard}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 text-sm font-bold">
                    <span className="h-8 w-8 rounded-full bg-cyan-500/10 text-cyan-500 font-black flex items-center justify-center text-base">
                      {gIdx + 1}
                    </span>
                    <select
                      disabled={!canEditWorkouts}
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
                      className={`border rounded-xl px-4 py-2.5 font-bold text-sm ${bgInput}`}
                    >
                      <option value="Warm-up">Warm-up</option>
                      <option value="Pre-set">Pre-set</option>
                      <option value="Main Set">Main Set</option>
                      <option value="Cool-down">Cool-down</option>
                    </select>
                    <span className={textMuted}>Rounds:</span>
                    <input
                      type="number"
                      min={1}
                      disabled={!canEditWorkouts}
                      value={grp.rounds}
                      onChange={(e) =>
                        setGroups(
                          groups.map((g) => (g.id === grp.id ? { ...g, rounds: Number(e.target.value) } : g))
                        )
                      }
                      className={`w-14 border rounded-xl py-2 text-center text-amber-500 font-black text-base ${bgInput}`}
                    />
                  </div>

                  {canEditWorkouts && (
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleAddItemToGroup(grp.id)}
                        className={`px-4 py-2.5 rounded-xl border text-cyan-500 text-sm font-bold flex items-center gap-1.5 shadow-sm ${bgSubCard}`}
                      >
                        <Plus className="h-4 w-4" /> + Item
                      </button>
                      {groups.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteGroup(grp.id)}
                          className="p-2.5 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-all"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  {grp.items.map((item) => {
                    const zone = classifyZone(grp.category, item.distance, item.restSec);
                    const interval = calcInterval(item.distance, item.restSec, zone.mult);
                    return (
                      <div
                        key={item.id}
                        className={`border rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-sm ${bgSubCard}`}
                      >
                        <div className="flex flex-wrap items-center gap-2.5 font-bold">
                          <input
                            type="number"
                            min={1}
                            disabled={!canEditWorkouts}
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
                            className={`w-14 border rounded-xl px-2 py-2 text-center font-black ${bgInput}`}
                          />
                          <span>×</span>
                          <select
                            disabled={!canEditWorkouts}
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
                            className={`border rounded-xl px-3 py-2 text-cyan-500 font-black ${bgInput}`}
                          >
                            {[25, 50, 100, 200, 400, 800].map((d) => (
                              <option key={d} value={d}>
                                {d}m
                              </option>
                            ))}
                          </select>
                          <select
                            disabled={!canEditWorkouts}
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
                            className={`border rounded-xl px-3 py-2 ${bgInput}`}
                          >
                            <option value="Freestyle">Freestyle</option>
                            <option value="Backstroke">Backstroke</option>
                            <option value="Breaststroke">Breaststroke</option>
                            <option value="Butterfly">Butterfly</option>
                            <option value="IM">IM</option>
                          </select>
                          <span className={textMuted}>Rest:</span>
                          <input
                            type="number"
                            disabled={!canEditWorkouts}
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
                            className={`w-16 border rounded-xl px-2 py-2 text-center text-amber-500 font-black ${bgInput}`}
                          />
                          <span className={textMuted}>s</span>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className={`px-3 py-1.5 rounded-xl border text-xs md:text-sm font-black ${zone.color}`}>
                            {zone.code} ({zone.label})
                          </span>
                          <span className={`px-3.5 py-1.5 rounded-xl border text-sm font-mono font-black text-cyan-500 ${bgCard}`}>
                            {interval}
                          </span>
                          {canEditWorkouts && grp.items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleDeleteItemFromGroup(grp.id, item.id)}
                              className="p-2 text-slate-400 hover:text-rose-500 transition-all"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {canEditWorkouts && (
              <button
                type="button"
                onClick={handleAddGroup}
                className={`w-full py-5 rounded-3xl border-2 border-dashed border-slate-400/50 hover:border-cyan-500 font-black text-sm flex items-center justify-center gap-2.5 transition-all ${textMuted} hover:text-cyan-500`}
              >
                <Plus className="h-5 w-5" /> {t.addGroupBtn}
              </button>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 6: STAFF MANAGEMENT                                              */}
        {/* ==================================================================== */}
        {activeTab === 'staff' && currentUser.role === 'coach' && isHeadCoach && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className={`border rounded-3xl p-8 space-y-6 ${bgCard}`}>
              <div>
                <span className="text-xs font-black uppercase text-amber-500 tracking-wider">Staff RBAC</span>
                <h2 className={`text-2xl font-black mt-1 ${textMain}`}>{t.staffTitle}</h2>
              </div>

              <form
                onSubmit={handleAddStaff}
                className={`grid grid-cols-1 md:grid-cols-4 gap-3.5 p-5 rounded-2xl border text-sm ${bgSubCard}`}
              >
                <input
                  type="text"
                  required
                  placeholder="Coach Name"
                  value={newStaff.full_name}
                  onChange={(e) => setNewStaff({ ...newStaff, full_name: e.target.value })}
                  className={`border rounded-xl px-4 py-3 ${bgInput}`}
                />
                <input
                  type="email"
                  required
                  placeholder="Email"
                  value={newStaff.email}
                  onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                  className={`border rounded-xl px-4 py-3 ${bgInput}`}
                />
                <select
                  value={newStaff.staff_role}
                  onChange={(e) =>
                    setNewStaff({
                      ...newStaff,
                      staff_role: e.target.value as 'head_coach' | 'assistant_coach',
                    })
                  }
                  className={`border rounded-xl px-4 py-3 ${bgInput}`}
                >
                  <option value="assistant_coach">Assistant Coach</option>
                  <option value="head_coach">Head Coach</option>
                </select>
                <button
                  type="submit"
                  className="bg-amber-600 hover:bg-amber-500 text-white font-black rounded-xl py-3 px-5 shadow-lg flex items-center justify-center gap-2"
                >
                  <Plus className="h-5 w-5" /> Add Staff
                </button>
              </form>

              <div className="space-y-3.5">
                {staffList.map((st) => (
                  <div
                    key={st.id}
                    className={`border rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4 text-sm ${bgSubCard}`}
                  >
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className={`font-black text-base ${textMain}`}>{st.full_name}</span>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-500/10 text-cyan-500 border border-cyan-500/30">
                          {st.staff_role}
                        </span>
                      </div>
                      <span className={`block mt-1 ${textMuted}`}>{st.email}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        disabled={st.staff_role === 'head_coach'}
                        onClick={() => handleToggleStaffPerm(st, 'can_edit_workouts')}
                        className={`px-4 py-2 rounded-xl font-bold border text-xs md:text-sm ${
                          st.can_edit_workouts
                            ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-500'
                            : `${bgCard} ${textMuted}`
                        }`}
                      >
                        {st.can_edit_workouts ? '✓ Edit Workouts' : '✕ View Only'}
                      </button>

                      <button
                        type="button"
                        disabled={st.staff_role === 'head_coach'}
                        onClick={() => handleToggleStaffPerm(st, 'can_manage_athletes')}
                        className={`px-4 py-2 rounded-xl font-bold border text-xs md:text-sm ${
                          st.can_manage_athletes
                            ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-500'
                            : `${bgCard} ${textMuted}`
                        }`}
                      >
                        {st.can_manage_athletes ? '✓ Manage Roster' : '✕ No Roster Edit'}
                      </button>

                      {st.staff_role !== 'head_coach' && (
                        <button
                          type="button"
                          onClick={() => handleDeleteStaff(st.id)}
                          className="p-2.5 rounded-xl text-slate-400 hover:text-rose-500 transition-all"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}