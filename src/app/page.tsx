'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Waves, Heart, ShieldCheck, CheckCircle2,
  BarChart3, Timer, Filter, Save, AlertCircle, Plus, Trash2,
  LogOut, Lock, FileSignature, Trophy, Users, RefreshCw, Layers,
  Upload, Download, FileSpreadsheet, Calendar, UserCog, Mail, Baby,
  Sun, Moon, Globe, Camera, Building2, HeartPulse, GraduationCap, IdCard
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

// --- Types & Interfaces ---
type UserRole = 'coach' | 'parent' | 'athlete';
type LangCode = 'th' | 'en' | 'zh';
type ThemeMode = 'dark' | 'light';

interface ClubInfo {
  id: string;
  name: string;
  club_code: string;
}

interface AthleteProfile {
  id: string;
  club_id: string;
  full_name: string;
  first_name_th: string;
  last_name_th: string;
  first_name_en: string;
  last_name_en: string;
  nickname: string;
  lane: number;
  age_group: string;
  gender: 'Male' | 'Female';
  athlete_code: string;
  student_id: string;
  national_id: string;
  school_name: string;
  grade_level: string;
  birth_date: string; // YYYY-MM-DD (ค.ศ.)
  blood_group: string;
  medical_conditions: string;
  avatar_url: string;
  pin_code: string;
  pdpa_signed: boolean;
  parent_name: string;
  parent_email: string;
}

interface StaffMember {
  id: string;
  club_id: string;
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
  club_id: string;
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
  club_id: string;
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

// --- Helper: คำนวณอายุอัตโนมัติตามปีปัจจุบัน และจัดกลุ่มอายุ TSA ---
function calculateDynamicAge(birthDateStr?: string): { ageYears: number; beYear: number; adYear: number; autoGroup: string } {
  if (!birthDateStr) return { ageYears: 10, beYear: 2559, adYear: 2016, autoGroup: 'group_4' };
  const dob = new Date(birthDateStr);
  if (isNaN(dob.getTime())) return { ageYears: 10, beYear: 2559, adYear: 2016, autoGroup: 'group_4' };

  const now = new Date();
  const currentAdYear = now.getFullYear();
  const adYear = dob.getFullYear();
  const beYear = adYear + 543;

  // คำนวณอายุตามปีเกิด (มาตรฐานการแบ่งรุ่นอายุแข่งขันว่ายน้ำ)
  const ageYears = Math.max(1, currentAdYear - adYear);

  let autoGroup = 'open';
  if (ageYears <= 9) autoGroup = 'group_5';
  else if (ageYears <= 11) autoGroup = 'group_4';
  else if (ageYears <= 13) autoGroup = 'group_3';
  else if (ageYears <= 15) autoGroup = 'group_2';
  else if (ageYears <= 18) autoGroup = 'group_1';

  return { ageYears, beYear, adYear, autoGroup };
}

function formatThaiBirthDate(birthDateStr?: string): string {
  if (!birthDateStr) return '-';
  const d = new Date(birthDateStr);
  if (isNaN(d.getTime())) return birthDateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const ad = d.getFullYear();
  const be = ad + 543;
  return `${day}/${month}/${ad} (พ.ศ. ${be})`;
}

// --- Multi-Language Dictionary ---
const I18N: Record<LangCode, Record<string, string>> = {
  th: {
    subtitle: 'ระบบบริหารและวิเคราะห์ศักยภาพนักกีฬาว่ายน้ำสโมสร (Multi-Club SaaS)',
    roleCoach: 'โค้ช / Staff',
    roleParent: 'ผู้ปกครอง',
    roleAthlete: 'นักกีฬา',
    signIn: 'เข้าสู่ระบบ (Sign In)',
    signUp: 'ลงทะเบียนสโมสรใหม่ (Sign Up)',
    clubNameLabel: 'ชื่อสโมสรว่ายน้ำของคุณ (สำหรับแยกฐานข้อมูลสโมสร)',
    emailLabel: 'อีเมลผู้ใช้งาน (Email)',
    passwordLabel: 'รหัสผ่าน (Password อย่างน้อย 6 ตัวอักษร)',
    selectAthlete: 'เลือกชื่อนักกีฬา',
    pinLabel: 'รหัส PIN ประจำตัว 4 หลัก',
    loginBtn: 'เข้าสู่ระบบ ApexAqua',
    pdpaFooter: 'แยกฐานข้อมูลรายสโมสร (club_id) และคุ้มครองข้อมูลสุขภาพเยาวชนตาม PDPA',
    tabPoolside: '1. คุมริมสระ & ประวัตินักกีฬา',
    tabReadiness: '2. เช็กอินเช้า',
    tabAcwr: '3. ACWR, ประวัติ & TSA',
    tabPdpa: '4. ครอบครัว & PDPA',
    tabBuilder: '5. จัดเซตซ้อม',
    tabStaff: '6. ทีมงานโค้ช',
    logout: 'ออก',
    dayMode: 'โหมดกลางวัน',
    nightMode: 'โหมดกลางคืน',
    childrenLabel: 'บุตรหลานในความดูแล',
    addAthleteBtn: 'ลงทะเบียนนักกีฬาใหม่ (ประวัติละเอียด)',
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
    addGroupBtn: 'เพิ่มกลุ่มเซตซ้อมใหม่ (Pre-set, Main Set, Cool-down)',
    staffTitle: 'จัดการสิทธิ์ทีมงานผู้ฝึกสอน (ผู้ช่วยโค้ช)',
  },
  en: {
    subtitle: 'Club Swimming Sports Science & Multi-Tenant SaaS Platform',
    roleCoach: 'Coach / Staff',
    roleParent: 'Parent',
    roleAthlete: 'Athlete',
    signIn: 'Sign In',
    signUp: 'Register New Club (Sign Up)',
    clubNameLabel: 'Swimming Club Name (Isolated Tenant DB)',
    emailLabel: 'Email Address',
    passwordLabel: 'Password (min. 6 characters)',
    selectAthlete: 'Select Athlete',
    pinLabel: '4-Digit Personal PIN',
    loginBtn: 'Sign In to ApexAqua',
    pdpaFooter: 'Strict club_id tenant isolation & PDPA compliant.',
    tabPoolside: '1. Poolside & Bio Roster',
    tabReadiness: '2. Readiness',
    tabAcwr: '3. ACWR & TSA',
    tabPdpa: '4. Family & PDPA',
    tabBuilder: '5. Workout Builder',
    tabStaff: '6. Staff RBAC',
    logout: 'Exit',
    dayMode: 'Day Mode',
    nightMode: 'Night Mode',
    childrenLabel: 'Children in Family Account',
    addAthleteBtn: 'Register New Athlete (Full Bio)',
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
    addGroupBtn: 'Add New Set Group (Pre-set, Main Set, Cool-down)',
    staffTitle: 'Coaching Staff & Permissions Management',
  },
  zh: {
    subtitle: '游泳俱乐部运动科学与多租户SaaS管理平台',
    roleCoach: '教练 / 管理',
    roleParent: '家长',
    roleAthlete: '运动员',
    signIn: '登录 (Sign In)',
    signUp: '注册新俱乐部 (Sign Up)',
    clubNameLabel: '游泳俱乐部名称 (独立数据库隔离)',
    emailLabel: '电子邮箱 (Email)',
    passwordLabel: '密码 (至少6位字符)',
    selectAthlete: '选择运动员姓名',
    pinLabel: '4位数个人PIN码',
    loginBtn: '进入 ApexAqua 系统',
    pdpaFooter: '严格按俱乐部(club_id)隔离数据并符合PDPA隐私保护法',
    tabPoolside: '1. 池边控制与完整档案',
    tabReadiness: '2. 晨间状态打卡',
    tabAcwr: '3. ACWR负荷与达标',
    tabPdpa: '4. 家庭与PDPA授权',
    tabBuilder: '5. 智能训练计划',
    tabStaff: '6. 教练团队权限',
    logout: '退出',
    dayMode: '日间模式',
    nightMode: '夜间模式',
    childrenLabel: '家庭关联运动员',
    addAthleteBtn: '注册正式运动员 (完整档案)',
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
    addGroupBtn: '添加新训练组 (热身 / 主项 / 放松)',
    staffTitle: '助理教练团队与权限管理',
  },
};

const AGE_GROUP_LABELS: Record<string, string> = {
  group_5: 'Group 5 (7–9 ปี)',
  group_4: 'Group 4 (10–11 ปี)',
  group_3: 'Group 3 (12–13 ปี)',
  group_2: 'Group 2 (14–15 ปี)',
  group_1: 'Group 1 (16–18 ปี)',
  open: 'Open (19+ ปี)',
};

const TURN_ADVANTAGE_PER_50M: Record<string, number> = {
  Freestyle: 0.65,
  Backstroke: 0.70,
  Breaststroke: 1.10,
  Butterfly: 0.75,
  IM: 0.85,
};

export default function ApexAquaMultiTenantApp() {
  // --- Theme & Language State ---
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [lang, setLang] = useState<LangCode>('th');
  const t = I18N[lang];
  const isLight = theme === 'light';

  const bgPage = isLight ? 'bg-slate-100 text-slate-900' : 'bg-slate-950 text-slate-100';
  const bgCard = isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900 border-slate-800 shadow-xl';
  const bgSubCard = isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800';
  const bgInput = isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-950 border-slate-700 text-white';
  const textMain = isLight ? 'text-slate-900' : 'text-white';
  const textMuted = isLight ? 'text-slate-500' : 'text-slate-400';

  // --- 1. Authentication & Strict Multi-Tenant Club State ---
  const [clubs, setClubs] = useState<ClubInfo[]>([]);
  const [currentUser, setCurrentUser] = useState<{
    role: UserRole;
    name: string;
    email?: string;
    clubId: string;
    clubName: string;
    athleteId?: string;
    staffPermissions?: {
      isHeadCoach: boolean;
      canEditWorkouts: boolean;
      canManageAthletes: boolean;
    };
  } | null>(null);

  const [loginTab, setLoginTab] = useState<UserRole>('coach');
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [newClubNameInput, setNewClubNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [selectedAthleteLoginId, setSelectedAthleteLoginId] = useState('');
  const [athletePinInput, setAthletePinInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [activeParentChildId, setActiveParentChildId] = useState<string>('');

  // --- 2. Core Data State (Filtered by club_id) ---
  const [allAthletesPublic, setAllAthletesPublic] = useState<AthleteProfile[]>([]);
  const [athletes, setAthletes] = useState<AthleteProfile[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState<'poolside' | 'readiness' | 'acwr_tsa' | 'pdpa' | 'builder' | 'staff'>('poolside');

  // --- 3. Add Comprehensive Athlete Modal State ---
  const [showAddModal, setShowAddModal] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [newAthlete, setNewAthlete] = useState({
    first_name_th: '',
    last_name_th: '',
    first_name_en: '',
    last_name_en: '',
    nickname: '',
    gender: 'Male' as 'Male' | 'Female',
    birth_date: '2016-01-01', // ค.ศ.
    be_year_input: '2559',     // พ.ศ. ซิงค์อัตโนมัติ
    athlete_code: '',
    student_id: '',
    national_id: '',
    school_name: '',
    grade_level: 'ป.4',
    blood_group: 'O',
    medical_conditions: '',
    avatar_url: '',
    lane: 1,
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

  // --- Initial Pre-Login Fetch (Clubs & Athlete Dropdown) ---
  const fetchPreLoginMeta = useCallback(async () => {
    const { data: clubData } = await supabase.from('clubs').select('*');
    setClubs((clubData || []) as ClubInfo[]);

    const { data: athData } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'athlete')
      .order('lane', { ascending: true });
    const athList = (athData || []) as AthleteProfile[];
    setAllAthletesPublic(athList);
    if (athList.length > 0 && !selectedAthleteLoginId) {
      setSelectedAthleteLoginId(athList[0].id);
    }
  }, [selectedAthleteLoginId]);

  useEffect(() => {
    fetchPreLoginMeta();
  }, [fetchPreLoginMeta]);

  // --- Strict Multi-Tenant Fetch (กรองตาม club_id ของผู้ใช้เท่านั้น เร็วและปลอดภัย 100%) ---
  const fetchTenantData = useCallback(async (targetClubId: string) => {
    if (!targetClubId) return;
    setLoadingData(true);
    try {
      // 1. ดึงเฉพาะนักกีฬาในสโมสรนี้ (club_id)
      const { data: profData, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'athlete')
        .eq('club_id', targetClubId)
        .order('lane', { ascending: true });

      if (profErr) throw profErr;
      const list = (profData || []) as AthleteProfile[];
      setAthletes(list);

      // 2. ดึงเฉพาะทีมงานโค้ชในสโมสรนี้
      const { data: staffData } = await supabase
        .from('club_staff')
        .select('*')
        .eq('club_id', targetClubId)
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
        setReadinessAthleteId((prev) => prev || list[0].id);
        setSelectedBenchmarkAthleteId((prev) => prev || list[0].id);
        setPdpaTargetAthleteId((prev) => prev || list[0].id);
      }

      // 3. ดึงประวัติการซ้อมเฉพาะของสโมสรนี้
      const twentyEightDaysAgo = new Date();
      twentyEightDaysAgo.setDate(twentyEightDaysAgo.getDate() - 28);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: logsData } = await supabase
        .from('workout_logs')
        .select('*')
        .eq('club_id', targetClubId)
        .order('workout_date', { ascending: false });

      const typedLogs = (logsData || []) as WorkoutLogRecord[];
      setAllWorkoutLogs(typedLogs);

      // 4. ดึงความพร้อมเช้าเฉพาะของสโมสรนี้
      const { data: readyData } = await supabase
        .from('daily_readiness')
        .select('*')
        .eq('club_id', targetClubId)
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

      // 5. เกณฑ์เวลา TSA (ใช้ร่วมกันทั้งประเทศ) + สถิติ PB ของสโมสรนี้
      const { data: tsaData } = await supabase.from('tsa_standards').select('*');
      setTsaStandards((tsaData || []) as TSAStandard[]);

      const { data: compData } = await supabase
        .from('competition_logs')
        .select('*')
        .eq('club_id', targetClubId)
        .order('official_time_sec', { ascending: true });
      setCompLogs((compData || []) as CompLog[]);
    } catch (err) {
      console.error('Error loading tenant data:', err);
    } finally {
      setLoadingData(false);
    }
  }, []);

  // --- Shared Theme & Language Switcher Bar ---
  const renderControlsBar = () => (
    <div className="flex items-center gap-2">
      <div className={`flex items-center rounded-xl border p-1 text-[11px] font-bold ${bgSubCard}`}>
        <Globe className="h-3.5 w-3.5 text-cyan-500 mx-1.5" />
        {(['th', 'en', 'zh'] as LangCode[]).map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => setLang(code)}
            className={`px-2 py-1 rounded-lg transition-all ${
              lang === code ? 'bg-cyan-600 text-white shadow' : `${textMuted} hover:text-cyan-500`
            }`}
          >
            {code === 'th' ? 'TH' : code === 'en' ? 'EN' : '中文'}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setTheme(isLight ? 'dark' : 'light')}
        className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all ${
          isLight
            ? 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100'
            : 'bg-slate-800 border-slate-700 text-amber-400 hover:bg-slate-700'
        }`}
      >
        {isLight ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
        <span className="hidden sm:inline">{isLight ? t.nightMode : t.dayMode}</span>
      </button>
    </div>
  );

  // --- Handlers: Multi-Tenant Login & Club Registration ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    // 1. Athlete PIN Login
    if (loginTab === 'athlete') {
      const ath = allAthletesPublic.find((a) => a.id === selectedAthleteLoginId);
      if (!ath) {
        setLoginError('ไม่พบข้อมูลนักกีฬา');
        return;
      }
      if (athletePinInput === ath.pin_code) {
        const clubObj = clubs.find((c) => c.id === ath.club_id);
        setCurrentUser({
          role: 'athlete',
          name: `${ath.full_name} (${ath.nickname})`,
          clubId: ath.club_id,
          clubName: clubObj?.name || 'Swimming Club',
          athleteId: ath.id,
        });
        setReadinessAthleteId(ath.id);
        setSelectedBenchmarkAthleteId(ath.id);
        setActiveTab('readiness');
        await fetchTenantData(ath.club_id);
      } else {
        setLoginError('รหัส PIN 4 หลักไม่ถูกต้อง');
      }
      return;
    }

    // 2. Coach & Parent Supabase Auth
    setAuthLoading(true);
    try {
      const cleanEmail = emailInput.trim().toLowerCase();
      if (!cleanEmail || !passwordInput) throw new Error('กรุณากรอกอีเมลและรหัสผ่าน');

      if (authMode === 'signup') {
        const { error: signUpErr } = await supabase.auth.signUp({
          email: cleanEmail,
          password: passwordInput,
        });
        if (signUpErr) throw signUpErr;

        // หากเป็นการลงทะเบียนโค้ชใหม่ -> สร้างสโมสรใหม่ (club_id เฉพาะตัว)
        if (loginTab === 'coach') {
          const clubTitle = newClubNameInput.trim() || `Club (${cleanEmail.split('@')[0]})`;
          const { data: createdClub, error: clubErr } = await supabase
            .from('clubs')
            .insert([{ name: clubTitle, club_code: `CLB-${Math.floor(1000 + Math.random() * 9000)}` }])
            .select()
            .single();
          if (clubErr) throw clubErr;

          await supabase.from('club_staff').insert([
            {
              club_id: createdClub.id,
              full_name: `Head Coach (${clubTitle})`,
              email: cleanEmail,
              staff_role: 'head_coach',
              can_edit_workouts: true,
              can_manage_athletes: true,
            },
          ]);

          setCurrentUser({
            role: 'coach',
            name: `Head Coach`,
            email: cleanEmail,
            clubId: createdClub.id,
            clubName: createdClub.name,
            staffPermissions: { isHeadCoach: true, canEditWorkouts: true, canManageAthletes: true },
          });
          setActiveTab('poolside');
          await fetchTenantData(createdClub.id);
          return;
        }
      } else {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: passwordInput,
        });
        if (signInErr) throw signInErr;
      }

      if (loginTab === 'coach') {
        const { data: staffRows } = await supabase
          .from('club_staff')
          .select('*')
          .eq('email', cleanEmail);
        const staffRecord = staffRows?.[0] as StaffMember | undefined;

        if (!staffRecord) {
          await supabase.auth.signOut();
          throw new Error('ไม่พบอีเมลนี้ในระบบทีมงานโค้ช (หากต้องการเปิดสโมสรใหม่ ให้กดแท็บ "ลงทะเบียนสโมสรใหม่")');
        }

        const { data: cData } = await supabase.from('clubs').select('*').eq('id', staffRecord.club_id).single();

        setCurrentUser({
          role: 'coach',
          name: staffRecord.full_name,
          email: cleanEmail,
          clubId: staffRecord.club_id,
          clubName: cData?.name || 'Swimming Club',
          staffPermissions: {
            isHeadCoach: staffRecord.staff_role === 'head_coach',
            canEditWorkouts: staffRecord.can_edit_workouts,
            canManageAthletes: staffRecord.can_manage_athletes,
          },
        });
        setActiveTab('poolside');
        await fetchTenantData(staffRecord.club_id);
      } else if (loginTab === 'parent') {
        const { data: childrenRows } = await supabase
          .from('profiles')
          .select('*')
          .eq('role', 'athlete')
          .eq('parent_email', cleanEmail);

        const myChildren = (childrenRows || []) as AthleteProfile[];
        if (myChildren.length === 0) {
          throw new Error('ไม่พบรายชื่อนักกีฬาที่ผูกกับอีเมลผู้ปกครองนี้ กรุณาแจ้งโค้ชให้ระบุอีเมลของคุณในประวัตินักกีฬา');
        }

        const firstChild = myChildren[0];
        const { data: cData } = await supabase.from('clubs').select('*').eq('id', firstChild.club_id).single();

        setActiveParentChildId(firstChild.id);
        setReadinessAthleteId(firstChild.id);
        setSelectedBenchmarkAthleteId(firstChild.id);
        setPdpaTargetAthleteId(firstChild.id);
        setParentSignerName(firstChild.parent_name || '');

        setCurrentUser({
          role: 'parent',
          name: `Parent (${cleanEmail})`,
          email: cleanEmail,
          clubId: firstChild.club_id,
          clubName: cData?.name || 'Swimming Club',
          athleteId: firstChild.id,
        });
        setActiveTab('pdpa');
        await fetchTenantData(firstChild.club_id);
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
    await fetchPreLoginMeta();
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

  // --- Photo Upload Handler (Supabase Storage) ---
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;
    setUploadingPhoto(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentUser.clubId}/${Date.now()}.${fileExt}`;
      const { error: uploadErr } = await supabase.storage
        .from('athlete-photos')
        .upload(fileName, file, { upsert: true });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from('athlete-photos').getPublicUrl(fileName);
      setNewAthlete((prev) => ({ ...prev, avatar_url: urlData.publicUrl }));
    } catch (err: unknown) {
      alert('อัปโหลดรูปภาพไม่สำเร็จ: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setUploadingPhoto(false);
    }
  };

  // --- Sync Birth Date ค.ศ. <-> พ.ศ. ---
  const handleAdDateChange = (adDateStr: string) => {
    const yearAd = Number(adDateStr.split('-')[0]);
    const yearBe = !isNaN(yearAd) && yearAd > 1900 ? String(yearAd + 543) : '';
    setNewAthlete((prev) => ({
      ...prev,
      birth_date: adDateStr,
      be_year_input: yearBe,
    }));
  };

  const handleBeYearChange = (beYearStr: string) => {
    const beNum = Number(beYearStr);
    let updatedDate = newAthlete.birth_date;
    if (!isNaN(beNum) && beNum > 2450 && beNum < 2650) {
      const adNum = beNum - 543;
      const parts = (newAthlete.birth_date || '2016-01-01').split('-');
      updatedDate = `${adNum}-${parts[1] || '01'}-${parts[2] || '01'}`;
    }
    setNewAthlete((prev) => ({
      ...prev,
      be_year_input: beYearStr,
      birth_date: updatedDate,
    }));
  };

  // --- Add / Delete Real Athlete (Comprehensive Bio + club_id) ---
  const handleAddAthlete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !newAthlete.first_name_th.trim()) return;
    setAddingAthlete(true);
    try {
      const fullNameTh = `${newAthlete.first_name_th.trim()} ${newAthlete.last_name_th.trim()}`.trim();
      const { autoGroup } = calculateDynamicAge(newAthlete.birth_date);
      const code = newAthlete.athlete_code.trim() || `ATH-${Math.floor(1000 + Math.random() * 9000)}`;

      const { error } = await supabase.from('profiles').insert([
        {
          club_id: currentUser.clubId,
          full_name: fullNameTh,
          first_name_th: newAthlete.first_name_th.trim(),
          last_name_th: newAthlete.last_name_th.trim(),
          first_name_en: newAthlete.first_name_en.trim(),
          last_name_en: newAthlete.last_name_en.trim(),
          nickname: newAthlete.nickname.trim() || newAthlete.first_name_th.trim(),
          role: 'athlete',
          lane: Number(newAthlete.lane),
          age_group: autoGroup,
          gender: newAthlete.gender,
          birth_date: newAthlete.birth_date,
          athlete_code: code,
          student_id: newAthlete.student_id.trim(),
          national_id: newAthlete.national_id.trim(),
          school_name: newAthlete.school_name.trim(),
          grade_level: newAthlete.grade_level.trim(),
          blood_group: newAthlete.blood_group,
          medical_conditions: newAthlete.medical_conditions.trim(),
          avatar_url: newAthlete.avatar_url,
          pin_code: newAthlete.pin_code || '1234',
          parent_name: newAthlete.parent_name.trim(),
          parent_email: newAthlete.parent_email.trim().toLowerCase(),
          pdpa_signed: false,
        },
      ]);
      if (error) throw error;

      setShowAddModal(false);
      setNewAthlete({
        first_name_th: '',
        last_name_th: '',
        first_name_en: '',
        last_name_en: '',
        nickname: '',
        gender: 'Male',
        birth_date: '2016-01-01',
        be_year_input: '2559',
        athlete_code: '',
        student_id: '',
        national_id: '',
        school_name: '',
        grade_level: 'ป.4',
        blood_group: 'O',
        medical_conditions: '',
        avatar_url: '',
        lane: 1,
        pin_code: '1234',
        parent_name: '',
        parent_email: '',
      });
      await fetchTenantData(currentUser.clubId);
      await fetchPreLoginMeta();
    } catch (err: unknown) {
      alert('บันทึกข้อมูลนักกีฬาไม่สำเร็จ: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setAddingAthlete(false);
    }
  };

  const handleDeleteAthlete = async (id: string, name: string) => {
    if (!currentUser || !confirm(`ยืนยันการลบข้อมูล "${name}"?`)) return;
    await supabase.from('profiles').delete().eq('id', id).eq('club_id', currentUser.clubId);
    await fetchTenantData(currentUser.clubId);
    await fetchPreLoginMeta();
  };

  // --- Staff Management Handlers ---
  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !newStaff.full_name.trim() || !newStaff.email.trim()) return;
    try {
      const { error } = await supabase.from('club_staff').insert([
        {
          club_id: currentUser.clubId,
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
      await fetchTenantData(currentUser.clubId);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleToggleStaffPerm = async (
    staff: StaffMember,
    field: 'can_edit_workouts' | 'can_manage_athletes'
  ) => {
    if (!currentUser) return;
    await supabase
      .from('club_staff')
      .update({ [field]: !staff[field] })
      .eq('id', staff.id);
    await fetchTenantData(currentUser.clubId);
  };

  const handleDeleteStaff = async (id: string) => {
    if (!currentUser || !confirm('Remove staff access?')) return;
    await supabase.from('club_staff').delete().eq('id', id);
    await fetchTenantData(currentUser.clubId);
  };

  // --- Poolside & Readiness Handlers ---
  const handleSavePoolside = async () => {
    if (!currentUser) return;
    const attendedRows = poolsideRows.filter((r) => r.attended);
    if (attendedRows.length === 0) return;
    setSavingPoolside(true);
    setPoolsideMsg(null);
    try {
      const payload = attendedRows.map((r) => ({
        club_id: currentUser.clubId,
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
        text: `บันทึกภาระงานจริงของนักกีฬา ${attendedRows.length} คน ลงฐานข้อมูลสโมสรเรียบร้อยแล้ว!`,
      });
      await fetchTenantData(currentUser.clubId);
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
    if (!currentUser || !readinessAthleteId) return;
    setSavingReadiness(true);
    setReadinessMsg(null);
    try {
      const { error } = await supabase.from('daily_readiness').insert([
        {
          club_id: currentUser.clubId,
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
      setReadinessMsg({ type: 'ok', text: 'บันทึกความพร้อมเช้าเรียบร้อยแล้ว!' });
      await fetchTenantData(currentUser.clubId);
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
    if (!file || !currentUser) return;
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
      await fetchTenantData(currentUser.clubId);
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

    const header = 'Date,AthleteCode,AthleteTH,AthleteEN,Nickname,Age,School,Duration(min),sRPE,SessionLoad(AU)\n';
    const body = visibleLogs
      .map((log) => {
        const ath = athletes.find((a) => a.id === log.athlete_id);
        const { ageYears } = calculateDynamicAge(ath?.birth_date);
        return [
          log.workout_date,
          `"${ath?.athlete_code || '-'}"`,
          `"${ath?.full_name || '-'}"`,
          `"${ath?.first_name_en || ''} ${ath?.last_name_en || ''}"`,
          `"${ath?.nickname || '-'}"`,
          ageYears,
          `"${ath?.school_name || '-'}"`,
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
    if (!currentUser || !selectedBenchmarkAthleteId || !newComp.official_time_sec) return;
    try {
      const { error } = await supabase.from('competition_logs').insert([
        {
          club_id: currentUser.clubId,
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
      await fetchTenantData(currentUser.clubId);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleSignPdpa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !pdpaTargetAthleteId || !parentSignerName.trim()) return;
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
      alert('ลงนามยินยอม PDPA Digital E-Consent สำเร็จ!');
      await fetchTenantData(currentUser.clubId);
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
    if (!currentUser) return;
    setSavingWorkout(true);
    setWorkoutMsg(null);
    try {
      const { error } = await supabase.from('workouts').insert([
        {
          club_id: currentUser.clubId,
          title: workoutTitle,
          total_distance_m: totalWorkoutDist,
          set_data: groups,
        },
      ]);
      if (error) throw error;
      setWorkoutMsg(`บันทึกโปรแกรม "${workoutTitle}" (${totalWorkoutDist.toLocaleString()} ม.) ลงฐานข้อมูลสโมสรสำเร็จ!`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingWorkout(false);
    }
  };

  // ============================================================================
  // VIEW 1: LOGIN & MULTI-TENANT CLUB REGISTRATION SCREEN
  // ============================================================================
  if (!currentUser) {
    return (
      <div className={`min-h-screen ${bgPage} flex flex-col items-center justify-center p-4 transition-colors`}>
        <div className="mb-4">{renderControlsBar()}</div>

        <div className={`max-w-md w-full border rounded-3xl p-7 space-y-6 ${bgCard}`}>
          <div className="text-center space-y-2">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
              <Waves className="h-8 w-8 text-white" />
            </div>
            <h1 className={`text-2xl font-black tracking-tight ${textMain}`}>ApexAqua</h1>
            <p className={`text-xs ${textMuted}`}>{t.subtitle}</p>
          </div>

          <div className={`grid grid-cols-3 gap-1.5 p-1.5 rounded-2xl border text-xs font-bold ${bgSubCard}`}>
            <button
              type="button"
              onClick={() => { setLoginTab('coach'); setLoginError(''); }}
              className={`py-2 rounded-xl transition-all ${loginTab === 'coach' ? 'bg-cyan-600 text-white shadow' : textMuted}`}
            >
              {t.roleCoach}
            </button>
            <button
              type="button"
              onClick={() => { setLoginTab('parent'); setLoginError(''); }}
              className={`py-2 rounded-xl transition-all ${loginTab === 'parent' ? 'bg-emerald-600 text-white shadow' : textMuted}`}
            >
              {t.roleParent}
            </button>
            <button
              type="button"
              onClick={() => { setLoginTab('athlete'); setLoginError(''); }}
              className={`py-2 rounded-xl transition-all ${loginTab === 'athlete' ? 'bg-blue-600 text-white shadow' : textMuted}`}
            >
              {t.roleAthlete}
            </button>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {loginTab === 'athlete' ? (
              <>
                <div>
                  <label className={`block text-xs font-bold mb-1.5 ${textMain}`}>{t.selectAthlete}</label>
                  <select
                    value={selectedAthleteLoginId}
                    onChange={(e) => setSelectedAthleteLoginId(e.target.value)}
                    className={`w-full border rounded-xl px-4 py-3 text-sm outline-none ${bgInput}`}
                  >
                    {allAthletesPublic.length === 0 && <option value="">-- No Athletes --</option>}
                    {allAthletesPublic.map((a) => (
                      <option key={a.id} value={a.id}>
                        [{a.athlete_code || 'ATH'}] {a.full_name} ({a.nickname})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={`block text-xs font-bold mb-1.5 ${textMain}`}>{t.pinLabel}</label>
                  <input
                    type="password"
                    maxLength={4}
                    placeholder="••••"
                    value={athletePinInput}
                    onChange={(e) => setAthletePinInput(e.target.value)}
                    className={`w-full border rounded-xl px-4 py-3 text-center tracking-widest text-lg font-mono outline-none ${bgInput}`}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-center gap-4 text-xs border-b border-slate-700/30 pb-2">
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

                {authMode === 'signup' && loginTab === 'coach' && (
                  <div>
                    <label className={`block text-xs font-bold mb-1 text-emerald-500`}>{t.clubNameLabel} *</label>
                    <div className="relative">
                      <Building2 className="h-4 w-4 text-emerald-500 absolute left-3.5 top-3.5" />
                      <input
                        type="text"
                        required
                        placeholder="เช่น สโมสรว่ายน้ำกรุงเทพฯ"
                        value={newClubNameInput}
                        onChange={(e) => setNewClubNameInput(e.target.value)}
                        className={`w-full border rounded-xl pl-10 pr-4 py-3 text-sm outline-none ${bgInput}`}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className={`block text-xs font-bold mb-1 ${textMain}`}>{t.emailLabel}</label>
                  <div className="relative">
                    <Mail className="h-4 w-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="email"
                      required
                      placeholder="name@example.com"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      className={`w-full border rounded-xl pl-10 pr-4 py-3 text-sm outline-none ${bgInput}`}
                    />
                  </div>
                </div>

                <div>
                  <label className={`block text-xs font-bold mb-1 ${textMain}`}>{t.passwordLabel}</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="••••••"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className={`w-full border rounded-xl px-4 py-3 text-sm outline-none ${bgInput}`}
                  />
                </div>
              </>
            )}

            {loginError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-500 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2"
            >
              <Lock className="h-4 w-4" />
              <span>{authLoading ? '...' : t.loginBtn}</span>
            </button>
          </form>

          <div className={`pt-3 border-t border-slate-700/20 text-center text-[11px] ${textMuted}`}>
            {t.pdpaFooter}
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
        <div className={`max-w-md w-full border rounded-3xl p-7 text-center space-y-5 ${bgCard}`}>
          <div className="mx-auto h-16 w-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
            <ShieldCheck className="h-9 w-9" />
          </div>
          <h2 className={`text-xl font-black ${textMain}`}>PDPA Parental Consent Required</h2>
          <p className={`text-xs leading-relaxed ${textMuted}`}>
            <b>{currentAthleteObj.nickname}</b>: Parent must sign Digital E-Consent under the Parent tab first.
          </p>
          <button
            onClick={handleLogout}
            className="w-full py-3 rounded-xl bg-cyan-600 text-xs font-bold text-white"
          >
            {t.logout}
          </button>
        </div>
      </div>
    );
  }

  // ============================================================================
  // VIEW 3: MAIN APPLICATION DASHBOARD (ISOLATED BY club_id)
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

  const previewAgeInfo = calculateDynamicAge(newAthlete.birth_date);

  return (
    <div className={`min-h-screen ${bgPage} pb-20 transition-colors`}>
      {/* Top Navbar */}
      <header className={`sticky top-0 z-40 backdrop-blur border-b px-4 py-3 ${isLight ? 'bg-white/95 border-slate-200' : 'bg-slate-900/95 border-slate-800'}`}>
        <div className="max-w-6xl mx-auto flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow">
                <Waves className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`font-black text-lg ${textMain}`}>ApexAqua</span>
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-500 border border-cyan-500/30 flex items-center gap-1">
                    <Building2 className="h-3 w-3" /> {currentUser.clubName}
                  </span>
                </div>
                <p className="text-[11px] text-emerald-500 font-semibold">{currentUser.name}</p>
              </div>
            </div>

            {renderControlsBar()}
          </div>

          {/* Navigation Tabs */}
          <div className={`flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl border text-xs font-bold ${bgSubCard}`}>
            {currentUser.role === 'coach' && (
              <button
                onClick={() => setActiveTab('poolside')}
                className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all ${
                  activeTab === 'poolside' ? 'bg-cyan-600 text-white' : textMuted
                }`}
              >
                <Timer className="h-3.5 w-3.5" /> {t.tabPoolside}
              </button>
            )}

            <button
              onClick={() => setActiveTab('readiness')}
              className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all ${
                activeTab === 'readiness' ? 'bg-cyan-600 text-white' : textMuted
              }`}
            >
              <Heart className="h-3.5 w-3.5" /> {t.tabReadiness}
            </button>

            <button
              onClick={() => setActiveTab('acwr_tsa')}
              className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all ${
                activeTab === 'acwr_tsa' ? 'bg-cyan-600 text-white' : textMuted
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" /> {t.tabAcwr}
            </button>

            {(currentUser.role === 'coach' || currentUser.role === 'parent') && (
              <button
                onClick={() => setActiveTab('pdpa')}
                className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all ${
                  activeTab === 'pdpa' ? 'bg-cyan-600 text-white' : textMuted
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5" /> {t.tabPdpa}
              </button>
            )}

            {currentUser.role === 'coach' && (
              <button
                onClick={() => setActiveTab('builder')}
                className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all ${
                  activeTab === 'builder' ? 'bg-cyan-600 text-white' : textMuted
                }`}
              >
                <Layers className="h-3.5 w-3.5" /> {t.tabBuilder}
              </button>
            )}

            {currentUser.role === 'coach' && isHeadCoach && (
              <button
                onClick={() => setActiveTab('staff')}
                className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all ${
                  activeTab === 'staff' ? 'bg-amber-600 text-white' : 'text-amber-500'
                }`}
              >
                <UserCog className="h-3.5 w-3.5" /> {t.tabStaff}
              </button>
            )}

            <button
              onClick={handleLogout}
              className="ml-auto px-3 py-1.5 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-600 hover:text-white flex items-center gap-1"
            >
              <LogOut className="h-3.5 w-3.5" /> {t.logout}
            </button>
          </div>
        </div>
      </header>

      {/* PARENT FAMILY MULTI-CHILD SWITCHER BAR */}
      {currentUser.role === 'parent' && parentChildrenList.length > 0 && (
        <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-2.5">
          <div className="max-w-6xl mx-auto flex flex-wrap items-center gap-2 text-xs">
            <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5 mr-2">
              <Baby className="h-4 w-4" /> {t.childrenLabel} ({parentChildrenList.length}):
            </span>
            {parentChildrenList.map((child) => (
              <button
                key={child.id}
                onClick={() => handleSwitchParentChild(child.id)}
                className={`px-3.5 py-1.5 rounded-xl font-bold transition-all ${
                  activeParentChildId === child.id
                    ? 'bg-emerald-600 text-white shadow'
                    : `${bgCard} ${textMain} hover:border-emerald-500`
                }`}
              >
                {child.nickname || child.full_name}
              </button>
            ))}
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto p-4 mt-2">
        {/* ==================================================================== */}
        {/* TAB 1: POOLSIDE & COMPREHENSIVE ATHLETE BIO ROSTER                   */}
        {/* ==================================================================== */}
        {activeTab === 'poolside' && currentUser.role === 'coach' && (
          <div className="space-y-4">
            <div className={`border rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 ${bgCard}`}>
              <div className="flex flex-wrap items-center gap-2">
                {canManageAthletes && (
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg"
                  >
                    <Plus className="h-4 w-4" /> {t.addAthleteBtn}
                  </button>
                )}

                <div className={`flex items-center gap-1 p-1 rounded-xl border text-xs font-bold ml-2 ${bgSubCard}`}>
                  <Filter className="h-3.5 w-3.5 text-slate-400 ml-2 mr-1" />
                  <button
                    onClick={() => setSelectedLane('all')}
                    className={`px-2.5 py-1 rounded-lg ${selectedLane === 'all' ? 'bg-cyan-600 text-white' : textMuted}`}
                  >
                    {t.allLanes} ({athletes.length})
                  </button>
                  {[1, 2, 3, 4].map((l) => (
                    <button
                      key={l}
                      onClick={() => setSelectedLane(l)}
                      className={`px-2.5 py-1 rounded-lg ${selectedLane === l ? 'bg-cyan-600 text-white' : textMuted}`}
                    >
                      {t.lane} {l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs ${bgSubCard}`}>
                  <span className={textMuted}>{t.duration}:</span>
                  <input
                    type="number"
                    value={sessionDuration}
                    onChange={(e) => setSessionDuration(Number(e.target.value))}
                    className="w-12 bg-transparent text-center font-bold text-cyan-500 outline-none"
                  />
                  <span className={textMuted}>{t.mins}</span>
                </div>

                <button
                  onClick={handleSavePoolside}
                  disabled={savingPoolside || athletes.length === 0}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg"
                >
                  <Save className="h-4 w-4" />
                  <span>{savingPoolside ? '...' : t.saveAllPool}</span>
                </button>
              </div>
            </div>

            {poolsideMsg && (
              <div className="p-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-500 text-xs flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{poolsideMsg.text}</span>
              </div>
            )}

            {!loadingData && athletes.length === 0 ? (
              <div className={`border-2 border-dashed rounded-3xl p-12 text-center space-y-3 ${bgCard}`}>
                <Users className="h-12 w-12 text-slate-400 mx-auto" />
                <h3 className={`text-lg font-bold ${textMain}`}>ยังไม่มีรายชื่อนักกีฬาในสโมสร {currentUser.clubName}</h3>
                <p className={`text-xs max-w-md mx-auto ${textMuted}`}>
                  กดปุ่ม <b>"+ {t.addAthleteBtn}"</b> ด้านบนเพื่อบันทึกรูปภาพ วันเกิด (พ.ศ./ค.ศ.) หมู่เลือด และประวัตินักกีฬา
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPoolside.map((row) => {
                  const { ageYears, autoGroup } = calculateDynamicAge(row.birth_date);
                  return (
                    <div
                      key={row.id}
                      className={`border rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-all ${bgCard} ${
                        !row.attended && 'opacity-50'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-[300px]">
                        <button
                          onClick={() =>
                            setPoolsideRows((prev) =>
                              prev.map((p) => (p.id === row.id ? { ...p, attended: !p.attended } : p))
                            )
                          }
                          className={`mt-1 h-8 w-8 rounded-xl font-black text-sm flex items-center justify-center shrink-0 ${
                            row.attended ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'
                          }`}
                        >
                          ✓
                        </button>

                        {/* Athlete Avatar */}
                        {row.avatar_url ? (
                          <img
                            src={row.avatar_url}
                            alt={row.nickname}
                            className="h-12 w-12 rounded-2xl object-cover border border-cyan-500/40 shrink-0"
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center font-black text-cyan-500 shrink-0">
                            {row.nickname?.slice(0, 2) || 'SW'}
                          </div>
                        )}

                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-500">
                              {t.lane} {row.lane}
                            </span>
                            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-500/10 text-slate-400">
                              {row.athlete_code}
                            </span>
                            <span className={`font-bold text-sm ${textMain}`}>
                              {row.full_name} ({row.nickname})
                            </span>
                          </div>

                          {(row.first_name_en || row.last_name_en) && (
                            <p className="text-[11px] font-medium text-cyan-500">
                              {row.first_name_en} {row.last_name_en}
                            </p>
                          )}

                          <div className={`flex flex-wrap items-center gap-2 text-[11px] ${textMuted}`}>
                            <span className="font-bold text-emerald-500">
                              อายุ {ageYears} ปี ({AGE_GROUP_LABELS[autoGroup]})
                            </span>
                            <span>• เกิด: {formatThaiBirthDate(row.birth_date)}</span>
                            {row.blood_group && (
                              <span className="px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-500 font-bold">
                                กรุ๊ปเลือด {row.blood_group}
                              </span>
                            )}
                          </div>

                          <div className={`flex flex-wrap items-center gap-2 text-[11px] ${textMuted}`}>
                            {row.school_name && (
                              <span className="flex items-center gap-1">
                                <GraduationCap className="h-3 w-3" /> {row.school_name} ({row.grade_level})
                              </span>
                            )}
                            {row.student_id && <span>• เลขประจำตัว: {row.student_id}</span>}
                            {row.national_id && (
                              <span>• ปชช: {row.national_id.slice(0, 3)}xxxxxxxx{row.national_id.slice(-2)}</span>
                            )}
                          </div>

                          {row.medical_conditions && (
                            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-500/15 border border-rose-500/40 text-rose-500 text-[11px] font-bold">
                              <HeartPulse className="h-3.5 w-3.5" /> โรคประจำตัว/แพ้: {row.medical_conditions}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* sRPE Controls */}
                      <div className="flex-1 max-w-md">
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className={textMuted}>
                            {t.srpeLabel}: <b className="text-cyan-500">{row.attended ? `${row.srpe}/10` : '-'}</b>
                          </span>
                          <span className="font-bold text-amber-500">
                            Load: {row.attended ? row.srpe * sessionDuration : 0} AU
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
                                  : isLight
                                  ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                              }`}
                            >
                              {num}
                            </button>
                          ))}
                        </div>
                      </div>

                      {canManageAthletes && (
                        <button
                          onClick={() => handleDeleteAthlete(row.id, row.full_name)}
                          className="p-2 rounded-xl text-slate-400 hover:text-rose-500 self-end lg:self-center"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* COMPREHENSIVE ATHLETE BIO REGISTRATION MODAL */}
            {showAddModal && (
              <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                <div className={`border rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl my-8 ${bgCard}`}>
                  <div className="flex items-center justify-between border-b border-slate-700/20 pb-3">
                    <h3 className={`text-lg font-black ${textMain}`}>{t.addAthleteBtn}</h3>
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500">
                      คำนวณอายุอัตโนมัติ: {previewAgeInfo.ageYears} ปี ({AGE_GROUP_LABELS[previewAgeInfo.autoGroup]})
                    </span>
                  </div>

                  <form onSubmit={handleAddAthlete} className="space-y-4 text-xs max-h-[75vh] overflow-y-auto pr-1">
                    {/* Photo Upload */}
                    <div className={`flex items-center gap-4 p-3 rounded-2xl border ${bgSubCard}`}>
                      {newAthlete.avatar_url ? (
                        <img
                          src={newAthlete.avatar_url}
                          alt="Preview"
                          className="h-16 w-16 rounded-2xl object-cover border border-cyan-500"
                        />
                      ) : (
                        <div className="h-16 w-16 rounded-2xl bg-slate-800/40 border border-dashed border-slate-500 flex items-center justify-center text-slate-400">
                          <Camera className="h-6 w-6" />
                        </div>
                      )}
                      <div>
                        <label className={`block font-bold mb-1 ${textMain}`}>รูปโปรไฟล์นักกีฬา</label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoUpload}
                          className="text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-cyan-600 file:text-white hover:file:bg-cyan-500"
                        />
                        {uploadingPhoto && <span className="text-cyan-500 block mt-1">กำลังอัปโหลดรูป...</span>}
                      </div>
                    </div>

                    {/* Names TH & EN */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className={`block mb-1 font-bold ${textMain}`}>ชื่อ (ภาษาไทย) *</label>
                        <input
                          required
                          type="text"
                          placeholder="เช่น ธนกฤต"
                          value={newAthlete.first_name_th}
                          onChange={(e) => setNewAthlete({ ...newAthlete, first_name_th: e.target.value })}
                          className={`w-full border rounded-xl px-3 py-2 ${bgInput}`}
                        />
                      </div>
                      <div>
                        <label className={`block mb-1 font-bold ${textMain}`}>นามสกุล (ภาษาไทย) *</label>
                        <input
                          required
                          type="text"
                          placeholder="เช่น ใจดี"
                          value={newAthlete.last_name_th}
                          onChange={(e) => setNewAthlete({ ...newAthlete, last_name_th: e.target.value })}
                          className={`w-full border rounded-xl px-3 py-2 ${bgInput}`}
                        />
                      </div>
                      <div>
                        <label className={`block mb-1 font-bold ${textMain}`}>ชื่อเล่น *</label>
                        <input
                          required
                          type="text"
                          placeholder="เช่น น้องกฤต"
                          value={newAthlete.nickname}
                          onChange={(e) => setNewAthlete({ ...newAthlete, nickname: e.target.value })}
                          className={`w-full border rounded-xl px-3 py-2 ${bgInput}`}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className={`block mb-1 ${textMuted}`}>First Name (English)</label>
                        <input
                          type="text"
                          placeholder="e.g. Thanakrit"
                          value={newAthlete.first_name_en}
                          onChange={(e) => setNewAthlete({ ...newAthlete, first_name_en: e.target.value })}
                          className={`w-full border rounded-xl px-3 py-2 ${bgInput}`}
                        />
                      </div>
                      <div>
                        <label className={`block mb-1 ${textMuted}`}>Last Name (English)</label>
                        <input
                          type="text"
                          placeholder="e.g. Jaidee"
                          value={newAthlete.last_name_en}
                          onChange={(e) => setNewAthlete({ ...newAthlete, last_name_en: e.target.value })}
                          className={`w-full border rounded-xl px-3 py-2 ${bgInput}`}
                        />
                      </div>
                      <div>
                        <label className={`block mb-1 font-bold ${textMain}`}>เพศ (Gender)</label>
                        <select
                          value={newAthlete.gender}
                          onChange={(e) =>
                            setNewAthlete({ ...newAthlete, gender: e.target.value as 'Male' | 'Female' })
                          }
                          className={`w-full border rounded-xl px-3 py-2 ${bgInput}`}
                        >
                          <option value="Male">ชาย (Male)</option>
                          <option value="Female">หญิง (Female)</option>
                        </select>
                      </div>
                    </div>

                    {/* Birth Date ค.ศ. & พ.ศ. + Auto Age */}
                    <div className={`grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-2xl border ${bgSubCard}`}>
                      <div>
                        <label className={`block mb-1 font-bold ${textMain}`}>วันเกิด (ค.ศ.)</label>
                        <input
                          type="date"
                          required
                          value={newAthlete.birth_date}
                          onChange={(e) => handleAdDateChange(e.target.value)}
                          className={`w-full border rounded-xl px-3 py-2 ${bgInput}`}
                        />
                      </div>
                      <div>
                        <label className={`block mb-1 font-bold ${textMain}`}>ปีเกิด (พ.ศ.)</label>
                        <input
                          type="number"
                          placeholder="เช่น 2559"
                          value={newAthlete.be_year_input}
                          onChange={(e) => handleBeYearChange(e.target.value)}
                          className={`w-full border rounded-xl px-3 py-2 ${bgInput}`}
                        />
                      </div>
                      <div className="flex flex-col justify-center">
                        <span className={`text-[11px] ${textMuted}`}>อายุปัจจุบัน (ปรับอัตโนมัติทุกปี)</span>
                        <span className="text-base font-black text-cyan-500">
                          {previewAgeInfo.ageYears} ปี ({AGE_GROUP_LABELS[previewAgeInfo.autoGroup]})
                        </span>
                      </div>
                    </div>

                    {/* IDs & School Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className={`block mb-1 ${textMuted}`}>รหัสนักกีฬา (Athlete Code)</label>
                        <input
                          type="text"
                          placeholder="เช่น SW-001"
                          value={newAthlete.athlete_code}
                          onChange={(e) => setNewAthlete({ ...newAthlete, athlete_code: e.target.value })}
                          className={`w-full border rounded-xl px-3 py-2 font-mono ${bgInput}`}
                        />
                      </div>
                      <div>
                        <label className={`block mb-1 ${textMuted}`}>เลขประจำตัวนักเรียน</label>
                        <input
                          type="text"
                          placeholder="เช่น 65432"
                          value={newAthlete.student_id}
                          onChange={(e) => setNewAthlete({ ...newAthlete, student_id: e.target.value })}
                          className={`w-full border rounded-xl px-3 py-2 ${bgInput}`}
                        />
                      </div>
                      <div>
                        <label className={`block mb-1 ${textMuted}`}>เลขบัตรประชาชน (13 หลัก)</label>
                        <input
                          type="text"
                          maxLength={13}
                          placeholder="1xxxxxxxxxxxx"
                          value={newAthlete.national_id}
                          onChange={(e) => setNewAthlete({ ...newAthlete, national_id: e.target.value })}
                          className={`w-full border rounded-xl px-3 py-2 font-mono ${bgInput}`}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <label className={`block mb-1 ${textMuted}`}>สถานศึกษา / โรงเรียน</label>
                        <input
                          type="text"
                          placeholder="เช่น โรงเรียนสาธิต..."
                          value={newAthlete.school_name}
                          onChange={(e) => setNewAthlete({ ...newAthlete, school_name: e.target.value })}
                          className={`w-full border rounded-xl px-3 py-2 ${bgInput}`}
                        />
                      </div>
                      <div>
                        <label className={`block mb-1 ${textMuted}`}>ชั้นเรียน (Grade)</label>
                        <input
                          type="text"
                          placeholder="เช่น ป.4 / ม.2"
                          value={newAthlete.grade_level}
                          onChange={(e) => setNewAthlete({ ...newAthlete, grade_level: e.target.value })}
                          className={`w-full border rounded-xl px-3 py-2 ${bgInput}`}
                        />
                      </div>
                    </div>

                    {/* Medical & Blood Group */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className={`block mb-1 font-bold text-rose-500`}>หมู่เลือด (Blood Group)</label>
                        <select
                          value={newAthlete.blood_group}
                          onChange={(e) => setNewAthlete({ ...newAthlete, blood_group: e.target.value })}
                          className={`w-full border rounded-xl px-3 py-2 font-bold ${bgInput}`}
                        >
                          <option value="A">กรุ๊ป A</option>
                          <option value="B">กรุ๊ป B</option>
                          <option value="AB">กรุ๊ป AB</option>
                          <option value="O">กรุ๊ป O</option>
                          <option value="Unknown">ไม่ทราบ</option>
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className={`block mb-1 font-bold text-rose-500`}>โรคประจำตัว / ประวัติแพ้ยา-แพ้อาหาร</label>
                        <input
                          type="text"
                          placeholder="หากไม่มีให้เว้นว่าง (เช่น หอบหืด, แพ้อาหารทะเล)"
                          value={newAthlete.medical_conditions}
                          onChange={(e) => setNewAthlete({ ...newAthlete, medical_conditions: e.target.value })}
                          className={`w-full border rounded-xl px-3 py-2 ${bgInput}`}
                        />
                      </div>
                    </div>

                    {/* Lane, PIN & Parent Email */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-700/20">
                      <div>
                        <label className={`block mb-1 ${textMuted}`}>ลู่ว่ายประจำ</label>
                        <select
                          value={newAthlete.lane}
                          onChange={(e) => setNewAthlete({ ...newAthlete, lane: Number(e.target.value) })}
                          className={`w-full border rounded-xl px-3 py-2 ${bgInput}`}
                        >
                          {[1, 2, 3, 4, 5, 6].map((l) => (
                            <option key={l} value={l}>
                              ลู่ {l}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={`block mb-1 ${textMuted}`}>รหัส PIN นักกีฬา (4 หลัก)</label>
                        <input
                          type="text"
                          maxLength={4}
                          value={newAthlete.pin_code}
                          onChange={(e) => setNewAthlete({ ...newAthlete, pin_code: e.target.value })}
                          className={`w-full border rounded-xl px-3 py-2 font-mono ${bgInput}`}
                        />
                      </div>
                      <div>
                        <label className={`block mb-1 ${textMuted}`}>ชื่อผู้ปกครอง</label>
                        <input
                          type="text"
                          placeholder="คุณพ่อ/คุณแม่..."
                          value={newAthlete.parent_name}
                          onChange={(e) => setNewAthlete({ ...newAthlete, parent_name: e.target.value })}
                          className={`w-full border rounded-xl px-3 py-2 ${bgInput}`}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-cyan-500 font-bold mb-1">
                        อีเมลผู้ปกครอง (ใช้อีเมลเดียวกันหากมีลูก 2–3 คนในบ้าน) *
                      </label>
                      <input
                        required
                        type="email"
                        placeholder="parent@example.com"
                        value={newAthlete.parent_email}
                        onChange={(e) => setNewAthlete({ ...newAthlete, parent_email: e.target.value })}
                        className={`w-full border rounded-xl px-3 py-2 ${bgInput}`}
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-3">
                      <button
                        type="button"
                        onClick={() => setShowAddModal(false)}
                        className="px-4 py-2 rounded-xl bg-slate-200 text-slate-800 font-bold"
                      >
                        ยกเลิก
                      </button>
                      <button
                        type="submit"
                        disabled={addingAthlete}
                        className="px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold shadow"
                      >
                        {addingAthlete ? 'กำลังบันทึก...' : 'บันทึกประวัตินักกีฬา'}
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
            className={`max-w-2xl mx-auto border rounded-3xl p-6 space-y-5 ${bgCard}`}
          >
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-500">
                Pre-Training Readiness
              </span>
              <h2 className={`text-xl font-black ${textMain}`}>{t.readinessTitle}</h2>
            </div>

            <div>
              <label className={`block text-xs font-bold mb-1.5 ${textMain}`}>{t.selectAthlete}</label>
              <select
                value={readinessAthleteId}
                onChange={(e) => setReadinessAthleteId(e.target.value)}
                disabled={currentUser.role !== 'coach'}
                className={`w-full border rounded-xl px-4 py-3 text-sm ${bgInput}`}
              >
                {visibleAthletesForRole.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.full_name} ({a.nickname})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className={`p-4 rounded-2xl border ${bgSubCard}`}>
                <div className="flex justify-between text-xs mb-2">
                  <span className={textMuted}>{t.rhrLabel}</span>
                  <span className="font-black text-rose-500">{rhr} bpm</span>
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

              <div className={`p-4 rounded-2xl border ${bgSubCard}`}>
                <div className="flex justify-between text-xs mb-2">
                  <span className={textMuted}>{t.sleepLabel}</span>
                  <span className="font-black text-cyan-500">
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
                  className="w-full accent-cyan-500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <span className={`text-xs font-bold block ${textMain}`}>{t.sorenessTitle}</span>
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
                  className={`flex items-center justify-between px-4 py-2.5 rounded-xl border ${bgSubCard}`}
                >
                  <span className={`text-xs ${textMain}`}>{part.label}</span>
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
                            : isLight
                            ? 'bg-slate-200 text-slate-700'
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
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-500 text-xs">
                {readinessMsg.text}
              </div>
            )}

            <button
              type="submit"
              disabled={savingReadiness || visibleAthletesForRole.length === 0}
              className="w-full py-3.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm shadow-lg"
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
                  <span className="text-[10px] font-bold uppercase text-amber-500">
                    Real-time Workload & Injury Prevention
                  </span>
                  <h2 className={`text-xl font-black ${textMain}`}>{t.acwrTitle}</h2>
                </div>
                <button
                  onClick={() => fetchTenantData(currentUser.clubId)}
                  className={`px-3.5 py-2 rounded-xl border text-xs font-bold text-cyan-500 flex items-center gap-1.5 ${bgCard}`}
                >
                  <RefreshCw className="h-3.5 w-3.5" /> {t.refreshBtn}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {visibleAcwrForRole.map((item) => {
                  const isDanger = item.acwr >= 1.5;
                  const isWarn = item.acwr >= 1.31 && item.acwr < 1.5;
                  return (
                    <div
                      key={item.athlete.id}
                      className={`border rounded-2xl p-5 space-y-3 ${bgCard} ${
                        isDanger ? 'border-rose-500' : isWarn ? 'border-amber-500' : ''
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className={`font-bold text-base ${textMain}`}>
                            {item.athlete.full_name} ({item.athlete.nickname})
                          </h3>
                          <span className={`text-xs ${textMuted}`}>28d Sessions: {item.sessionCount28d}</span>
                        </div>
                        <div className="text-right">
                          <span
                            className={`text-2xl font-black ${
                              isDanger ? 'text-rose-500' : isWarn ? 'text-amber-500' : 'text-emerald-500'
                            }`}
                          >
                            {item.acwr.toFixed(2)}
                          </span>
                          <span className={`block text-[10px] font-bold ${textMuted}`}>
                            {isDanger ? 'Danger Zone' : isWarn ? 'Early Warning' : 'Sweet Spot'}
                          </span>
                        </div>
                      </div>
                      <div className={`flex justify-between text-xs p-3 rounded-xl border ${bgSubCard} ${textMuted}`}>
                        <span>Acute (7d): <b className="text-cyan-500">{item.acuteLoad} AU</b></span>
                        <span>Chronic (28d): <b className={textMain}>{item.chronicLoad} AU</b></span>
                        <span>RHR: <b className="text-rose-500">{item.latestRhr ?? '-'} bpm</b></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Daily Training History Table */}
            <div className={`border rounded-3xl p-6 space-y-4 ${bgCard}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-bold uppercase text-emerald-500 flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" /> Daily Training Audit Logs
                  </span>
                  <h2 className={`text-lg font-black ${textMain}`}>{t.historyTitle}</h2>
                </div>
                <button
                  onClick={handleExportHistoryCsv}
                  disabled={visibleHistoryLogs.length === 0}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 shadow"
                >
                  <Download className="h-4 w-4" /> {t.exportCsvBtn}
                </button>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-700/30">
                <table className="w-full text-left text-xs">
                  <thead className={`border-b border-slate-700/30 ${bgSubCard} ${textMuted}`}>
                    <tr>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Athlete</th>
                      <th className="py-3 px-4 text-center">{t.duration}</th>
                      <th className="py-3 px-4 text-center">sRPE</th>
                      <th className="py-3 px-4 text-right">Load (AU)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/20">
                    {visibleHistoryLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className={`py-8 text-center ${textMuted}`}>
                          No training logs recorded yet.
                        </td>
                      </tr>
                    ) : (
                      visibleHistoryLogs.slice(0, 20).map((log) => {
                        const ath = athletes.find((a) => a.id === log.athlete_id);
                        return (
                          <tr key={log.id}>
                            <td className={`py-3 px-4 font-mono ${textMuted}`}>{log.workout_date}</td>
                            <td className={`py-3 px-4 font-bold ${textMain}`}>
                              {ath ? `${ath.full_name} (${ath.nickname})` : '-'}
                            </td>
                            <td className={`py-3 px-4 text-center ${textMuted}`}>{log.duration_minutes}</td>
                            <td className="py-3 px-4 text-center">
                              <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-500 font-bold">
                                {log.srpe} / 10
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-black text-amber-500">
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
            <div className={`border rounded-3xl p-6 space-y-5 ${bgCard}`}>
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-700/20 pb-4">
                <div>
                  <span className="text-[10px] font-bold uppercase text-cyan-500 flex items-center gap-1">
                    <Trophy className="h-3.5 w-3.5" /> TSA Benchmark 2026
                  </span>
                  <h2 className={`text-xl font-black mt-0.5 ${textMain}`}>{t.tsaTitle}</h2>
                </div>

                {currentUser.role === 'coach' && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadSampleCsv}
                      className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 ${bgSubCard} ${textMain}`}
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" /> {t.downloadTemplate}
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
                      className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 shadow"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      <span>{importingCsv ? '...' : t.uploadCsv}</span>
                    </button>
                  </div>
                )}
              </div>

              {csvImportMsg && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-500 text-xs">
                  {csvImportMsg}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <select
                  value={selectedBenchmarkAthleteId}
                  onChange={(e) => setSelectedBenchmarkAthleteId(e.target.value)}
                  disabled={currentUser.role !== 'coach'}
                  className={`border rounded-xl px-3 py-2 text-xs font-bold ${bgInput}`}
                >
                  {visibleAthletesForRole.map((a) => {
                    const { autoGroup } = calculateDynamicAge(a.birth_date);
                    return (
                      <option key={a.id} value={a.id}>
                        {a.full_name} ({AGE_GROUP_LABELS[autoGroup]})
                      </option>
                    );
                  })}
                </select>

                <div className={`flex p-1 rounded-xl border text-xs font-bold ${bgSubCard}`}>
                  <button
                    onClick={() => setTsaCourse('50m')}
                    className={`px-3 py-1.5 rounded-lg ${tsaCourse === '50m' ? 'bg-cyan-600 text-white' : textMuted}`}
                  >
                    {t.course50}
                  </button>
                  <button
                    onClick={() => setTsaCourse('25m')}
                    className={`px-3 py-1.5 rounded-lg ${tsaCourse === '25m' ? 'bg-cyan-600 text-white' : textMuted}`}
                  >
                    {t.course25}
                  </button>
                </div>
              </div>

              <form
                onSubmit={handleAddCompTime}
                className={`grid grid-cols-1 sm:grid-cols-5 gap-2 p-3.5 rounded-2xl border text-xs ${bgSubCard}`}
              >
                <input
                  type="text"
                  placeholder="Meet Name"
                  value={newComp.meet_name}
                  onChange={(e) => setNewComp({ ...newComp, meet_name: e.target.value })}
                  className={`border rounded-xl px-3 py-2 ${bgInput}`}
                />
                <select
                  value={newComp.stroke}
                  onChange={(e) => setNewComp({ ...newComp, stroke: e.target.value })}
                  className={`border rounded-xl px-3 py-2 ${bgInput}`}
                >
                  <option value="Freestyle">Freestyle</option>
                  <option value="Backstroke">Backstroke</option>
                  <option value="Breaststroke">Breaststroke</option>
                  <option value="Butterfly">Butterfly</option>
                </select>
                <select
                  value={newComp.distance_m}
                  onChange={(e) => setNewComp({ ...newComp, distance_m: Number(e.target.value) })}
                  className={`border rounded-xl px-3 py-2 ${bgInput}`}
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
                  className={`border rounded-xl px-3 py-2 ${bgInput}`}
                />
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl py-2 px-3"
                >
                  {t.addPbBtn}
                </button>
              </form>

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
                    <div key={std.id} className={`border rounded-2xl p-4 space-y-3 ${bgSubCard}`}>
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className={`font-bold text-sm ${textMain}`}>
                            {std.stroke} {std.distance_m}m ({std.course})
                          </h4>
                          <span className="text-[10px] text-cyan-500">{std.source_notes}</span>
                        </div>
                        {delta !== null && (
                          <span
                            className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                              delta <= 0
                                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/40'
                                : 'bg-amber-500/10 text-amber-500 border border-amber-500/40'
                            }`}
                          >
                            {delta <= 0 ? `Qualified (${delta}s)` : `+${delta}s`}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-center text-xs">
                        <div className={`p-2.5 rounded-xl border ${bgCard}`}>
                          <span className={`block text-[10px] ${textMuted}`}>Current PB</span>
                          <b className="text-base text-cyan-500">
                            {bestPb !== null ? `${bestPb.toFixed(2)}s` : '-'}
                          </b>
                        </div>
                        <div className={`p-2.5 rounded-xl border ${bgCard}`}>
                          <span className={`block text-[10px] ${textMuted}`}>TSA Target</span>
                          <b className={`text-base ${textMain}`}>{std.qualifying_time_sec.toFixed(2)}s</b>
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
            <div className={`border rounded-3xl p-6 space-y-4 ${bgCard}`}>
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500">
                  <FileSignature className="h-6 w-6" />
                </div>
                <div>
                  <h2 className={`text-lg font-black ${textMain}`}>{t.pdpaTitle}</h2>
                </div>
              </div>

              <form onSubmit={handleSignPdpa} className="space-y-4 pt-2">
                <div>
                  <label className={`block text-xs font-bold mb-1 ${textMain}`}>{t.selectAthlete}</label>
                  <select
                    value={pdpaTargetAthleteId}
                    onChange={(e) => setPdpaTargetAthleteId(e.target.value)}
                    disabled={currentUser.role === 'parent'}
                    className={`w-full border rounded-xl px-4 py-2.5 text-sm ${bgInput}`}
                  >
                    {visibleAthletesForRole.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.full_name} ({a.nickname}) - {a.pdpa_signed ? 'Signed ✓' : 'Pending'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={`border rounded-2xl p-4 text-xs space-y-2 leading-relaxed ${bgSubCard} ${textMuted}`}>
                  <p className="font-bold text-cyan-500">PDPA Youth Health Consent v2.2:</p>
                  <p>
                    1. ข้อมูลประวัติส่วนบุคคล หมู่เลือด โรคประจำตัว ความพร้อมทางร่างกาย และสถิติฝึกซ้อม จะถูกจัดเก็บภายใต้รหัสสโมสร {currentUser.clubName} เพื่อความปลอดภัยในการฝึกซ้อมเท่านั้น
                  </p>
                  <p>
                    2. ข้อมูลถูกแยกสิทธิ์การเข้าถึงอย่างเด็ดขาด (Strict Multi-tenant Isolation) ไม่สามารถเข้าถึงได้จากสโมสรอื่น
                  </p>
                </div>

                <div>
                  <label className={`block text-xs font-bold mb-1 ${textMain}`}>ชื่อ-นามสกุล บิดา / มารดา / ผู้ปกครองตามกฎหมาย *</label>
                  <input
                    required
                    type="text"
                    value={parentSignerName}
                    onChange={(e) => setParentSignerName(e.target.value)}
                    className={`w-full border rounded-xl px-4 py-3 text-sm ${bgInput}`}
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg"
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
          <div className="space-y-4">
            <div className={`border rounded-3xl p-6 space-y-4 ${bgCard}`}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] font-bold uppercase text-cyan-500">
                    Nested Sets & Auto-Zone Engine
                  </span>
                  <h2 className={`text-xl font-black ${textMain}`}>{t.builderTitle}</h2>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className={`border px-3 py-2 rounded-xl text-xs ${bgSubCard}`}>
                    <span className={textMuted}>CSS 100m: </span>
                    <input
                      type="number"
                      value={css100m}
                      onChange={(e) => setCss100m(Number(e.target.value))}
                      className="w-12 bg-transparent text-center font-bold text-cyan-500 outline-none"
                    />
                    <span className={textMuted}>s</span>
                  </div>
                  {canEditWorkouts && (
                    <button
                      onClick={handleSaveWorkout}
                      disabled={savingWorkout}
                      className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5"
                    >
                      <Save className="h-4 w-4" /> {t.saveWorkoutBtn}
                    </button>
                  )}
                </div>
              </div>

              {workoutMsg && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-500 text-xs">
                  {workoutMsg}
                </div>
              )}

              <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-2xl border ${bgSubCard}`}>
                <div>
                  <label className={`text-[11px] block mb-1 ${textMuted}`}>Workout Title</label>
                  <input
                    type="text"
                    disabled={!canEditWorkouts}
                    value={workoutTitle}
                    onChange={(e) => setWorkoutTitle(e.target.value)}
                    className={`w-full border rounded-xl px-3 py-2 text-sm font-bold ${bgInput}`}
                  />
                </div>
                <div className="flex items-center justify-between px-4">
                  <div>
                    <span className={`text-[11px] block ${textMuted}`}>{t.totalDist}</span>
                    <span className="text-2xl font-black text-cyan-500">
                      {totalWorkoutDist.toLocaleString()} {t.meters}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {groups.map((grp, gIdx) => (
              <div key={grp.id} className={`border rounded-2xl p-5 space-y-3 ${bgCard}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="h-6 w-6 rounded-full bg-cyan-500/10 text-cyan-500 font-bold flex items-center justify-center">
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
                      className={`border rounded-lg px-3 py-1.5 font-bold ${bgInput}`}
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
                      className={`w-12 border rounded-lg py-1 text-center text-amber-500 font-bold ${bgInput}`}
                    />
                  </div>

                  {canEditWorkouts && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleAddItemToGroup(grp.id)}
                        className={`px-3 py-1.5 rounded-lg border text-cyan-500 text-xs font-bold flex items-center gap-1 ${bgSubCard}`}
                      >
                        <Plus className="h-3.5 w-3.5" /> + Item
                      </button>
                      {groups.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteGroup(grp.id)}
                          className="p-1.5 rounded-lg bg-rose-500/10 text-rose-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  {grp.items.map((item) => {
                    const zone = classifyZone(grp.category, item.distance, item.restSec);
                    const interval = calcInterval(item.distance, item.restSec, zone.mult);
                    return (
                      <div
                        key={item.id}
                        className={`border rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs ${bgSubCard}`}
                      >
                        <div className="flex flex-wrap items-center gap-2">
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
                            className={`w-12 border rounded px-2 py-1 text-center font-bold ${bgInput}`}
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
                            className={`border rounded px-2 py-1 text-cyan-500 font-bold ${bgInput}`}
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
                            className={`border rounded px-2 py-1 ${bgInput}`}
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
                            className={`w-14 border rounded px-2 py-1 text-center text-amber-500 ${bgInput}`}
                          />
                          <span className={textMuted}>s</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-1 rounded-lg border font-bold ${zone.color}`}>
                            {zone.code} ({zone.label})
                          </span>
                          <span className={`px-2.5 py-1 rounded-lg border text-cyan-500 font-mono font-bold ${bgCard}`}>
                            {interval}
                          </span>
                          {canEditWorkouts && grp.items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleDeleteItemFromGroup(grp.id, item.id)}
                              className="p-1 text-slate-400 hover:text-rose-500"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
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
                className={`w-full py-4 rounded-2xl border-2 border-dashed border-slate-400/50 hover:border-cyan-500 font-bold text-xs flex items-center justify-center gap-2 transition-all ${textMuted} hover:text-cyan-500`}
              >
                <Plus className="h-4 w-4" /> {t.addGroupBtn}
              </button>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 6: STAFF MANAGEMENT                                              */}
        {/* ==================================================================== */}
        {activeTab === 'staff' && currentUser.role === 'coach' && isHeadCoach && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className={`border rounded-3xl p-6 space-y-5 ${bgCard}`}>
              <div>
                <span className="text-[10px] font-bold uppercase text-amber-500">Staff RBAC ({currentUser.clubName})</span>
                <h2 className={`text-xl font-black ${textMain}`}>{t.staffTitle}</h2>
              </div>

              <form
                onSubmit={handleAddStaff}
                className={`grid grid-cols-1 md:grid-cols-4 gap-3 p-4 rounded-2xl border text-xs ${bgSubCard}`}
              >
                <input
                  type="text"
                  required
                  placeholder="Coach Name"
                  value={newStaff.full_name}
                  onChange={(e) => setNewStaff({ ...newStaff, full_name: e.target.value })}
                  className={`border rounded-xl px-3 py-2.5 ${bgInput}`}
                />
                <input
                  type="email"
                  required
                  placeholder="Email"
                  value={newStaff.email}
                  onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                  className={`border rounded-xl px-3 py-2.5 ${bgInput}`}
                />
                <select
                  value={newStaff.staff_role}
                  onChange={(e) =>
                    setNewStaff({
                      ...newStaff,
                      staff_role: e.target.value as 'head_coach' | 'assistant_coach',
                    })
                  }
                  className={`border rounded-xl px-3 py-2.5 ${bgInput}`}
                >
                  <option value="assistant_coach">Assistant Coach</option>
                  <option value="head_coach">Head Coach</option>
                </select>
                <button
                  type="submit"
                  className="bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl py-2.5 px-4 flex items-center justify-center gap-1.5"
                >
                  <Plus className="h-4 w-4" /> Add Staff
                </button>
              </form>

              <div className="space-y-3">
                {staffList.map((st) => (
                  <div
                    key={st.id}
                    className={`border rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 text-xs ${bgSubCard}`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`font-bold text-sm ${textMain}`}>{st.full_name}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-500 border border-cyan-500/30">
                          {st.staff_role}
                        </span>
                      </div>
                      <span className={`block mt-0.5 ${textMuted}`}>{st.email}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        disabled={st.staff_role === 'head_coach'}
                        onClick={() => handleToggleStaffPerm(st, 'can_edit_workouts')}
                        className={`px-3 py-1.5 rounded-xl font-bold border ${
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
                        className={`px-3 py-1.5 rounded-xl font-bold border ${
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
                          className="p-2 rounded-xl text-slate-400 hover:text-rose-500"
                        >
                          <Trash2 className="h-4 w-4" />
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