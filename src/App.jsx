import React, { useState, useEffect, useRef, useCallback } from "react";
import { Home, ShoppingCart, ScanLine, X, Plus, Trash2, Check, Package, ChevronRight, ChevronLeft, AlertCircle, Settings, Loader2, Tag, ChevronDown, HelpCircle, History, CheckSquare, Square, Calendar as CalendarIcon, Search, LogIn, LogOut, Cloud, CloudOff } from "lucide-react";
import { storage, subscribeAuth, signIn, signOutUser, syncOnLogin, isFirebaseConfigured, isEmailAllowed } from "./storage";

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@500;700;900&family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap');`;

const GENRES = ["食品・飲料", "洗面・バス用品", "掃除・洗濯用品", "医薬品・衛生用品", "キッチン用品", "ペット用品", "その他"];

const ICON_SHAPES = [
  { key: "bottle", label: "ボトル" },
  { key: "jar", label: "ジャー" },
  { key: "box", label: "ボックス" },
  { key: "tube", label: "チューブ" },
  { key: "pouch", label: "パウチ" },
  { key: "circle", label: "円グラフ" },
];

const haptics = {
  light: () => {
    try {
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(18);
    } catch (e) {}
  },
  medium: () => {
    try {
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(30);
    } catch (e) {}
  },
  success: () => {
    try {
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(40);
    } catch (e) {}
  },
  warning: () => {
    try {
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([25, 40, 25]);
    } catch (e) {}
  },
};

const COLORS = {
  bg: "var(--color-bg)",
  card: "var(--color-card)",
  ink: "var(--color-ink)",
  inkSoft: "var(--color-ink-soft)",
  line: "var(--color-line)",
  safe: "var(--color-safe)",
  safeBg: "var(--color-safe-bg)",
  warn: "var(--color-warn)",
  warnBg: "var(--color-warn-bg)",
  danger: "var(--color-danger)",
  dangerBg: "var(--color-danger-bg)",
  navy: "var(--color-navy)",
  bottleCap: "var(--color-bottle-cap)",
  bottleBody: "var(--color-bottle-body)",
  bottleStroke: "var(--color-bottle-stroke)",
  overlay: "var(--color-overlay)",
};

const THEME_STYLE = `
  :root {
    --color-bg: #F3F5F0;
    --color-card: #FFFFFF;
    --color-ink: #202B24;
    --color-ink-soft: #5C6B60;
    --color-line: #E3E7DF;
    --color-safe: #4F7A5D;
    --color-safe-bg: #E7EFE7;
    --color-warn: #C98A2E;
    --color-warn-bg: #FBEFD9;
    --color-danger: #BE4B39;
    --color-danger-bg: #F8E4DF;
    --color-navy: #2F4858;
    --color-bottle-cap: #B9C2BB;
    --color-bottle-body: #EDF0EA;
    --color-bottle-stroke: #D3DACD;
    --color-overlay: rgba(32,43,36,0.55);
  }
  [data-theme="dark"] {
    --color-bg: #161A17;
    --color-card: #1F241F;
    --color-ink: #E9EDE7;
    --color-ink-soft: #96A196;
    --color-line: #333A32;
    --color-safe: #74B587;
    --color-safe-bg: #223028;
    --color-warn: #E3B15E;
    --color-warn-bg: #362C1C;
    --color-danger: #E38670;
    --color-danger-bg: #392420;
    --color-navy: #6C93AC;
    --color-bottle-cap: #4A544B;
    --color-bottle-body: #262C26;
    --color-bottle-stroke: #3A423A;
    --color-overlay: rgba(0,0,0,0.65);
  }
`;

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const todayISO = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const nowStamp = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${day}T${hh}:${mi}:${ss}`;
};
const formatStamp = (stamp) => {
  const [datePart, timePart] = stamp.split("T");
  return timePart ? `${datePart} ${timePart.slice(0, 5)}` : datePart;
};
const formatDateObj = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const addDays = (iso, days) => {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d;
};
const daysBetween = (targetDate) => {
  const now = new Date();
  const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const t1 = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  return Math.round((t1 - t0) / 86400000);
};
const calcWarnDays = (cycleDays, remainPercent) =>
  Math.max(2, Math.round((cycleDays || 0) * (remainPercent / 100)));

const isoDateDiff = (fromIso, toIso) => {
  const a = new Date(fromIso.slice(0, 10) + "T00:00:00");
  const b = new Date(toIso.slice(0, 10) + "T00:00:00");
  return Math.round((b - a) / 86400000);
};

// 履歴エントリは以前は日時の文字列だけだったが、今はバーコードも含むオブジェクト形式。
// 過去分（文字列のまま）にも対応できるよう、値を取り出すヘルパーを用意する
const getStamp = (entry) => (typeof entry === "string" ? entry : entry.stamp);
const getEntryBarcode = (entry) => (typeof entry === "string" ? null : entry.barcode || null);

// 履歴（購入日の並び）から、平均の間隔日数を推定する。2件未満なら推定できない
const estimateCycleFromHistory = (history) => {
  if (!history || history.length < 2) return null;
  const gaps = [];
  for (let i = 1; i < history.length; i++) {
    const g = isoDateDiff(getStamp(history[i - 1]), getStamp(history[i]));
    if (g > 0) gaps.push(g);
  }
  if (gaps.length === 0) return null;
  const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  return Math.max(1, Math.round(avg));
};

// 「買った」を記録する際、履歴に追記し、必要なら目安日数を自動推定する
const buildPurchaseUpdate = (item, warnPercent, barcode) => {
  const today = todayISO();
  const history = [...(item.history || []), { stamp: nowStamp(), barcode: barcode || null }];
  const update = {
    lastPurchaseDate: today,
    extensionDays: 0,
    history,
  };
  if (item.cycleDays == null) {
    const estimated = estimateCycleFromHistory(history);
    if (estimated != null) {
      update.cycleDays = estimated;
      update.warningDays = calcWarnDays(estimated, warnPercent);
      update.estimated = true;
    }
  }
  return update;
};

// モーダルを閉じる際、退場アニメーションが終わるまで少しだけ表示を保持するためのフック
function useLingering(value, duration = 220) {
  const [display, setDisplay] = useState(value);
  const [closing, setClosing] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (value) {
      clearTimeout(timerRef.current);
      setDisplay(value);
      setClosing(false);
    } else if (display) {
      setClosing(true);
      timerRef.current = setTimeout(() => {
        setDisplay(null);
        setClosing(false);
      }, duration);
    }
    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return [display, closing];
}

// Android等の「戻る」ボタンで、ページ遷移ではなくモーダルを閉じるようにするフック
function useHistoryBack(isOpen, onClose) {
  const openRef = useRef(false);
  const closingViaPopRef = useRef(false);

  useEffect(() => {
    if (isOpen && !openRef.current) {
      window.history.pushState({ __modal: true }, "");
      openRef.current = true;
    } else if (!isOpen && openRef.current) {
      openRef.current = false;
      if (!closingViaPopRef.current) {
        window.history.back();
      }
      closingViaPopRef.current = false;
    }
  }, [isOpen]);

  useEffect(() => {
    const handler = () => {
      if (openRef.current) {
        openRef.current = false;
        closingViaPopRef.current = true;
        onClose();
      }
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);
}

function statusOf(item) {
  if (item.trackMode === "expiry" && item.expiryDate) {
    const daysLeft = isoDateDiff(todayISO(), item.expiryDate);
    const totalSpan = item.lastPurchaseDate ? isoDateDiff(item.lastPurchaseDate, item.expiryDate) : null;
    const totalCycle = totalSpan && totalSpan > 0 ? totalSpan : null;
    const warnDays = item.expiryWarnDays != null ? item.expiryWarnDays : 3;
    if (daysLeft <= 0) return { level: "danger", daysLeft, totalCycle };
    if (daysLeft <= warnDays) return { level: "warn", daysLeft, totalCycle };
    return { level: "safe", daysLeft, totalCycle };
  }
  if (item.cycleDays == null) {
    return { level: "unknown", daysLeft: null, totalCycle: null };
  }
  const spareCycles = (item.spareStock || 0) * item.cycleDays;
  const totalCycle = item.cycleDays + (item.extensionDays || 0) + spareCycles;
  const due = addDays(item.lastPurchaseDate, totalCycle);
  const daysLeft = daysBetween(due);
  if (daysLeft <= 0) return { level: "danger", daysLeft, totalCycle };
  if (daysLeft <= item.warningDays) return { level: "warn", daysLeft, totalCycle };
  return { level: "safe", daysLeft, totalCycle };
}

function Bottle({ level, ratio, shape }) {
  const palette = {
    safe: COLORS.safe,
    warn: COLORS.warn,
    danger: COLORS.danger,
  };
  const fillColor = palette[level];
  const clamped = Math.max(0, Math.min(1, ratio));
  const shapeKey = shape || "bottle";

  if (level === "unknown") {
    return (
      <svg width="26" height="40" viewBox="0 0 26 40" style={{ flexShrink: 0 }}>
        <rect x="9" y="0" width="8" height="6" rx="1.5" fill={COLORS.bottleCap} />
        <rect x="7" y="5" width="12" height="4" rx="1" fill={COLORS.bottleCap} />
        <rect
          x="2"
          y="9"
          width="22"
          height="30"
          rx="6"
          fill={COLORS.bottleBody}
          stroke={COLORS.bottleStroke}
          strokeWidth="1"
          strokeDasharray="3 3"
        />
        <text x="13" y="28" textAnchor="middle" fontSize="13" fontWeight="700" fill={COLORS.inkSoft}>
          ?
        </text>
      </svg>
    );
  }

  const uid = `${shapeKey}-${level}-${Math.round(clamped * 100)}`;

  if (shapeKey === "jar") {
    const h = 21;
    const fillH = Math.max(2, h * clamped);
    return (
      <svg width="34" height="30" viewBox="0 0 32 28" style={{ flexShrink: 0 }}>
        <rect x="6" y="0" width="20" height="5" rx="2" fill={COLORS.bottleCap} />
        <clipPath id={`c-${uid}`}>
          <rect x="2" y="5" width="28" height="21" rx="7" />
        </clipPath>
        <rect x="2" y="5" width="28" height="21" rx="7" fill={COLORS.bottleBody} stroke={COLORS.bottleStroke} strokeWidth="1" />
        <g clipPath={`url(#c-${uid})`}>
          <rect x="2" y={26 - fillH} width="28" height={fillH} fill={fillColor} opacity="0.85" />
        </g>
      </svg>
    );
  }

  if (shapeKey === "box") {
    const h = 24;
    const fillH = Math.max(2, h * clamped);
    return (
      <svg width="34" height="30" viewBox="0 0 32 28" style={{ flexShrink: 0 }}>
        <clipPath id={`c-${uid}`}>
          <rect x="2" y="2" width="28" height="24" rx="4" />
        </clipPath>
        <rect x="2" y="2" width="28" height="24" rx="4" fill={COLORS.bottleBody} stroke={COLORS.bottleStroke} strokeWidth="1" />
        <g clipPath={`url(#c-${uid})`}>
          <rect x="2" y={26 - fillH} width="28" height={fillH} fill={fillColor} opacity="0.85" />
        </g>
        <line x1="2" y1="9" x2="30" y2="9" stroke={COLORS.bottleStroke} strokeWidth="1" opacity="0.6" />
      </svg>
    );
  }

  if (shapeKey === "tube") {
    const path = "M6 5 L14 5 L16 12 L16 34 Q16 38 10 38 Q4 38 4 34 L4 12 Z";
    const h = 33;
    const fillH = Math.max(2, h * clamped);
    return (
      <svg width="24" height="46" viewBox="0 0 20 40" style={{ flexShrink: 0 }}>
        <rect x="7" y="0" width="6" height="5" rx="1.5" fill={COLORS.bottleCap} />
        <path d={path} fill={COLORS.bottleBody} stroke={COLORS.bottleStroke} strokeWidth="1" />
        <clipPath id={`c-${uid}`}>
          <path d={path} />
        </clipPath>
        <g clipPath={`url(#c-${uid})`}>
          <rect x="4" y={38 - fillH} width="12" height={fillH} fill={fillColor} opacity="0.85" />
        </g>
      </svg>
    );
  }

  if (shapeKey === "pouch") {
    const path = "M4 4 Q2 2 4 1 L22 1 Q24 2 22 4 L24 24 Q24 29 13 29 Q2 29 2 24 Z";
    const h = 25;
    const fillH = Math.max(2, h * clamped);
    return (
      <svg width="30" height="34" viewBox="0 0 26 30" style={{ flexShrink: 0 }}>
        <path d={path} fill={COLORS.bottleBody} stroke={COLORS.bottleStroke} strokeWidth="1" />
        <clipPath id={`c-${uid}`}>
          <path d={path} />
        </clipPath>
        <g clipPath={`url(#c-${uid})`}>
          <rect x="2" y={29 - fillH} width="22" height={fillH} fill={fillColor} opacity="0.85" />
        </g>
      </svg>
    );
  }

  if (shapeKey === "circle") {
    const r = 12;
    const circumference = 2 * Math.PI * r;
    const dash = circumference * clamped;
    return (
      <svg width="30" height="30" viewBox="0 0 28 28" style={{ flexShrink: 0 }}>
        <circle cx="14" cy="14" r={r} fill={COLORS.bottleBody} stroke={COLORS.bottleStroke} strokeWidth="1" />
        <circle
          cx="14"
          cy="14"
          r={r}
          fill="none"
          stroke={fillColor}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          transform="rotate(-90 14 14)"
          opacity="0.9"
        />
      </svg>
    );
  }

  // デフォルト：ボトル
  const h = 34;
  const fillH = Math.max(2, h * clamped);
  return (
    <svg width="26" height="40" viewBox="0 0 26 40" style={{ flexShrink: 0 }}>
      <rect x="9" y="0" width="8" height="6" rx="1.5" fill={COLORS.bottleCap} />
      <rect x="7" y="5" width="12" height="4" rx="1" fill={COLORS.bottleCap} />
      <clipPath id={`c-${uid}`}>
        <rect x="2" y="9" width="22" height="30" rx="6" />
      </clipPath>
      <rect x="2" y="9" width="22" height="30" rx="6" fill={COLORS.bottleBody} stroke={COLORS.bottleStroke} strokeWidth="1" />
      <g clipPath={`url(#c-${uid})`}>
        <rect x="2" y={39 - fillH} width="22" height={fillH} fill={fillColor} opacity="0.85" />
      </g>
    </svg>
  );
}

function IconShapeGrid({ value, onChange }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
      {ICON_SHAPES.map((s) => (
        <button
          key={s.key}
          type="button"
          onClick={() => {
            haptics.light();
            onChange(s.key);
          }}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
            padding: "10px 4px",
            borderRadius: 12,
            border: `1px solid ${value === s.key ? COLORS.navy : COLORS.line}`,
            background: value === s.key ? COLORS.safeBg : COLORS.card,
          }}
        >
          <Bottle level="safe" ratio={0.75} shape={s.key} />
          <span style={{ fontSize: 10.5, fontWeight: 700, color: COLORS.inkSoft }}>{s.label}</span>
        </button>
      ))}
    </div>
  );
}

function CalendarDots({ level, ratio }) {
  const palette = { safe: COLORS.safe, warn: COLORS.warn, danger: COLORS.danger };
  const bgPalette = { safe: COLORS.safeBg, warn: COLORS.warnBg, danger: COLORS.dangerBg };
  const dotColor = palette[level] || COLORS.inkSoft;
  const bodyFill = bgPalette[level] || COLORS.bg;
  const total = 6;
  const cols = 3;
  const rows = 2;
  const boxW = 28;
  const boxH = 28;
  const padX = 4;
  const padTop = 8;
  const padBottom = 4;
  const cellW = (boxW - padX * 2) / cols;
  const cellH = (boxH - padTop - padBottom) / rows;
  const dotSize = Math.min(cellW, cellH) * 0.62;
  const dotRadius = dotSize * 0.3;
  const clampedRatio = Math.max(0, Math.min(1, ratio));
  const lit = Math.min(total, Math.max(1, Math.round(total * (1 - clampedRatio))));

  const dots = [];
  for (let i = 0; i < total; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = padX + cellW * (col + 0.5);
    const cy = padTop + cellH * (row + 0.5);
    dots.push(
      <rect
        key={i}
        x={cx - dotSize / 2}
        y={cy - dotSize / 2}
        width={dotSize}
        height={dotSize}
        rx={dotRadius}
        fill={i < lit ? dotColor : "rgba(0,0,0,0.15)"}
      />
    );
  }

  return (
    <svg width="27" height="27" viewBox={`0 0 ${boxW} ${boxH}`} style={{ flexShrink: 0 }}>
      <rect
        x="1"
        y="1"
        width={boxW - 2}
        height={boxH - 2}
        rx="6"
        fill={bodyFill}
        fillOpacity="0.5"
        stroke={dotColor}
        strokeWidth="1"
        strokeOpacity="0.45"
      />
      <line x1="1" y1={padTop - 2} x2={boxW - 1} y2={padTop - 2} stroke={dotColor} strokeWidth="1" opacity="0.25" />
      {dots}
    </svg>
  );
}

function StatusIcon({ item }) {
  const ratio = item.totalCycle > 0 ? item.daysLeft / item.totalCycle : 0;
  if (item.trackMode === "expiry") {
    return <CalendarDots level={item.level} ratio={ratio} />;
  }
  return <Bottle level={item.level} ratio={ratio} shape={item.iconShape || "bottle"} />;
}

function ThemeShell({ darkMode, children }) {
  return (
    <div
      data-theme={darkMode ? "dark" : "light"}
      style={{
        fontFamily: "'Zen Kaku Gothic New', sans-serif",
        background: COLORS.bg,
        minHeight: "100vh",
        color: COLORS.ink,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        maxWidth: 480,
        margin: "0 auto",
        padding: "0 24px",
        transition: "background-color 0.2s ease, color 0.2s ease",
      }}
    >
      <style>{`
        ${FONT_IMPORT}
        ${THEME_STYLE}
        * { box-sizing: border-box; }
        button { font-family: inherit; cursor: pointer; }
      `}</style>
      {children}
    </div>
  );
}

function SplashScreen({ darkMode }) {
  return (
    <ThemeShell darkMode={darkMode}>
      <div style={{ fontSize: 13, color: COLORS.inkSoft }}>読み込み中…</div>
    </ThemeShell>
  );
}

function LoginGate({ darkMode, onSignIn }) {
  return (
    <ThemeShell darkMode={darkMode}>
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 20,
          background: COLORS.navy,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 20,
        }}
      >
        <Package size={34} color="#fff" />
      </div>
      <h1
        style={{
          fontFamily: "'Zen Maru Gothic', sans-serif",
          fontWeight: 900,
          fontSize: 22,
          margin: 0,
          color: COLORS.navy,
          textAlign: "center",
        }}
      >
        つかいきりノート
      </h1>
      <p style={{ fontSize: 13, color: COLORS.inkSoft, textAlign: "center", marginTop: 8, marginBottom: 32, lineHeight: 1.7 }}>
        日用品の在庫や買い物リストは個人的な内容なので、
        <br />
        ログインしてから表示します
      </p>
      <button
        onClick={onSignIn}
        style={{
          width: "100%",
          padding: "14px 0",
          borderRadius: 12,
          border: "none",
          background: COLORS.navy,
          color: "#fff",
          fontWeight: 700,
          fontSize: 15,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        <LogIn size={18} /> Googleでログイン
      </button>
    </ThemeShell>
  );
}

function NotAuthorized({ email, darkMode, onBack }) {
  return (
    <ThemeShell darkMode={darkMode}>
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 20,
          background: COLORS.dangerBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 20,
        }}
      >
        <AlertCircle size={34} color={COLORS.danger} />
      </div>
      <h1
        style={{
          fontFamily: "'Zen Maru Gothic', sans-serif",
          fontWeight: 900,
          fontSize: 20,
          margin: 0,
          color: COLORS.danger,
          textAlign: "center",
        }}
      >
        認証されていないため
        <br />
        表示できません
      </h1>
      <p style={{ fontSize: 13, color: COLORS.inkSoft, textAlign: "center", marginTop: 10, marginBottom: 8, lineHeight: 1.7 }}>
        {email ? (
          <>
            <span style={{ fontWeight: 700 }}>{email}</span> は
            <br />
            このアプリの利用を許可されていません。
          </>
        ) : (
          "このアカウントはこのアプリの利用を許可されていません。"
        )}
      </p>
      <p style={{ fontSize: 12, color: COLORS.inkSoft, textAlign: "center", marginBottom: 32, lineHeight: 1.7 }}>
        自動的にログアウトしました。
        <br />
        許可されたアカウントでログインし直してください。
      </p>
      <button
        onClick={onBack}
        style={{
          width: "100%",
          padding: "14px 0",
          borderRadius: 12,
          border: "none",
          background: COLORS.navy,
          color: "#fff",
          fontWeight: 700,
          fontSize: 15,
        }}
      >
        ログイン画面に戻る
      </button>
    </ThemeShell>
  );
}

export default function App() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("home");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanUnsupported, setScanUnsupported] = useState(false);
  const [scanStatus, setScanStatus] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [scannedCode, setScannedCode] = useState(null);
  const [unknownStep, setUnknownStep] = useState(null); // null | 'choose' | 'new' | 'link'
  const [pendingKnown, setPendingKnown] = useState(null); // item awaiting confirmation
  const [stockChoiceItem, setStockChoiceItem] = useState(null); // safe-status item awaiting stock-vs-used choice
  const [pendingLinkTarget, setPendingLinkTarget] = useState(null); // item chosen in "link as replacement" flow, awaiting memo
  const [pendingLinkMemo, setPendingLinkMemo] = useState("");
  const [stockQtyMode, setStockQtyMode] = useState(false);
  const [stockQty, setStockQty] = useState(1);
  const [stockPopup, setStockPopup] = useState(null); // number to show in the +N celebration popup
  const [newName, setNewName] = useState("");
  const [newCycle, setNewCycle] = useState("30");
  const [newWarn, setNewWarn] = useState("3");
  const [newGenre, setNewGenre] = useState(GENRES[0]);
  const [newCycleUnknown, setNewCycleUnknown] = useState(false);
  const [newTrackMode, setNewTrackMode] = useState("cycle");
  const [newIconShape, setNewIconShape] = useState("bottle");
  const [newBarcodeMemo, setNewBarcodeMemo] = useState("");
  const [newExpiryDate, setNewExpiryDate] = useState("");
  const [newExpiryWarnDays, setNewExpiryWarnDays] = useState("3");
  const [pendingExpiryInput, setPendingExpiryInput] = useState("");
  const [editingItem, setEditingItem] = useState(null);
  const [editingContext, setEditingContext] = useState("home"); // 'home' | 'shopping'
  const [extendingItem, setExtendingItem] = useState(null);
  const [extendDays, setExtendDays] = useState("7");
  const [toast, setToast] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [cycleAdoptPrompt, setCycleAdoptPrompt] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [yahooAppId, setYahooAppId] = useState("");
  const [warnPercent, setWarnPercent] = useState(20);
  const [lookup, setLookup] = useState({ loading: false, ok: false, error: null });
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(!isFirebaseConfigured);
  const [unauthorizedEmail, setUnauthorizedEmail] = useState(null);
  const [syncing, setSyncing] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const detectorRef = useRef(null);
  const quaggaContainerRef = useRef(null);
  const quaggaActiveRef = useRef(false);
  const quaggaModuleRef = useRef(null);

  const loadAllFromStorage = useCallback(async () => {
    try {
      const res = await storage.get("household-items");
      if (res && res.value) setItems(JSON.parse(res.value));
    } catch (e) {
      // no existing data yet
    }
    try {
      const res = await storage.get("yahoo-app-id");
      if (res && res.value) setYahooAppId(res.value);
    } catch (e) {
      // not set yet
    }
    try {
      const res = await storage.get("warn-percent");
      if (res && res.value) setWarnPercent(parseInt(res.value, 10) || 20);
    } catch (e) {
      // not set yet, keep default
    }
    try {
      const res = await storage.get("dark-mode");
      if (res && res.value) setDarkMode(res.value === "true");
    } catch (e) {
      // not set yet, keep default
    }
  }, []);

  useEffect(() => {
    (async () => {
      await loadAllFromStorage();
      setLoading(false);
    })();
  }, [loadAllFromStorage]);

  useEffect(() => {
    const unsubscribe = subscribeAuth((nextUser, ready) => {
      setAuthReady(ready);
      if (nextUser && !isEmailAllowed(nextUser.email)) {
        setUnauthorizedEmail(nextUser.email);
        setUser(null);
        signOutUser();
        return;
      }
      setUser(nextUser);
      if (nextUser) {
        setUnauthorizedEmail(null);
        setSyncing(true);
        syncOnLogin()
          .then(() => loadAllFromStorage())
          .then(() => {
            showToast("クラウドと同期しました");
            haptics.success();
          })
          .finally(() => setSyncing(false));
      }
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  const handleSignIn = async () => {
    try {
      await signIn();
      haptics.success();
    } catch (e) {
      console.error("ログインに失敗しました", e);
      showToast("ログインに失敗しました");
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
      haptics.light();
      showToast("ログアウトしました");
    } catch (e) {
      console.error("ログアウトに失敗しました", e);
    }
  };

  const saveYahooAppId = async (value) => {
    setYahooAppId(value);
    try {
      await storage.set("yahoo-app-id", value);
      haptics.success();
    } catch (e) {
      console.error("appidの保存に失敗しました", e);
    }
  };

  const saveWarnPercent = async (percent) => {
    setWarnPercent(percent);
    try {
      await storage.set("warn-percent", String(percent));
      haptics.success();
    } catch (e) {
      console.error("設定の保存に失敗しました", e);
    }
  };

  const toggleDarkMode = async (value) => {
    setDarkMode(value);
    haptics.light();
    try {
      await storage.set("dark-mode", String(value));
    } catch (e) {
      console.error("設定の保存に失敗しました", e);
    }
  };

  const applyWarnPercentToAll = (percent) => {
    const next = items.map((it) => ({
      ...it,
      warningDays: calcWarnDays(it.cycleDays, percent),
    }));
    persist(next);
    showToast(`全${next.length}件に反映しました`);
    haptics.success();
  };

  const lookupByJan = useCallback(
    async (code) => {
      if (!yahooAppId) return;
      setLookup({ loading: true, ok: false, error: null });
      try {
        const url = `https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch?appid=${encodeURIComponent(
          yahooAppId
        )}&jan_code=${encodeURIComponent(code)}&results=1`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const hit = data?.hits?.[0];
        if (hit) {
          if (hit.name) setNewName(hit.name);
          const genreName = hit.genreCategory?.name;
          if (genreName) {
            const matched = GENRES.find((g) => genreName.includes(g.slice(0, 2)));
            setNewGenre(matched || "その他");
          }
          setLookup({ loading: false, ok: true, error: null });
        } else {
          setLookup({ loading: false, ok: false, error: "見つかりませんでした" });
        }
      } catch (e) {
        setLookup({ loading: false, ok: false, error: "取得できませんでした（手入力してください）" });
      }
    },
    [yahooAppId]
  );

  const persist = useCallback(async (next) => {
    setItems(next);
    try {
      await storage.set("household-items", JSON.stringify(next));
    } catch (e) {
      console.error("保存に失敗しました", e);
    }
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const stopCamera = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (quaggaActiveRef.current) {
      quaggaActiveRef.current = false;
      if (quaggaModuleRef.current) {
        try {
          quaggaModuleRef.current.offDetected();
          quaggaModuleRef.current.stop();
        } catch (e) {}
      } else {
        // まだモジュールを読み込んでいない場合のみ、念のため非同期経路でも試す
        import("@ericblade/quagga2").then(({ default: Quagga }) => {
          try {
            Quagga.offDetected();
            Quagga.stop();
          } catch (e) {}
        });
      }
    }
    if (quaggaContainerRef.current) {
      quaggaContainerRef.current.innerHTML = "";
    }
  }, []);

  const closeScan = () => {
    stopCamera();
    setScanning(false);
    setScannedCode(null);
    setScanStatus("");
    setUnknownStep(null);
    setPendingKnown(null);
    setStockChoiceItem(null);
    setPendingLinkTarget(null);
    setPendingLinkMemo("");
    setStockQtyMode(false);
    setManualCode("");
    setNewName("");
    setNewCycle("30");
    setNewWarn(String(calcWarnDays(30, warnPercent)));
    setNewGenre(GENRES[0]);
    setNewCycleUnknown(false);
    setNewTrackMode("cycle");
    setNewIconShape("bottle");
    setNewBarcodeMemo("");
    setNewExpiryDate("");
    setNewExpiryWarnDays("3");
    setPendingExpiryInput("");
    setLookup({ loading: false, ok: false, error: null });
  };

  const handleNewCycleChange = (value) => {
    setNewCycle(value);
    const days = parseInt(value, 10);
    if (days > 0) setNewWarn(String(calcWarnDays(days, warnPercent)));
  };

  const handleDetected = useCallback(
    (code) => {
      stopCamera();
      haptics.medium();
      setScannedCode(code);
      const owner = items.find((it) => it.barcodes.includes(code));
      if (owner) {
        const status = statusOf(owner);
        if (owner.trackMode !== "expiry" && owner.cycleDays != null && status.level === "safe") {
          setStockChoiceItem({ ...owner, ...status });
        } else {
          setPendingKnown(owner);
        }
      } else {
        setUnknownStep("choose");
        lookupByJan(code);
      }
    },
    [items, persist, stopCamera, lookupByJan]
  );

  useEffect(() => {
    if (!scanning) return;
    let cancelled = false;
    (async () => {
      if ("BarcodeDetector" in window) {
        setScanUnsupported(false);
        setScanStatus("カメラ起動中…");
        try {
          detectorRef.current = new window.BarcodeDetector({
            formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"],
          });
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
          });
          if (cancelled) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
          }
          setScanStatus("読み取り中…");
          intervalRef.current = setInterval(async () => {
            if (!videoRef.current || !detectorRef.current) return;
            try {
              const codes = await detectorRef.current.detect(videoRef.current);
              if (codes && codes.length > 0) {
                handleDetected(codes[0].rawValue);
              }
            } catch (e) {
              // ignore transient detection errors
            }
          }, 350);
        } catch (e) {
          setScanStatus(`エラー: ${e?.message || "カメラを起動できませんでした"}`);
          setScanUnsupported(true);
        }
        return;
      }

      // BarcodeDetector未対応（主にiOS Safari）: Quagga2でフォールバック
      setScanStatus("読み取りライブラリを準備中…");
      try {
        let Quagga = quaggaModuleRef.current;
        if (!Quagga) {
          const mod = await import("@ericblade/quagga2");
          Quagga = mod.default;
          quaggaModuleRef.current = Quagga;
        }
        if (cancelled) return;
        if (!quaggaContainerRef.current) {
          setScanStatus("エラー: 表示領域を初期化できませんでした");
          setScanUnsupported(true);
          return;
        }
        setScanUnsupported(false);
        setScanStatus("カメラ起動中…");

        const quaggaConfig = {
          inputStream: {
            type: "LiveStream",
            target: quaggaContainerRef.current,
            constraints: {
              facingMode: "environment",
              width: { min: 640, ideal: 1280 },
              height: { min: 480, ideal: 720 },
            },
          },
          locator: {
            patchSize: "medium",
            halfSample: true,
          },
          numOfWorkers: 2,
          frequency: 10,
          decoder: {
            readers: [
              "ean_reader",
              "ean_8_reader",
              "code_128_reader",
              "code_39_reader",
              "upc_reader",
              "upc_e_reader",
            ],
          },
          locate: true,
        };

        const startAfterReady = () => {
          // iOS Safari対策：video要素に実際のフレームが来るまで解析を始めない
          const videoEl = quaggaContainerRef.current?.querySelector("video");
          const waitForVideoReady = () =>
            new Promise((resolve) => {
              const check = () => {
                if (cancelled) {
                  resolve();
                  return;
                }
                if (videoEl && videoEl.readyState >= 2 && videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
                  resolve();
                } else {
                  requestAnimationFrame(check);
                }
              };
              check();
            });
          waitForVideoReady().then(() => {
            if (cancelled) return;
            quaggaActiveRef.current = true;
            Quagga.start();
            setScanStatus("読み取り中…（バーコードに10〜15cmまで近づけてください）");
          });
        };

        const tryInit = (isRetry) => {
          Quagga.init(quaggaConfig, (err) => {
            if (cancelled) return;
            if (err) {
              console.error("Quagga init error", err);
              if (!isRetry) {
                // 前回セッションの後片付けが間に合っていない可能性があるため、
                // 一度defensiveにstopしてから1回だけ再試行する
                try {
                  Quagga.stop();
                } catch (e2) {}
                setTimeout(() => {
                  if (!cancelled) tryInit(true);
                }, 200);
                return;
              }
              setScanStatus(`エラー: ${err?.message || "カメラを起動できませんでした"}`);
              setScanUnsupported(true);
              return;
            }
            startAfterReady();
          });
        };

        tryInit(false);
        Quagga.onDetected((result) => {
          if (cancelled) return;
          const code = result?.codeResult?.code;
          if (code) handleDetected(code);
        });
      } catch (e) {
        if (!cancelled) {
          console.error("Quagga load error", e);
          setScanStatus(`エラー: ${e?.message || "読み取りライブラリを読み込めませんでした"}`);
          setScanUnsupported(true);
        }
      }
    })();
    return () => {
      cancelled = true;
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning]);

  const openScan = () => {
    setScanning(true);
    setUnknownStep(null);
    setScannedCode(null);
    setNewWarn(String(calcWarnDays(parseInt(newCycle, 10) || 30, warnPercent)));
  };

  const openManualRegister = () => {
    haptics.light();
    setScanning(true);
    setUnknownStep("new");
    setScannedCode(null);
    setNewWarn(String(calcWarnDays(parseInt(newCycle, 10) || 30, warnPercent)));
  };

  const submitManualCode = () => {
    if (!manualCode.trim()) return;
    handleDetected(manualCode.trim());
  };

  const applyPurchase = (item, extraFields = {}, barcode = null) => {
    if (item.trackMode === "expiry") {
      const history = [...(item.history || []), { stamp: nowStamp(), barcode: barcode || null }];
      const next = items.map((it) => (it.id === item.id ? { ...it, lastPurchaseDate: todayISO(), history, ...extraFields } : it));
      persist(next);
      haptics.success();
      return;
    }
    const provisional = buildPurchaseUpdate(item, warnPercent, barcode);
    const isNewlyEstimated = item.cycleDays == null && provisional.cycleDays != null;
    if (isNewlyEstimated) {
      const { cycleDays, warningDays, estimated, ...rest } = provisional;
      const next = items.map((it) => (it.id === item.id ? { ...it, ...rest, ...extraFields } : it));
      persist(next);
      setCycleAdoptPrompt({
        itemId: item.id,
        itemName: item.name,
        estimatedCycle: cycleDays,
        estimatedWarn: warningDays,
      });
    } else {
      const next = items.map((it) => (it.id === item.id ? { ...it, ...provisional, ...extraFields } : it));
      persist(next);
    }
    haptics.success();
  };

  const confirmKnownReset = () => {
    if (!pendingKnown) return;
    if (pendingKnown.trackMode === "expiry" && !pendingExpiryInput) return;
    applyPurchase(
      pendingKnown,
      pendingKnown.trackMode === "expiry" ? { expiryDate: pendingExpiryInput } : {},
      scannedCode
    );
    showToast(`「${pendingKnown.name}」を補充として記録しました`);
    closeScan();
  };

  const cancelKnownReset = () => {
    setPendingKnown(null);
    setScannedCode(null);
    closeScan();
  };

  const triggerStockPopup = (n) => {
    const key = Date.now() + Math.random();
    setStockPopup({ key, amount: n });
    setTimeout(() => {
      setStockPopup((cur) => (cur && cur.key === key ? null : cur));
    }, 700);
  };

  const goStockQty = () => {
    haptics.light();
    setStockQty(1);
    setStockQtyMode(true);
  };

  const incrementStockQty = () => {
    haptics.light();
    setStockQty((q) => q + 1);
  };

  const decrementStockQty = () => {
    haptics.light();
    setStockQty((q) => Math.max(1, q - 1));
  };

  const backToStockChoice = () => {
    haptics.light();
    setStockQtyMode(false);
  };

  const confirmStockQty = () => {
    if (!stockChoiceItem) return;
    const qty = stockQty;
    const next = items.map((it) =>
      it.id === stockChoiceItem.id ? { ...it, spareStock: (it.spareStock || 0) + qty } : it
    );
    persist(next);
    showToast(`「${stockChoiceItem.name}」を予備在庫として+${qty}しました`);
    haptics.success();
    triggerStockPopup(qty);
    setStockChoiceItem(null);
    setStockQtyMode(false);
    closeScan();
  };

  const proceedStockChoiceAsUsedUp = () => {
    if (!stockChoiceItem) return;
    setPendingKnown(stockChoiceItem);
    setStockChoiceItem(null);
  };

  const cancelStockChoice = () => {
    setStockChoiceItem(null);
    setStockQtyMode(false);
    setScannedCode(null);
    closeScan();
  };

  const registerNewItem = () => {
    if (!newName.trim()) return;
    if (newTrackMode === "expiry" && !newExpiryDate) return;
    const today = todayISO();
    const isExpiry = newTrackMode === "expiry";
    const item = {
      id: uid(),
      name: newName.trim(),
      genre: newGenre || "その他",
      barcodes: scannedCode ? [scannedCode] : [],
      cycleDays: isExpiry || newCycleUnknown ? null : Math.max(1, parseInt(newCycle, 10) || 30),
      warningDays: isExpiry || newCycleUnknown ? null : Math.max(0, parseInt(newWarn, 10) || 3),
      trackMode: newTrackMode,
      expiryDate: isExpiry ? newExpiryDate : null,
      expiryWarnDays: isExpiry ? Math.max(0, parseInt(newExpiryWarnDays, 10) || 3) : null,
      lastPurchaseDate: today,
      extensionDays: 0,
      spareStock: 0,
      warnMode: "percent",
      iconShape: newIconShape,
      barcodeMemos: scannedCode && newBarcodeMemo.trim() ? { [scannedCode]: newBarcodeMemo.trim() } : {},
      estimated: false,
      history: [{ stamp: nowStamp(), barcode: scannedCode || null }],
    };
    persist([...items, item]);
    showToast(`「${item.name}」を登録しました`);
    haptics.success();
    closeScan();
  };

  const handleRegisterClick = () => {
    if (!newName.trim()) return;
    const isDuplicate = items.some((it) => it.name.trim().toLowerCase() === newName.trim().toLowerCase());
    if (isDuplicate) {
      setUnknownStep("duplicateConfirm");
    } else {
      registerNewItem();
    }
  };

  const selectLinkTarget = (item) => {
    haptics.light();
    setPendingLinkTarget(item);
    setPendingLinkMemo("");
    setUnknownStep("linkMemo");
  };

  const confirmLinkWithMemo = () => {
    if (!pendingLinkTarget) return;
    linkToExisting(pendingLinkTarget.id, pendingLinkMemo);
    setPendingLinkTarget(null);
    setPendingLinkMemo("");
  };

  const skipLinkMemo = () => {
    if (!pendingLinkTarget) return;
    linkToExisting(pendingLinkTarget.id, "");
    setPendingLinkTarget(null);
    setPendingLinkMemo("");
  };

  const linkToExisting = (itemId, memo) => {
    const target = items.find((it) => it.id === itemId);
    if (!target) return;
    const trimmedMemo = (memo || "").trim();
    const newBarcodeMemos = trimmedMemo
      ? { ...(target.barcodeMemos || {}), [scannedCode]: trimmedMemo }
      : target.barcodeMemos || {};
    applyPurchase(
      target,
      { barcodes: [...new Set([...target.barcodes, scannedCode])], barcodeMemos: newBarcodeMemos },
      scannedCode
    );
    showToast(`「${target.name}」の買い替えとして記録しました`);
    closeScan();
  };

  const resetCycleManually = (id, newExpiryDateValue) => {
    const target = items.find((it) => it.id === id);
    if (!target) return;
    applyPurchase(target, target.trackMode === "expiry" ? { expiryDate: newExpiryDateValue || target.expiryDate } : {});
    showToast(`「${target.name}」を使い切りリセットしました`);
  };

  const openEditFromHome = (item) => {
    haptics.medium();
    setEditingItem(item);
    setEditingContext("home");
  };

  const openEditFromShopping = (item) => {
    haptics.medium();
    setEditingItem(item);
    setEditingContext("shopping");
  };

  const extendItem = (id, days) => {
    const n = parseInt(days, 10);
    if (!n || n <= 0) return;
    const next = items.map((it) =>
      it.id === id ? { ...it, extensionDays: (it.extensionDays || 0) + n } : it
    );
    persist(next);
    const target = items.find((it) => it.id === id);
    showToast(`「${target?.name}」の期限を ${n} 日延長しました`);
    haptics.success();
  };

  const deleteItem = (id) => {
    const target = items.find((it) => it.id === id);
    haptics.warning();
    persist(items.filter((it) => it.id !== id));
    if (target) showToast(`「${target.name}」を削除しました`);
    setEditingItem(null);
  };

  const updateItemFields = (id, fields) => {
    persist(items.map((it) => (it.id === id ? { ...it, ...fields } : it)));
    haptics.success();
    showToast(`「${fields.name || "商品"}」を保存しました`);
  };

  const deleteHistoryEntries = (itemId, dates) => {
    haptics.warning();
    const next = items.map((it) =>
      it.id === itemId ? { ...it, history: (it.history || []).filter((d) => !dates.includes(getStamp(d))) } : it
    );
    persist(next);
    showToast(`履歴を${dates.length}件削除しました`);
  };

  const adoptEstimatedCycle = () => {
    if (!cycleAdoptPrompt) return;
    const { itemId, estimatedCycle, estimatedWarn } = cycleAdoptPrompt;
    const next = items.map((it) =>
      it.id === itemId ? { ...it, cycleDays: estimatedCycle, warningDays: estimatedWarn, estimated: true } : it
    );
    persist(next);
    haptics.success();
    setCycleAdoptPrompt(null);
  };

  const declineEstimatedCycle = () => {
    haptics.light();
    setCycleAdoptPrompt(null);
  };

  const [displayEditingItem, editingClosing] = useLingering(editingItem);
  const [displayExtendingItem, extendingClosing] = useLingering(extendingItem);
  const [displayScanning, scanningClosing] = useLingering(scanning);
  const [displaySettings, settingsClosing] = useLingering(showSettings);
  const [displayHistory, historyClosing] = useLingering(showHistory);
  const [displayCalendar, calendarClosing] = useLingering(showCalendar);
  const [displayCycleAdopt, cycleAdoptClosing] = useLingering(cycleAdoptPrompt);

  useHistoryBack(!!editingItem, () => setEditingItem(null));
  useHistoryBack(!!extendingItem, () => {
    setExtendingItem(null);
    setExtendDays("7");
  });
  useHistoryBack(scanning, () => closeScan());
  useHistoryBack(showSettings, () => setShowSettings(false));
  useHistoryBack(showHistory, () => setShowHistory(false));
  useHistoryBack(showCalendar, () => setShowCalendar(false));

  const enriched = items
    .map((it) => {
      const status = statusOf(it);
      const ratio = status.level === "unknown" ? Infinity : status.totalCycle > 0 ? status.daysLeft / status.totalCycle : 0;
      return { ...it, ...status, ratio };
    })
    .sort((a, b) => a.ratio - b.ratio);
  const urgentCount = enriched.filter((it) => it.level !== "safe" && it.level !== "unknown").length;
  const searchedEnriched = searchQuery.trim()
    ? enriched.filter((it) => it.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : enriched;

  if (isFirebaseConfigured && unauthorizedEmail) {
    return (
      <NotAuthorized
        email={unauthorizedEmail}
        darkMode={darkMode}
        onBack={() => setUnauthorizedEmail(null)}
      />
    );
  }
  if (isFirebaseConfigured && !authReady) {
    return <SplashScreen darkMode={darkMode} />;
  }
  if (isFirebaseConfigured && !user) {
    return <LoginGate darkMode={darkMode} onSignIn={handleSignIn} />;
  }

  return (
    <div
      data-theme={darkMode ? "dark" : "light"}
      style={{
        fontFamily: "'Zen Kaku Gothic New', sans-serif",
        background: COLORS.bg,
        minHeight: "100vh",
        color: COLORS.ink,
        display: "flex",
        flexDirection: "column",
        maxWidth: 480,
        margin: "0 auto",
        position: "relative",
        transition: "background-color 0.2s ease, color 0.2s ease",
      }}
    >
      <style>{`
        ${FONT_IMPORT}
        ${THEME_STYLE}
        * { box-sizing: border-box; }
        button { font-family: inherit; cursor: pointer; }
        input { font-family: inherit; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes modalSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes modalSlideDown { from { transform: translateY(0); } to { transform: translateY(100%); } }
        @keyframes overlayFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes overlayFadeOut { from { opacity: 1; } to { opacity: 0; } }
        @keyframes pageSlideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes pageSlideOut { from { transform: translateX(0); } to { transform: translateX(100%); } }
        @keyframes bounceScale { 0% { transform: scale(1); } 35% { transform: scale(1.35); } 65% { transform: scale(0.92); } 100% { transform: scale(1); } }
        .quagga-scan-container video,
        .quagga-scan-container canvas {
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          max-width: none !important;
          max-height: none !important;
        }
        @keyframes stockPopup {
          0% { transform: scale(0.4); opacity: 0; }
          15% { transform: scale(1.15); opacity: 1; }
          30% { transform: scale(1); opacity: 1; }
          75% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1); opacity: 0; }
        }
        @keyframes dropDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes dropUp { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(-8px); } }
      `}</style>

      {/* Header */}
      <div style={{ padding: "22px 20px 14px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <h1
              style={{
                fontFamily: "'Zen Maru Gothic', sans-serif",
                fontWeight: 900,
                fontSize: 24,
                margin: 0,
                color: COLORS.navy,
                letterSpacing: 0.5,
              }}
            >
              つかいきりノート
            </h1>
          </div>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: COLORS.inkSoft }}>
            日用品を使い切る前に、そっと教えます
          </p>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            onClick={() => {
              haptics.light();
              setShowCalendar(true);
            }}
            style={{ border: "none", background: "none", color: COLORS.inkSoft, padding: 6, marginTop: 2 }}
          >
            <CalendarIcon size={22} />
          </button>
          <button
            onClick={() => {
              haptics.light();
              setShowHistory(true);
            }}
            style={{ border: "none", background: "none", color: COLORS.inkSoft, padding: 6, marginTop: 2 }}
          >
            <History size={22} />
          </button>
          <button
            onClick={() => setShowSettings(true)}
            style={{ border: "none", background: "none", color: COLORS.inkSoft, padding: 6, marginTop: 2 }}
          >
            <Settings size={22} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: "0 16px 96px", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 6 }}>
          {tab === "home" ? (
            <button
              type="button"
              onClick={openManualRegister}
              style={{
                border: "none",
                background: "none",
                color: COLORS.inkSoft,
                fontSize: 12,
                fontWeight: 700,
                padding: 4,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Plus size={15} /> バーコードなしで追加
            </button>
          ) : (
            <div />
          )}
          <button
            type="button"
            onClick={() => {
              haptics.light();
              setSearchOpen((o) => {
                const next = !o;
                if (!next) setSearchQuery("");
                return next;
              });
            }}
            style={{
              border: "none",
              background: "none",
              color: searchOpen ? COLORS.navy : COLORS.inkSoft,
              padding: 4,
              display: "flex",
            }}
          >
            <Search size={19} />
          </button>
        </div>
        {searchOpen && (
          <div style={{ animation: "dropDown 0.2s ease", marginBottom: 4 }}>
            <input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="商品名で検索"
              style={{ ...inputStyle, marginBottom: 10 }}
            />
          </div>
        )}
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: COLORS.inkSoft }}>読み込み中…</div>
        ) : tab === "home" ? (
          <HomeList
            items={searchedEnriched}
            onEdit={openEditFromHome}
          />
        ) : (
          <ShoppingList
            items={searchedEnriched}
            onEdit={openEditFromShopping}
            onManualReset={resetCycleManually}
            onExtend={setExtendingItem}
          />
        )}
      </div>

      {/* Bottom nav */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: 480,
          background: COLORS.card,
          borderTop: `1px solid ${COLORS.line}`,
          display: "flex",
          justifyContent: "space-around",
          alignItems: "center",
          padding: "10px 0 14px",
        }}
      >
        <NavButton
          icon={<Home size={22} />}
          label="在庫"
          active={tab === "home"}
          onClick={() => {
            haptics.light();
            setTab("home");
          }}
        />
        <button
          onClick={() => {
            haptics.light();
            openScan();
          }}
          style={{
            background: COLORS.navy,
            border: "none",
            borderRadius: "50%",
            width: 58,
            height: 58,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginTop: -30,
            boxShadow: "0 6px 14px rgba(47,72,88,0.35)",
          }}
        >
          <ScanLine size={26} color="#fff" />
        </button>
        <NavButton
          icon={<ShoppingCart size={22} />}
          label="買い物"
          active={tab === "shopping"}
          badge={urgentCount}
          onClick={() => {
            haptics.light();
            setTab("shopping");
          }}
        />
      </div>

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 100,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#20261F",
            color: "#fff",
            padding: "10px 18px",
            borderRadius: 20,
            fontSize: 13,
            maxWidth: "88%",
            textAlign: "center",
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            zIndex: 50,
          }}
        >
          {toast}
        </div>
      )}

      {/* 予備在庫が増えた時のお祝いポップアップ */}
      {stockPopup != null && (
        <div
          key={stockPopup.key}
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            zIndex: 200,
          }}
        >
          <div
            style={{
              background: COLORS.safe,
              color: "#fff",
              borderRadius: 20,
              padding: "18px 28px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
              animation: "stockPopup 0.7s ease forwards",
              fontFamily: "'Zen Maru Gothic', sans-serif",
            }}
          >
            <span style={{ fontSize: 28 }}>📦</span>
            <span style={{ fontSize: 30, fontWeight: 900 }}>+{stockPopup.amount}</span>
          </div>
        </div>
      )}

      {/* Scan modal */}
      {displayScanning && (
        <ScanModal
          closing={scanningClosing}
          videoRef={videoRef}
          quaggaContainerRef={quaggaContainerRef}
          scanStatus={scanStatus}
          scanUnsupported={scanUnsupported}
          manualCode={manualCode}
          setManualCode={setManualCode}
          onManualSubmit={submitManualCode}
          onClose={closeScan}
          unknownStep={unknownStep}
          scannedCode={scannedCode}
          pendingKnown={pendingKnown}
          onConfirmKnown={confirmKnownReset}
          onCancelKnown={cancelKnownReset}
          pendingExpiryInput={pendingExpiryInput}
          onPendingExpiryChange={setPendingExpiryInput}
          stockChoiceItem={stockChoiceItem}
          onUsedUpInstead={proceedStockChoiceAsUsedUp}
          onCancelStockChoice={cancelStockChoice}
          stockQtyMode={stockQtyMode}
          stockQty={stockQty}
          onGoStockQty={goStockQty}
          onIncrementStockQty={incrementStockQty}
          onDecrementStockQty={decrementStockQty}
          onConfirmStockQty={confirmStockQty}
          onBackToStockChoice={backToStockChoice}
          items={items}
          newName={newName}
          setNewName={setNewName}
          newCycle={newCycle}
          setNewCycle={handleNewCycleChange}
          newWarn={newWarn}
          setNewWarn={setNewWarn}
          newGenre={newGenre}
          setNewGenre={setNewGenre}
          newCycleUnknown={newCycleUnknown}
          onGoUnknownConfirm={() => setUnknownStep("cycleUnknownConfirm")}
          onRevertUnknown={() => setNewCycleUnknown(false)}
          onConfirmUnknown={() => {
            setNewCycleUnknown(true);
            setUnknownStep("new");
          }}
          onBackToNewFromUnknown={() => setUnknownStep("new")}
          newTrackMode={newTrackMode}
          newExpiryDate={newExpiryDate}
          setNewExpiryDate={setNewExpiryDate}
          newExpiryWarnDays={newExpiryWarnDays}
          setNewExpiryWarnDays={setNewExpiryWarnDays}
          onSetExpiryMode={() => {
            setNewCycleUnknown(false);
            setNewTrackMode("expiry");
          }}
          onRevertTrackMode={() => setNewTrackMode("cycle")}
          newIconShape={newIconShape}
          setNewIconShape={setNewIconShape}
          newBarcodeMemo={newBarcodeMemo}
          setNewBarcodeMemo={setNewBarcodeMemo}
          lookup={lookup}
          onRegisterNew={handleRegisterClick}
          onConfirmDuplicate={registerNewItem}
          onLinkExisting={linkToExisting}
          onSelectLinkTarget={selectLinkTarget}
          pendingLinkTarget={pendingLinkTarget}
          pendingLinkMemo={pendingLinkMemo}
          onPendingLinkMemoChange={setPendingLinkMemo}
          onConfirmLinkWithMemo={confirmLinkWithMemo}
          onSkipLinkMemo={skipLinkMemo}
          onGoNew={() => setUnknownStep("new")}
          onGoLink={() => setUnknownStep("link")}
          onBackToChoose={() => setUnknownStep("choose")}
        />
      )}

      {/* Edit modal */}
      {displayEditingItem && (
        <EditModal
          closing={editingClosing}
          item={displayEditingItem}
          onClose={() => setEditingItem(null)}
          onSave={(fields) => {
            updateItemFields(editingItem.id, fields);
            setEditingItem(null);
          }}
          onDelete={() => deleteItem(editingItem.id)}
          onManualReset={resetCycleManually}
          onOpenExtend={(it) => {
            setEditingItem(null);
            setExtendingItem(it);
          }}
          showBuyButton={editingContext === "shopping"}
          onSpareBump={triggerStockPopup}
        />
      )}

      {/* Extend modal */}
      {displayExtendingItem && (
        <ExtendModal
          closing={extendingClosing}
          item={displayExtendingItem}
          days={extendDays}
          setDays={setExtendDays}
          onClose={() => {
            setExtendingItem(null);
            setExtendDays("7");
          }}
          onSubmit={() => {
            extendItem(extendingItem.id, extendDays);
            setExtendingItem(null);
            setExtendDays("7");
          }}
        />
      )}

      {/* Settings modal */}
      {displaySettings && (
        <SettingsModal
          closing={settingsClosing}
          appId={yahooAppId}
          onSaveAppId={saveYahooAppId}
          warnPercent={warnPercent}
          onSaveWarnPercent={saveWarnPercent}
          onApplyToAll={applyWarnPercentToAll}
          itemCount={items.length}
          darkMode={darkMode}
          onToggleDarkMode={toggleDarkMode}
          user={user}
          syncing={syncing}
          onSignIn={handleSignIn}
          onSignOut={handleSignOut}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Calendar page */}
      {displayCalendar && (
        <CalendarPage
          closing={calendarClosing}
          items={enriched}
          onBack={() => setShowCalendar(false)}
          onSelectItem={(it) => {
            setShowCalendar(false);
            openEditFromHome(it);
          }}
        />
      )}

      {/* Scan history page */}
      {displayHistory && (
        <HistoryPage
          closing={historyClosing}
          items={enriched}
          onBack={() => setShowHistory(false)}
          onDeleteEntries={deleteHistoryEntries}
        />
      )}

      {/* Cycle estimation adoption prompt */}
      {displayCycleAdopt && (
        <ModalShell onClose={declineEstimatedCycle} closing={cycleAdoptClosing} title="サイクルを設定しますか？">
          <div
            style={{
              background: COLORS.safeBg,
              border: `1px solid ${COLORS.safe}`,
              borderRadius: 14,
              padding: "16px 14px",
              marginBottom: 16,
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 16, fontFamily: "'Zen Maru Gothic', sans-serif", color: COLORS.safe }}>
              前回から {displayCycleAdopt.estimatedCycle} 日で使い切りました
            </div>
            <div style={{ fontSize: 12, color: COLORS.inkSoft, marginTop: 8, lineHeight: 1.7 }}>
              「{displayCycleAdopt.itemName}」を、次回からこのサイクル（{displayCycleAdopt.estimatedCycle}日）で管理しますか？
              <br />
              まだわからないままにする場合は、次にスキャンした時にまた確認します。
            </div>
          </div>
          <button style={{ ...primaryBtn, marginBottom: 10 }} onClick={adoptEstimatedCycle}>
            このサイクル（{displayCycleAdopt.estimatedCycle}日）を使う
          </button>
          <button style={secondaryBtn} onClick={declineEstimatedCycle}>
            まだわからないままにする
          </button>
        </ModalShell>
      )}
    </div>
  );
}

function NavButton({ icon, label, active, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "none",
        border: "none",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        color: active ? COLORS.navy : COLORS.inkSoft,
        position: "relative",
        width: 64,
      }}
    >
      <div style={{ position: "relative" }}>
        {icon}
        {badge > 0 && (
          <span
            style={{
              position: "absolute",
              top: -6,
              right: -10,
              background: COLORS.danger,
              color: "#fff",
              fontSize: 10,
              fontWeight: 700,
              borderRadius: 8,
              padding: "1px 5px",
              minWidth: 14,
              textAlign: "center",
            }}
          >
            {badge}
          </span>
        )}
      </div>
      <span style={{ fontSize: 11, fontWeight: active ? 700 : 500 }}>{label}</span>
    </button>
  );
}

function ItemCard({ item, onEdit, onManualReset, onExtend, showMemo }) {
  const ratio = item.totalCycle > 0 ? item.daysLeft / item.totalCycle : 0;
  const label =
    item.level === "unknown"
      ? "計測中"
      : item.daysLeft > 0
      ? `あと ${item.daysLeft} 日`
      : item.daysLeft === 0
      ? "本日が目安"
      : `${-item.daysLeft} 日超過`;
  const statusColors = {
    safe: { fg: COLORS.safe, bg: COLORS.safeBg },
    warn: { fg: COLORS.warn, bg: COLORS.warnBg },
    danger: { fg: COLORS.danger, bg: COLORS.dangerBg },
    unknown: { fg: COLORS.inkSoft, bg: COLORS.bg },
  }[item.level];

  return (
    <div
      style={{
        background: COLORS.card,
        borderRadius: 14,
        padding: "12px 14px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 10,
        border: `1px solid ${COLORS.line}`,
      }}
    >
      <StatusIcon item={item} />
      <div style={{ flex: 1, minWidth: 0 }} onClick={() => onEdit(item)}>
        <div style={{ fontWeight: 700, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {item.name}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
          <div
            style={{
              display: "inline-block",
              fontSize: 12,
              fontWeight: 700,
              color: statusColors.fg,
              background: statusColors.bg,
              borderRadius: 8,
              padding: "2px 8px",
            }}
          >
            {label}
          </div>
          {item.spareStock > 0 && (
            <span style={{ fontSize: 11, color: COLORS.inkSoft, fontWeight: 700, opacity: 0.75 }}>
              +{item.spareStock}
            </span>
          )}
          {item.genre && (
            <div style={{ fontSize: 10.5, color: COLORS.inkSoft, background: COLORS.bg, borderRadius: 8, padding: "2px 7px" }}>
              {item.genre}
            </div>
          )}
        </div>
        {showMemo && item.memo && (
          <div
            style={{
              fontSize: 11.5,
              color: COLORS.inkSoft,
              marginTop: 4,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {item.memo}
          </div>
        )}
      </div>
      {onExtend && item.level !== "unknown" && item.trackMode !== "expiry" && (
        <button
          onClick={() => onExtend(item)}
          title="期限を延長する"
          style={{
            border: `1px solid ${COLORS.line}`,
            background: COLORS.card,
            borderRadius: 10,
            padding: "6px 7px",
            color: COLORS.inkSoft,
            fontSize: 11,
            fontWeight: 700,
            whiteSpace: "nowrap",
          }}
        >
          +日
        </button>
      )}
      <button onClick={() => onEdit(item)} style={{ border: "none", background: "none", color: COLORS.inkSoft, padding: 0 }}>
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

function CompactItemRow({ item, onEdit, onExtend }) {
  const label =
    item.daysLeft > 0 ? `あと ${item.daysLeft} 日` : item.daysLeft === 0 ? "本日が目安" : `${-item.daysLeft} 日超過`;
  return (
    <div
      onClick={() => onEdit(item)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "7px 10px",
        marginBottom: 4,
        borderRadius: 10,
        color: COLORS.inkSoft,
      }}
    >
      <div
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "#C7CEC3",
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {item.name}
      </div>
      <div style={{ fontSize: 11.5, flexShrink: 0 }}>{label}</div>
      {item.spareStock > 0 && (
        <span style={{ fontSize: 10.5, flexShrink: 0, opacity: 0.75 }}>+{item.spareStock}</span>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onExtend(item);
        }}
        style={{
          border: "none",
          background: "none",
          color: "#AEB6A9",
          fontSize: 11,
          fontWeight: 700,
          padding: "2px 4px",
          flexShrink: 0,
        }}
      >
        +日
      </button>
    </div>
  );
}

function GenreAccordion({ genre, count, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={{ marginBottom: 14 }}>
      <button
        type="button"
        onClick={() => {
          haptics.light();
          setOpen((o) => !o);
        }}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "none",
          border: "none",
          padding: "6px 4px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: COLORS.navy }}>
          <Tag size={13} />
          {genre}
          <span style={{ color: COLORS.inkSoft, fontWeight: 500 }}>({count})</span>
        </div>
        <ChevronDown
          size={16}
          style={{ color: COLORS.inkSoft, transform: open ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.15s" }}
        />
      </button>
      <div
        style={{
          display: "grid",
          gridTemplateRows: open ? "1fr" : "0fr",
          transition: "grid-template-rows 0.28s ease",
        }}
      >
        <div style={{ overflow: "hidden" }}>
          <div style={{ marginTop: 6 }}>{children}</div>
        </div>
      </div>
    </div>
  );
}

function HomeList({ items, onEdit }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Package size={34} color={COLORS.inkSoft} />}
        title="まだ何も登録されていません"
        body="画面下の丸いボタンからバーコードをスキャンして、日用品を登録しましょう。"
      />
    );
  }
  const groups = GENRES.map((g) => ({
    genre: g,
    list: items
      .filter((it) => (it.genre || "その他") === g)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, "ja")),
  })).filter((g) => g.list.length > 0);

  return (
    <div style={{ paddingTop: 8 }}>
      {groups.map((group) => (
        <GenreAccordion key={group.genre} genre={group.genre} count={group.list.length}>
          {group.list.map((it) => (
            <ItemCard key={it.id} item={it} onEdit={onEdit} />
          ))}
        </GenreAccordion>
      ))}
    </div>
  );
}

function ShoppingList({ items, onEdit, onManualReset, onExtend }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingCart size={34} color={COLORS.inkSoft} />}
        title="登録されている商品がありません"
        body="在庫一覧で商品を登録すると、ここに表示されます。"
      />
    );
  }
  const cycleUrgent = items.filter(
    (it) => (it.level === "warn" || it.level === "danger") && it.trackMode !== "expiry"
  );
  const expiryUrgent = items.filter(
    (it) => (it.level === "warn" || it.level === "danger") && it.trackMode === "expiry"
  );
  const unknown = items.filter((it) => it.level === "unknown");
  const safe = items.filter((it) => it.level === "safe");
  const hasAnyUrgent = cycleUrgent.length > 0 || expiryUrgent.length > 0;

  let renderedAny = false;
  const sectionSpacing = () => {
    const style = renderedAny ? { marginTop: 22 } : {};
    renderedAny = true;
    return style;
  };

  return (
    <div style={{ paddingTop: 8 }}>
      <div style={{ fontSize: 12, color: COLORS.inkSoft, marginBottom: 8 }}>
        同じ商品(または代わりの商品)のバーコードをスキャンすると、リストから消えます
      </div>
      {!hasAnyUrgent && (
        <div style={{ fontSize: 13, color: COLORS.inkSoft, padding: "12px 4px 4px" }}>
          今すぐ買うべきものはありません
        </div>
      )}
      {cycleUrgent.length > 0 && (
        <div style={sectionSpacing()}>
          <div style={{ fontSize: 15, fontWeight: 900, color: COLORS.navy, marginBottom: 8, paddingLeft: 4, fontFamily: "'Zen Maru Gothic', sans-serif" }}>
            サイクル期限が近いもの
          </div>
          {cycleUrgent.map((it) => (
            <ItemCard key={it.id} item={it} onEdit={onEdit} onManualReset={onManualReset} onExtend={onExtend} showMemo />
          ))}
        </div>
      )}
      {expiryUrgent.length > 0 && (
        <div style={sectionSpacing()}>
          <div style={{ fontSize: 15, fontWeight: 900, color: COLORS.navy, marginBottom: 8, paddingLeft: 4, fontFamily: "'Zen Maru Gothic', sans-serif" }}>
            消費期限が近いもの
          </div>
          {expiryUrgent.map((it) => (
            <ItemCard key={it.id} item={it} onEdit={onEdit} onManualReset={onManualReset} onExtend={onExtend} showMemo />
          ))}
        </div>
      )}
      {unknown.length > 0 && (
        <div style={sectionSpacing()}>
          <GenreAccordion genre="目安日数未設定" count={unknown.length} defaultOpen={false}>
            <p style={{ fontSize: 11.5, color: COLORS.inkSoft, marginBottom: 10 }}>
              次にスキャンすると、自動で目安日数が計算されます。
            </p>
            {unknown.map((it) => (
              <ItemCard key={it.id} item={it} onEdit={onEdit} onManualReset={onManualReset} />
            ))}
          </GenreAccordion>
        </div>
      )}
      {safe.length > 0 && (
        <div style={sectionSpacing()}>
          <div style={{ fontSize: 11, color: "#9BA69B", fontWeight: 700, marginBottom: 4, paddingLeft: 4 }}>
            まだ余裕があるもの
          </div>
          {safe.map((it) => (
            <CompactItemRow key={it.id} item={it} onEdit={onEdit} onExtend={onExtend} />
          ))}
        </div>
      )}
    </div>
  );
}

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

function CalendarPage({ items, onBack, closing, onSelectItem }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState(null);

  const base = new Date();
  const viewDate = new Date(base.getFullYear(), base.getMonth() + monthOffset, 1);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const todayStr = formatDateObj(new Date());

  const dueMap = {};
  items.forEach((it) => {
    let dueDateStr = null;
    if (it.trackMode === "expiry" && it.expiryDate) {
      dueDateStr = it.expiryDate;
    } else if (it.cycleDays != null) {
      const spareCycles = (it.spareStock || 0) * it.cycleDays;
      const totalCycle = it.cycleDays + (it.extensionDays || 0) + spareCycles;
      const due = addDays(it.lastPurchaseDate, totalCycle);
      dueDateStr = formatDateObj(due);
    }
    if (dueDateStr) {
      if (!dueMap[dueDateStr]) dueMap[dueDateStr] = [];
      dueMap[dueDateStr].push(it);
    }
  });

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const changeMonth = (delta) => {
    haptics.light();
    setMonthOffset((m) => m + delta);
    setSelectedDate(null);
  };

  const selectDate = (dateStr) => {
    if (!dueMap[dateStr]) return;
    haptics.medium();
    setSelectedDate((d) => (d === dateStr ? null : dateStr));
  };

  const selectedItems = selectedDate ? dueMap[selectedDate] || [] : [];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: COLORS.bg,
        zIndex: 90,
        display: "flex",
        flexDirection: "column",
        maxWidth: 480,
        margin: "0 auto",
        animation: closing ? "pageSlideOut 0.25s ease forwards" : "pageSlideIn 0.28s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      <div
        style={{
          padding: "20px 16px 14px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          borderBottom: `1px solid ${COLORS.line}`,
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={() => {
            haptics.light();
            onBack();
          }}
          style={{ border: "none", background: "none", color: COLORS.ink, padding: 4, display: "flex" }}
        >
          <ChevronLeft size={24} />
        </button>
        <div style={{ fontWeight: 900, fontSize: 17, fontFamily: "'Zen Maru Gothic', sans-serif", color: COLORS.navy }}>
          カレンダー
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 40px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <button
            type="button"
            onClick={() => changeMonth(-1)}
            style={{ border: "none", background: "none", color: COLORS.inkSoft, padding: 6 }}
          >
            <ChevronLeft size={20} />
          </button>
          <div style={{ fontWeight: 900, fontSize: 16, fontFamily: "'Zen Maru Gothic', sans-serif", color: COLORS.navy }}>
            {year}年{month + 1}月
          </div>
          <button
            type="button"
            onClick={() => changeMonth(1)}
            style={{ border: "none", background: "none", color: COLORS.inkSoft, padding: 6 }}
          >
            <ChevronLeft size={20} style={{ transform: "rotate(180deg)" }} />
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 6 }}>
          {WEEKDAY_LABELS.map((w) => (
            <div key={w} style={{ textAlign: "center", fontSize: 11, color: COLORS.inkSoft, fontWeight: 700 }}>
              {w}
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
          {cells.map((d, i) => {
            if (d == null) return <div key={i} />;
            const dateStr = formatDateObj(new Date(year, month, d));
            const dayItems = dueMap[dateStr] || [];
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDate;
            const worst = dayItems.reduce((acc, it) => {
              const order = { danger: 3, warn: 2, safe: 1 };
              return (order[it.level] || 0) > (order[acc] || 0) ? it.level : acc;
            }, null);
            const dotColor = worst === "danger" ? COLORS.danger : worst === "warn" ? COLORS.warn : worst === "safe" ? COLORS.safe : null;
            return (
              <button
                key={i}
                type="button"
                onClick={() => selectDate(dateStr)}
                style={{
                  aspectRatio: "1",
                  border: isSelected ? `2px solid ${COLORS.navy}` : isToday ? `1px solid ${COLORS.navy}` : "1px solid transparent",
                  borderRadius: 10,
                  background: isSelected ? COLORS.safeBg : "transparent",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 3,
                  cursor: dayItems.length > 0 ? "pointer" : "default",
                }}
              >
                <span style={{ fontSize: 12.5, fontWeight: isToday ? 900 : 500, color: dayItems.length > 0 ? COLORS.ink : COLORS.inkSoft }}>
                  {d}
                </span>
                {dotColor && (
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: dotColor, display: "block" }} />
                )}
              </button>
            );
          })}
        </div>

        {selectedDate && (
          <div key={selectedDate} style={{ marginTop: 20, animation: "dropDown 0.2s ease" }}>
            <div style={{ fontSize: 12, color: COLORS.inkSoft, marginBottom: 8, fontWeight: 700 }}>
              {selectedDate} に切れそうなもの（{selectedItems.length}件）
            </div>
            {selectedItems.map((it) => (
              <button
                key={it.id}
                type="button"
                onClick={() => {
                  haptics.medium();
                  onSelectItem(it);
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 4px",
                  borderBottom: `1px solid ${COLORS.line}`,
                  background: "none",
                  border: "none",
                }}
              >
                <StatusIcon item={it} />
                <div style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 14 }}>{it.name}</div>
                <ChevronRight size={16} color={COLORS.inkSoft} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HistoryPage({ items, onBack, closing, onDeleteEntries }) {
  const [detailId, setDetailId] = useState(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState([]);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const scannedItems = items
    .filter((it) => (it.history || []).length > 0)
    .slice()
    .sort((a, b) => {
      const aLast = getStamp(a.history[a.history.length - 1]);
      const bLast = getStamp(b.history[b.history.length - 1]);
      return bLast.localeCompare(aLast);
    });

  const detailItem = detailId ? items.find((it) => it.id === detailId) : null;

  const toggleSelect = (stamp) => {
    haptics.light();
    setSelected((prev) => (prev.includes(stamp) ? prev.filter((d) => d !== stamp) : [...prev, stamp]));
  };

  const openDetail = (id) => {
    haptics.medium();
    setDetailId(id);
    setSelecting(false);
    setSelected([]);
  };

  const backToList = () => {
    haptics.light();
    setDetailId(null);
    setSelecting(false);
    setSelected([]);
  };

  const handleBack = () => {
    haptics.light();
    if (detailId) {
      backToList();
    } else {
      onBack();
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: COLORS.bg,
        zIndex: 90,
        display: "flex",
        flexDirection: "column",
        maxWidth: 480,
        margin: "0 auto",
        animation: closing ? "pageSlideOut 0.25s ease forwards" : "pageSlideIn 0.28s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      <div
        style={{
          padding: "20px 16px 14px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          borderBottom: `1px solid ${COLORS.line}`,
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={handleBack}
          style={{ border: "none", background: "none", color: COLORS.ink, padding: 4, display: "flex" }}
        >
          <ChevronLeft size={24} />
        </button>
        <div style={{ fontWeight: 900, fontSize: 17, fontFamily: "'Zen Maru Gothic', sans-serif", color: COLORS.navy }}>
          {detailItem ? detailItem.name : "スキャン履歴"}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 40px" }}>
        <div key={detailItem ? `detail-${detailItem.id}` : "list"} style={{ animation: "dropDown 0.22s ease" }}>
          {detailItem ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <StatusIcon item={detailItem} />
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color:
                      detailItem.level === "unknown"
                        ? COLORS.inkSoft
                        : detailItem.level === "safe"
                        ? COLORS.safe
                        : detailItem.level === "warn"
                        ? COLORS.warn
                        : COLORS.danger,
                  }}
                >
                  {detailItem.level === "unknown"
                    ? "計測中"
                    : detailItem.daysLeft > 0
                    ? `あと ${detailItem.daysLeft} 日`
                    : detailItem.daysLeft === 0
                    ? "本日が目安"
                    : `${-detailItem.daysLeft} 日超過`}
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: COLORS.inkSoft }}>
                  スキャン履歴（{(detailItem.history || []).length}件）
                </div>
                <button
                  type="button"
                  onClick={() => {
                    haptics.light();
                    setSelecting((s) => !s);
                    setSelected([]);
                  }}
                  style={{ border: "none", background: "none", color: COLORS.navy, fontSize: 12, fontWeight: 700, padding: 0 }}
                >
                  {selecting ? "キャンセル" : "選択"}
                </button>
              </div>
              {[...(detailItem.history || [])].sort((a, b) => getStamp(a).localeCompare(getStamp(b))).map((entry, i, history) => {
                const stamp = getStamp(entry);
                const barcode = getEntryBarcode(entry);
                const entryMemo = barcode ? detailItem.barcodeMemos?.[barcode] : null;
                const gap = i > 0 ? isoDateDiff(getStamp(history[i - 1]), stamp) : null;
                const checked = selected.includes(stamp);
                return (
                  <div
                    key={stamp}
                    onClick={() => selecting && toggleSelect(stamp)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 4px",
                      borderBottom: i < history.length - 1 ? `1px solid ${COLORS.line}` : "none",
                      cursor: selecting ? "pointer" : "default",
                    }}
                  >
                    {selecting && (
                      <span key={checked} style={{ display: "inline-flex", animation: "bounceScale 0.25s ease" }}>
                        {checked ? <CheckSquare size={18} color={COLORS.navy} /> : <Square size={18} color={COLORS.inkSoft} />}
                      </span>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{formatStamp(stamp)}</div>
                      <div style={{ fontSize: 11, color: COLORS.inkSoft, marginTop: 2 }}>
                        {barcode ? barcode : "バーコード不明"}
                        {entryMemo ? `・${entryMemo}` : ""}
                        {gap != null ? `　前回から${gap}日` : ""}
                      </div>
                    </div>
                  </div>
                );
              })}
              {selecting && selected.length > 0 && (
                <button
                  style={{
                    ...primaryBtn,
                    marginTop: 16,
                    background: COLORS.danger,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                  onClick={() => {
                    haptics.warning();
                    setConfirmingDelete(true);
                  }}
                >
                  <Trash2 size={16} /> 選択した{selected.length}件を削除
                </button>
              )}
            </>
          ) : scannedItems.length === 0 ? (
            <p style={{ fontSize: 13, color: COLORS.inkSoft }}>まだスキャン履歴がありません。</p>
          ) : (
            scannedItems.map((it) => {
              const h = it.history || [];
              const last = h[h.length - 1];
              const ratio = it.totalCycle > 0 ? it.daysLeft / it.totalCycle : 0;
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => openDetail(it.id)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 4px",
                    borderBottom: `1px solid ${COLORS.line}`,
                    background: "none",
                    border: "none",
                  }}
                >
                  <StatusIcon item={it} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{it.name}</div>
                    <div style={{ fontSize: 11.5, color: COLORS.inkSoft, marginTop: 2 }}>
                      {h.length}回スキャン・最終 {formatStamp(getStamp(last))}
                    </div>
                  </div>
                  <ChevronRight size={18} color={COLORS.inkSoft} />
                </button>
              );
            })
          )}
        </div>
      </div>

      {confirmingDelete && (
        <ModalShell onClose={() => setConfirmingDelete(false)} title="履歴を削除しますか？">
          <div
            style={{
              background: COLORS.dangerBg,
              border: `1px solid ${COLORS.danger}`,
              borderRadius: 14,
              padding: "16px 14px",
              marginBottom: 16,
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 16, fontFamily: "'Zen Maru Gothic', sans-serif", color: COLORS.danger }}>
              選択した{selected.length}件を削除します
            </div>
            <div style={{ fontSize: 12, color: COLORS.inkSoft, marginTop: 6 }}>この操作は取り消せません。</div>
          </div>
          <button
            style={{ ...primaryBtn, marginBottom: 10, background: COLORS.danger }}
            onClick={() => {
              onDeleteEntries(detailId, selected);
              setSelected([]);
              setSelecting(false);
              setConfirmingDelete(false);
            }}
          >
            削除する
          </button>
          <button style={secondaryBtn} onClick={() => setConfirmingDelete(false)}>
            キャンセル
          </button>
        </ModalShell>
      )}
    </div>
  );
}

function EmptyState({ icon, title, body }) {
  return (
    <div style={{ textAlign: "center", padding: "70px 20px 0" }}>
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: "50%",
          background: COLORS.card,
          border: `1px solid ${COLORS.line}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 14px",
        }}
      >
        {icon}
      </div>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, color: COLORS.inkSoft, lineHeight: 1.6 }}>{body}</div>
    </div>
  );
}

function ModalShell({ onClose, children, title, closing }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: COLORS.overlay,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 100,
        animation: closing ? "overlayFadeOut 0.22s ease forwards" : "overlayFadeIn 0.18s ease",
        pointerEvents: closing ? "none" : "auto",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: COLORS.bg,
          width: "100%",
          maxWidth: 480,
          borderRadius: "20px 20px 0 0",
          padding: 18,
          maxHeight: "88vh",
          overflowY: "auto",
          animation: closing
            ? "modalSlideDown 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards"
            : "modalSlideUp 0.28s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontWeight: 900, fontSize: 17, fontFamily: "'Zen Maru Gothic', sans-serif", color: COLORS.navy }}>
            {title}
          </div>
          <button onClick={onClose} style={{ border: "none", background: "none", color: COLORS.inkSoft }}>
            <X size={22} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: `1px solid ${COLORS.line}`,
  fontSize: 14,
  marginBottom: 14,
  background: COLORS.card,
};
const labelStyle = { fontSize: 12, color: COLORS.inkSoft, marginBottom: 6, display: "block", fontWeight: 700 };
const primaryBtn = {
  width: "100%",
  padding: "13px 0",
  borderRadius: 12,
  border: "none",
  background: COLORS.navy,
  color: "#fff",
  fontWeight: 700,
  fontSize: 14,
};
const secondaryBtn = {
  width: "100%",
  padding: "13px 0",
  borderRadius: 12,
  border: `1px solid ${COLORS.line}`,
  background: COLORS.card,
  color: COLORS.ink,
  fontWeight: 700,
  fontSize: 14,
};

function WarnPercentSlider({ cycleDays, percent, warnDays, onChange }) {
  const presets = [
    { label: "早め", value: 30, color: COLORS.safe },
    { label: "ふつう", value: 20, color: COLORS.warn },
    { label: "ギリギリ", value: 10, color: COLORS.danger },
  ];
  const daysLeftAtWarn = Math.max(0, parseInt(warnDays, 10) || 0);

  return (
    <div style={{ marginBottom: 14 }}>
      <label style={labelStyle}>買い物リストに追加するタイミング</label>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        {presets.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => {
              haptics.light();
              onChange(p.value);
            }}
            style={{
              flex: 1,
              padding: "9px 0",
              borderRadius: 10,
              border: `1px solid ${p.color}`,
              background: percent === p.value ? p.color : COLORS.card,
              color: percent === p.value ? "#fff" : p.color,
              fontWeight: 700,
              fontSize: 12.5,
            }}
          >
            {p.label}
            <div style={{ fontSize: 10, fontWeight: 500, opacity: 0.85 }}>残り{p.value}%</div>
          </button>
        ))}
      </div>
      <input
        type="range"
        min="5"
        max="50"
        step="5"
        value={55 - percent}
        onChange={(e) => {
          const next = 55 - parseInt(e.target.value, 10);
          if (next !== percent) haptics.light();
          onChange(next);
        }}
        style={{ width: "100%" }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: COLORS.inkSoft, marginTop: 2 }}>
        <span>← 早め</span>
        <span>ギリギリ →</span>
      </div>
      <div style={{ fontSize: 12, color: COLORS.inkSoft, marginTop: 8, textAlign: "center" }}>
        サイクルの残り{percent}%になった時点（残り{daysLeftAtWarn}日）で買い物リストに追加されます
      </div>
    </div>
  );
}

function FixedWarnAdvanced({ mode, fixedDays, onToggle, onFixedDaysChange }) {
  const [open, setOpen] = useState(false);
  const useFixed = mode === "fixed";

  return (
    <div style={{ marginBottom: 14 }}>
      <button
        type="button"
        onClick={() => {
          haptics.light();
          setOpen((o) => !o);
        }}
        style={{
          border: "none",
          background: "none",
          color: COLORS.inkSoft,
          fontSize: 12.5,
          fontWeight: 700,
          padding: "2px 0",
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        詳細設定 {open ? "▲" : "▼"}
      </button>
      <div
        style={{
          display: "grid",
          gridTemplateRows: open ? "1fr" : "0fr",
          transition: "grid-template-rows 0.28s ease",
        }}
      >
        <div style={{ overflow: "hidden" }}>
          <div
            style={{
              marginTop: 10,
              background: COLORS.card,
              border: `1px solid ${COLORS.line}`,
              borderRadius: 12,
              padding: 12,
            }}
          >
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={useFixed}
                onChange={(e) => {
                  haptics.light();
                  onToggle(e.target.checked);
                }}
                style={{ width: 16, height: 16 }}
              />
              割合ではなく日数で指定する
            </label>
            {useFixed && (
              <>
                <label style={{ ...labelStyle, marginTop: 12 }}>何日前から買い物リストに入れるか</label>
                <input
                  style={{ ...inputStyle, marginBottom: 0 }}
                  type="number"
                  value={fixedDays}
                  onChange={(e) => onFixedDaysChange(e.target.value)}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const CYCLE_PRESETS = [
  { label: "1週間", days: 7 },
  { label: "2週間", days: 14 },
  { label: "1ヶ月", days: 30 },
  { label: "2ヶ月", days: 60 },
  { label: "3ヶ月", days: 90 },
  { label: "半年", days: 180 },
  { label: "1年", days: 365 },
];
const UNIT_MULTIPLIER = { 日: 1, 週間: 7, ヶ月: 30 };

function CyclePicker({ days, onChange }) {
  const [customValue, setCustomValue] = useState("");
  const [customUnit, setCustomUnit] = useState("日");

  const applyCustom = (value, unit) => {
    const n = parseInt(value, 10);
    if (n > 0) onChange(String(n * UNIT_MULTIPLIER[unit]));
  };

  return (
    <div style={{ marginBottom: 14 }}>
      <label style={labelStyle}>使い切るまでの目安</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        {CYCLE_PRESETS.map((p) => (
          <button
            key={p.days}
            type="button"
            onClick={() => {
              setCustomValue("");
              onChange(String(p.days));
            }}
            style={{
              padding: "7px 12px",
              borderRadius: 20,
              border: `1px solid ${days === p.days ? COLORS.navy : COLORS.line}`,
              background: days === p.days ? COLORS.navy : COLORS.card,
              color: days === p.days ? "#fff" : COLORS.ink,
              fontSize: 12.5,
              fontWeight: 700,
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          style={{ ...inputStyle, marginBottom: 0, flex: 1 }}
          type="number"
          placeholder="カスタム"
          value={customValue}
          onChange={(e) => {
            setCustomValue(e.target.value);
            applyCustom(e.target.value, customUnit);
          }}
        />
        <select
          style={{ ...inputStyle, marginBottom: 0, width: 92, appearance: "auto" }}
          value={customUnit}
          onChange={(e) => {
            setCustomUnit(e.target.value);
            if (customValue) applyCustom(customValue, e.target.value);
          }}
        >
          <option value="日">日</option>
          <option value="週間">週間</option>
          <option value="ヶ月">ヶ月</option>
        </select>
      </div>
      <div style={{ fontSize: 11, color: COLORS.inkSoft, marginTop: 6 }}>現在の設定：{days || 0}日</div>
    </div>
  );
}

function ScanModal(props) {
  const {
    closing,
    videoRef,
    quaggaContainerRef,
    scanStatus,
    scanUnsupported,
    manualCode,
    setManualCode,
    onManualSubmit,
    onClose,
    unknownStep,
    scannedCode,
    pendingKnown,
    onConfirmKnown,
    onCancelKnown,
    pendingExpiryInput,
    onPendingExpiryChange,
    stockChoiceItem,
    onUsedUpInstead,
    onCancelStockChoice,
    stockQtyMode,
    stockQty,
    onGoStockQty,
    onIncrementStockQty,
    onDecrementStockQty,
    onConfirmStockQty,
    onBackToStockChoice,
    items,
    newName,
    setNewName,
    newCycle,
    setNewCycle,
    newWarn,
    setNewWarn,
    newGenre,
    setNewGenre,
    newCycleUnknown,
    onGoUnknownConfirm,
    onRevertUnknown,
    onConfirmUnknown,
    onBackToNewFromUnknown,
    newTrackMode,
    newExpiryDate,
    setNewExpiryDate,
    newExpiryWarnDays,
    setNewExpiryWarnDays,
    onSetExpiryMode,
    onRevertTrackMode,
    newIconShape,
    setNewIconShape,
    newBarcodeMemo,
    setNewBarcodeMemo,
    lookup,
    onRegisterNew,
    onConfirmDuplicate,
    onLinkExisting,
    onSelectLinkTarget,
    pendingLinkTarget,
    pendingLinkMemo,
    onPendingLinkMemoChange,
    onConfirmLinkWithMemo,
    onSkipLinkMemo,
    onGoNew,
    onGoLink,
    onBackToChoose,
  } = props;

  const [newIconPickerOpen, setNewIconPickerOpen] = useState(false);
  const [newBarcodeSectionOpen, setNewBarcodeSectionOpen] = useState(false);

  if (stockChoiceItem) {
    if (stockQtyMode) {
      return (
        <ModalShell onClose={onCancelStockChoice} closing={closing} title="何個増やしますか？">
          <div
            style={{
              background: COLORS.safeBg,
              border: `1px solid ${COLORS.safe}`,
              borderRadius: 14,
              padding: "16px 14px",
              marginBottom: 20,
            }}
          >
            <div style={{ fontSize: 12, color: COLORS.inkSoft, marginBottom: 4 }}>予備として追加</div>
            <div style={{ fontWeight: 900, fontSize: 18, fontFamily: "'Zen Maru Gothic', sans-serif" }}>
              {stockChoiceItem.name}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20, marginBottom: 24 }}>
            <button
              type="button"
              onClick={onDecrementStockQty}
              style={{
                width: 46,
                height: 46,
                borderRadius: 12,
                border: `1px solid ${COLORS.line}`,
                background: COLORS.card,
                fontSize: 20,
                fontWeight: 700,
                color: COLORS.ink,
              }}
            >
              −
            </button>
            <div style={{ minWidth: 70, textAlign: "center" }}>
              <div
                key={stockQty}
                style={{
                  fontSize: 30,
                  fontWeight: 900,
                  fontFamily: "'Zen Maru Gothic', sans-serif",
                  color: COLORS.safe,
                  animation: "bounceScale 0.3s ease",
                }}
              >
                {stockQty}
              </div>
              <div style={{ fontSize: 11, color: COLORS.inkSoft }}>個</div>
            </div>
            <button
              type="button"
              onClick={onIncrementStockQty}
              style={{
                width: 46,
                height: 46,
                borderRadius: 12,
                border: `1px solid ${COLORS.line}`,
                background: COLORS.card,
                fontSize: 20,
                fontWeight: 700,
                color: COLORS.ink,
              }}
            >
              ＋
            </button>
          </div>
          <button
            style={{ ...primaryBtn, marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
            onClick={onConfirmStockQty}
          >
            <Plus size={16} /> {stockQty}個追加する
          </button>
          <button style={secondaryBtn} onClick={onBackToStockChoice}>
            戻る
          </button>
        </ModalShell>
      );
    }
    return (
      <ModalShell onClose={onCancelStockChoice} closing={closing} title="まだ余裕があるようです">
        <div
          style={{
            background: COLORS.safeBg,
            border: `1px solid ${COLORS.safe}`,
            borderRadius: 14,
            padding: "16px 14px",
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 12, color: COLORS.inkSoft, marginBottom: 4 }}>読み取った商品</div>
          <div style={{ fontWeight: 900, fontSize: 18, fontFamily: "'Zen Maru Gothic', sans-serif" }}>
            {stockChoiceItem.name}
          </div>
          {stockChoiceItem.barcodeMemos?.[scannedCode] && (
            <div
              style={{
                display: "inline-block",
                fontSize: 11.5,
                fontWeight: 700,
                color: COLORS.navy,
                background: "#fff",
                borderRadius: 8,
                padding: "2px 8px",
                marginTop: 4,
              }}
            >
              {stockChoiceItem.barcodeMemos[scannedCode]}
            </div>
          )}
          <div style={{ fontSize: 12, color: COLORS.safe, marginTop: 6, fontWeight: 700 }}>
            まだ{stockChoiceItem.daysLeft > 0 ? `あと${stockChoiceItem.daysLeft}日分` : "十分"}残っているようです
          </div>
        </div>
        <p style={{ fontSize: 12.5, color: COLORS.inkSoft, marginBottom: 16, lineHeight: 1.7 }}>
          このスキャンはどちらの記録にしますか？
        </p>
        <button
          style={{ ...primaryBtn, marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          onClick={onGoStockQty}
        >
          <Plus size={16} /> 予備として追加する
        </button>
        <button style={{ ...secondaryBtn, marginBottom: 10 }} onClick={onUsedUpInstead}>
          今回を新しい開始日にする
        </button>
        <button style={secondaryBtn} onClick={onCancelStockChoice}>
          キャンセル（読み取り間違いかも）
        </button>
      </ModalShell>
    );
  }

  if (pendingKnown) {
    const isExpiry = pendingKnown.trackMode === "expiry";
    return (
      <ModalShell onClose={onClose} closing={closing} title="この内容で記録しますか？">
        <div
          style={{
            background: COLORS.card,
            border: `1px solid ${COLORS.line}`,
            borderRadius: 14,
            padding: "16px 14px",
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 12, color: COLORS.inkSoft, marginBottom: 4 }}>読み取った商品</div>
          <div style={{ fontWeight: 900, fontSize: 18, fontFamily: "'Zen Maru Gothic', sans-serif" }}>
            {pendingKnown.name}
          </div>
          {pendingKnown.barcodeMemos?.[scannedCode] && (
            <div
              style={{
                display: "inline-block",
                fontSize: 11.5,
                fontWeight: 700,
                color: COLORS.navy,
                background: COLORS.safeBg,
                borderRadius: 8,
                padding: "2px 8px",
                marginTop: 4,
              }}
            >
              {pendingKnown.barcodeMemos[scannedCode]}
            </div>
          )}
          <div style={{ fontSize: 12, color: COLORS.inkSoft, marginTop: 6 }}>
            {isExpiry
              ? "「買った」として記録します。新しいパッケージの期限日を入力してください"
              : "「買った」として記録し、使い切りサイクルをリセットします"}
          </div>
        </div>
        {isExpiry && (
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>新しい賞味/使用期限日</label>
            <input
              type="date"
              style={{ ...inputStyle, marginBottom: 0 }}
              value={pendingExpiryInput}
              onChange={(e) => onPendingExpiryChange(e.target.value)}
              autoFocus
            />
          </div>
        )}
        <button
          style={{ ...primaryBtn, marginBottom: 10 }}
          onClick={onConfirmKnown}
          disabled={isExpiry && !pendingExpiryInput}
        >
          この内容で記録する
        </button>
        <button style={secondaryBtn} onClick={onCancelKnown}>
          キャンセル（読み取り間違いかも）
        </button>
      </ModalShell>
    );
  }

  if (unknownStep === "choose") {
    return (
      <ModalShell onClose={onClose} closing={closing} title="未登録のバーコードです">
        <p style={{ fontSize: 13, color: COLORS.inkSoft, marginBottom: 16 }}>
          この商品はまだ登録されていません。どうしますか？
        </p>
        <button style={{ ...primaryBtn, marginBottom: 10 }} onClick={onGoNew}>
          新しい商品として登録する
        </button>
        <button style={secondaryBtn} onClick={onGoLink}>
          既存の商品の買い替えとして登録する
        </button>
      </ModalShell>
    );
  }

  if (unknownStep === "new" && newIconPickerOpen) {
    return (
      <ModalShell onClose={() => setNewIconPickerOpen(false)} closing={closing} title="アイコンを選択">
        <IconShapeGrid
          value={newIconShape}
          onChange={(key) => {
            setNewIconShape(key);
            setNewIconPickerOpen(false);
          }}
        />
      </ModalShell>
    );
  }

  if (unknownStep === "new") {
    return (
      <ModalShell onClose={onClose} closing={closing} title="新しい商品を登録">
        {lookup?.loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: COLORS.inkSoft, marginBottom: 14 }}>
            <Loader2 size={16} className="spin" /> Yahoo!ショッピングで商品情報を検索中…
          </div>
        )}
        {!lookup?.loading && lookup?.ok && (
          <div style={{ fontSize: 12, color: COLORS.safe, marginBottom: 14 }}>
            Yahoo!ショッピングから商品名を自動入力しました。内容を確認してください。
          </div>
        )}
        {!lookup?.loading && lookup?.error && (
          <div style={{ fontSize: 12, color: COLORS.inkSoft, marginBottom: 14 }}>
            自動取得できませんでした（{lookup.error}）。手入力してください。
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <label style={{ ...labelStyle, marginBottom: 0 }}>商品名</label>
          {newTrackMode !== "expiry" && (
            <button
              type="button"
              onClick={() => {
                haptics.light();
                setNewIconPickerOpen(true);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                border: "none",
                background: "none",
                padding: "2px 4px",
              }}
            >
              <Bottle level="safe" ratio={0.75} shape={newIconShape} />
              <ChevronDown size={13} color={COLORS.inkSoft} />
            </button>
          )}
        </div>
        <input
          style={inputStyle}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="例：シャンプー"
          autoFocus
        />
        <label style={labelStyle}>ジャンル</label>
        <select
          style={{ ...inputStyle, appearance: "auto" }}
          value={newGenre}
          onChange={(e) => setNewGenre(e.target.value)}
        >
          {GENRES.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        {newTrackMode === "expiry" ? (
          <div
            style={{
              background: COLORS.card,
              border: `1px solid ${COLORS.line}`,
              borderRadius: 12,
              padding: 12,
              marginBottom: 14,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.navy, marginBottom: 8 }}>
              消費期限で管理する
            </div>
            <label style={labelStyle}>賞味/使用期限日</label>
            <input
              type="date"
              style={inputStyle}
              value={newExpiryDate}
              onChange={(e) => setNewExpiryDate(e.target.value)}
            />
            <label style={labelStyle}>何日前から買い物リストに入れるか</label>
            <input
              type="number"
              style={{ ...inputStyle, marginBottom: 0 }}
              value={newExpiryWarnDays}
              onChange={(e) => setNewExpiryWarnDays(e.target.value)}
            />
            <button
              type="button"
              onClick={() => {
                haptics.light();
                onRevertTrackMode();
              }}
              style={{ border: "none", background: "none", color: COLORS.inkSoft, fontSize: 12, fontWeight: 700, padding: 0, marginTop: 10 }}
            >
              サイクル管理に戻す
            </button>
          </div>
        ) : newCycleUnknown ? (
          <div
            style={{
              background: COLORS.warnBg,
              border: `1px solid ${COLORS.warn}`,
              borderRadius: 12,
              padding: 12,
              marginBottom: 14,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.warn, marginBottom: 4 }}>
              使い切るまでの目安：わからない
            </div>
            <div style={{ fontSize: 11.5, color: COLORS.inkSoft, lineHeight: 1.6, marginBottom: 8 }}>
              次回このバーコードをスキャンした時から、実際の間隔をもとに自動で計算されます。それまでは買い物リストには表示されません。
            </div>
            <button
              type="button"
              onClick={() => {
                haptics.light();
                onRevertUnknown();
              }}
              style={{ border: "none", background: "none", color: COLORS.warn, fontSize: 12, fontWeight: 700, padding: 0 }}
            >
              やっぱり日数を入力する
            </button>
          </div>
        ) : (
          <>
            <CyclePicker days={parseInt(newCycle, 10) || 0} onChange={setNewCycle} />
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <button
                type="button"
                onClick={() => {
                  haptics.light();
                  onGoUnknownConfirm();
                }}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  border: `1px solid ${COLORS.line}`,
                  borderRadius: 10,
                  background: COLORS.card,
                  color: COLORS.inkSoft,
                  fontSize: 13,
                  fontWeight: 700,
                  padding: "11px 0",
                }}
              >
                <HelpCircle size={15} /> わからない
              </button>
              <button
                type="button"
                onClick={() => {
                  haptics.light();
                  onSetExpiryMode();
                }}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  border: `1px solid ${COLORS.line}`,
                  borderRadius: 10,
                  background: COLORS.card,
                  color: COLORS.inkSoft,
                  fontSize: 13,
                  fontWeight: 700,
                  padding: "11px 0",
                }}
              >
                <CalendarIcon size={15} /> 消費期限で管理
              </button>
            </div>
          </>
        )}
        {newTrackMode !== "expiry" && !newCycleUnknown && (
          <p style={{ fontSize: 11.5, color: COLORS.inkSoft, marginTop: -6, marginBottom: 14 }}>
            買い物リストに追加するタイミングは設定の一括ルールが自動で適用されます。この商品だけ個別に調整したい場合は、在庫一覧から商品を選んで設定できます。
          </p>
        )}
        {scannedCode && (
          <div style={{ marginBottom: 14 }}>
            <button
              type="button"
              onClick={() => {
                haptics.light();
                setNewBarcodeSectionOpen((o) => !o);
              }}
              style={{
                border: "none",
                background: "none",
                color: COLORS.inkSoft,
                fontSize: 12.5,
                fontWeight: 700,
                padding: "2px 0",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              登録バーコード {newBarcodeSectionOpen ? "▲" : "▼"}
            </button>
            <div
              style={{
                display: "grid",
                gridTemplateRows: newBarcodeSectionOpen ? "1fr" : "0fr",
                transition: "grid-template-rows 0.28s ease",
              }}
            >
              <div style={{ overflow: "hidden" }}>
                <div
                  style={{
                    marginTop: 10,
                    background: COLORS.card,
                    border: `1px solid ${COLORS.line}`,
                    borderRadius: 12,
                    padding: 12,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{scannedCode}</div>
                  <label style={labelStyle}>メモ（任意）</label>
                  <input
                    style={{ ...inputStyle, marginBottom: 0 }}
                    value={newBarcodeMemo}
                    onChange={(e) => setNewBarcodeMemo(e.target.value)}
                    placeholder="例：本体・詰め替え用"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
        <button
          style={primaryBtn}
          onClick={onRegisterNew}
          disabled={!newName.trim() || (newTrackMode === "expiry" && !newExpiryDate)}
        >
          登録する
        </button>
        <button style={{ ...secondaryBtn, marginTop: 10 }} onClick={scannedCode ? onBackToChoose : onClose}>
          {scannedCode ? "戻る" : "キャンセル"}
        </button>
      </ModalShell>
    );
  }

  if (unknownStep === "cycleUnknownConfirm") {
    return (
      <ModalShell onClose={onClose} closing={closing} title="使い切るまでの目安がわからない場合">
        <div
          style={{
            background: COLORS.warnBg,
            border: `1px solid ${COLORS.warn}`,
            borderRadius: 14,
            padding: "16px 14px",
            marginBottom: 16,
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 16, fontFamily: "'Zen Maru Gothic', sans-serif", color: COLORS.warn }}>
            わからないまま登録しますか？
          </div>
          <div style={{ fontSize: 12, color: COLORS.inkSoft, marginTop: 8, lineHeight: 1.7 }}>
            次回このバーコードをスキャンした時点から、実際の間隔をもとに自動で目安日数が計算されます。
            <br />
            それまでは日数が確定しないため、買い物リストには表示されません。
          </div>
        </div>
        <button style={{ ...primaryBtn, marginBottom: 10 }} onClick={onConfirmUnknown}>
          わからないまま登録する
        </button>
        <button style={secondaryBtn} onClick={onBackToNewFromUnknown}>
          戻る
        </button>
      </ModalShell>
    );
  }

  if (unknownStep === "duplicateConfirm") {
    return (
      <ModalShell onClose={onClose} closing={closing} title="同じ名前の商品があります">
        <div
          style={{
            background: COLORS.warnBg,
            border: `1px solid ${COLORS.warn}`,
            borderRadius: 14,
            padding: "16px 14px",
            marginBottom: 16,
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 16, fontFamily: "'Zen Maru Gothic', sans-serif", color: COLORS.warn }}>
            「{newName}」はすでに登録されています
          </div>
          <div style={{ fontSize: 12, color: COLORS.inkSoft, marginTop: 6 }}>
            別の商品として新しく登録しますか？既存の商品の買い替えとして扱いたい場合は、一度戻って「既存の商品の買い替え」を選んでください。
          </div>
        </div>
        <button style={{ ...primaryBtn, marginBottom: 10 }} onClick={onConfirmDuplicate}>
          それでも新しく登録する
        </button>
        <button style={secondaryBtn} onClick={onGoNew}>
          戻る
        </button>
      </ModalShell>
    );
  }

  if (unknownStep === "link") {
    const linkGroups = GENRES.map((g) => ({
      genre: g,
      list: items.filter((it) => (it.genre || "その他") === g),
    })).filter((g) => g.list.length > 0);

    return (
      <ModalShell onClose={onClose} closing={closing} title="どの商品の買い替えですか？">
        {items.length === 0 ? (
          <p style={{ fontSize: 13, color: COLORS.inkSoft }}>登録済みの商品がまだありません。</p>
        ) : (
          linkGroups.map((group) => (
            <GenreAccordion key={group.genre} genre={group.genre} count={group.list.length} defaultOpen={false}>
              {group.list.map((it) => (
                <button
                  key={it.id}
                  onClick={() => onSelectLinkTarget(it)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: `1px solid ${COLORS.line}`,
                    background: COLORS.card,
                    marginBottom: 8,
                    fontSize: 14,
                    fontWeight: 700,
                  }}
                >
                  {it.name}
                </button>
              ))}
            </GenreAccordion>
          ))
        )}
        <button style={{ ...secondaryBtn, marginTop: 6 }} onClick={onBackToChoose}>
          戻る
        </button>
      </ModalShell>
    );
  }

  if (unknownStep === "linkMemo") {
    return (
      <ModalShell onClose={onSkipLinkMemo} closing={closing} title="メモを追加しますか？">
        <div
          style={{
            background: COLORS.card,
            border: `1px solid ${COLORS.line}`,
            borderRadius: 14,
            padding: "16px 14px",
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 12, color: COLORS.inkSoft, marginBottom: 4 }}>買い替え先</div>
          <div style={{ fontWeight: 900, fontSize: 18, fontFamily: "'Zen Maru Gothic', sans-serif" }}>
            {pendingLinkTarget?.name}
          </div>
        </div>
        <label style={labelStyle}>このバーコードについてのメモ（任意）</label>
        <input
          style={inputStyle}
          value={pendingLinkMemo}
          onChange={(e) => onPendingLinkMemoChange(e.target.value)}
          placeholder="例：詰め替え用"
          autoFocus
        />
        <button style={{ ...primaryBtn, marginTop: 4, marginBottom: 10 }} onClick={onConfirmLinkWithMemo}>
          追加する
        </button>
        <button style={secondaryBtn} onClick={onSkipLinkMemo}>
          スキップ
        </button>
      </ModalShell>
    );
  }

  return (
    <ModalShell onClose={onClose} closing={closing} title="バーコードをスキャン">
      {!scanUnsupported ? (
        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "3/4",
            background: "#111",
            borderRadius: 14,
            overflow: "hidden",
            marginBottom: 14,
          }}
        >
          <video
            ref={videoRef}
            muted
            playsInline
            {...{ "webkit-playsinline": "true" }}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          <div ref={quaggaContainerRef} className="quagga-scan-container" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
          <div
            style={{
              position: "absolute",
              inset: "18% 12%",
              border: "2px solid rgba(255,255,255,0.85)",
              borderRadius: 12,
              pointerEvents: "none",
            }}
          />
          {scanStatus && (
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                background: "rgba(0,0,0,0.6)",
                color: "#fff",
                fontSize: 11.5,
                padding: "6px 10px",
                textAlign: "center",
              }}
            >
              {scanStatus}
            </div>
          )}
        </div>
      ) : (
        <div
          style={{
            background: COLORS.warnBg,
            color: COLORS.warn,
            borderRadius: 12,
            padding: 14,
            fontSize: 13,
            marginBottom: 14,
          }}
        >
          このブラウザではカメラでの自動スキャンに対応していないため、バーコード番号を手入力してください。
        </div>
      )}
      <label style={labelStyle}>バーコード番号（手入力）</label>
      <input
        style={inputStyle}
        value={manualCode}
        onChange={(e) => setManualCode(e.target.value)}
        placeholder="例：4901234567890"
        inputMode="numeric"
      />
      <button style={primaryBtn} onClick={onManualSubmit} disabled={!manualCode.trim()}>
        この番号で登録する
      </button>
    </ModalShell>
  );
}

function ExtendModal({ item, days, setDays, onClose, onSubmit, closing }) {
  const presets = [3, 7, 14];
  return (
    <ModalShell onClose={onClose} closing={closing} title={`「${item.name}」の期限を延長`}>
      <p style={{ fontSize: 13, color: COLORS.inkSoft, marginBottom: 14 }}>
        まだ持ちそうな場合、目安日数を延ばせます。買い物リストに入るタイミングも後ろにずれます。
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {presets.map((p) => (
          <button
            key={p}
            onClick={() => {
              haptics.light();
              setDays(String(p));
            }}
            style={{
              flex: 1,
              padding: "10px 0",
              borderRadius: 10,
              border: `1px solid ${days === String(p) ? COLORS.navy : COLORS.line}`,
              background: days === String(p) ? COLORS.navy : COLORS.card,
              color: days === String(p) ? "#fff" : COLORS.ink,
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            +{p}日
          </button>
        ))}
      </div>
      <label style={labelStyle}>延長する日数（任意の数字）</label>
      <input
        style={inputStyle}
        type="number"
        value={days}
        onChange={(e) => setDays(e.target.value)}
        min="1"
      />
      <button style={primaryBtn} onClick={onSubmit} disabled={!parseInt(days, 10)}>
        延長する
      </button>
    </ModalShell>
  );
}

function FieldSection({ title, children }) {
  return (
    <div
      style={{
        background: COLORS.card,
        border: `1px solid ${COLORS.line}`,
        borderRadius: 14,
        padding: 14,
        marginBottom: 14,
      }}
    >
      {title && <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.inkSoft, marginBottom: 10 }}>{title}</div>}
      {children}
    </div>
  );
}

function EditModal({ item, onClose, onSave, onDelete, onManualReset, onOpenExtend, showBuyButton, onSpareBump, closing }) {
  const [name, setName] = useState(item.name);
  const [genre, setGenre] = useState(item.genre || "その他");
  const [cycleDays, setCycleDays] = useState(item.cycleDays != null ? String(item.cycleDays) : "30");
  const [warningDays, setWarningDays] = useState(
    item.warningDays != null ? String(item.warningDays) : String(calcWarnDays(item.cycleDays ?? 30, 20))
  );
  const [barcodes, setBarcodes] = useState(item.barcodes);
  const [barcodeMemoList, setBarcodeMemoList] = useState(
    item.barcodes.map((b) => (item.barcodeMemos ? item.barcodeMemos[b] || "" : ""))
  );
  const [barcodesOpen, setBarcodesOpen] = useState(false);
  const [memo, setMemo] = useState(item.memo || "");
  const [spareStock, setSpareStock] = useState(item.spareStock || 0);
  const [confirming, setConfirming] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const initialPercent = (() => {
    const c = item.cycleDays || 1;
    const raw = Math.round((item.warningDays / c) * 100 / 5) * 5;
    return Math.max(5, Math.min(50, raw || 20));
  })();
  const [percent, setPercent] = useState(initialPercent);
  const [warnMode, setWarnMode] = useState(item.warnMode || "percent");
  const [trackMode, setTrackMode] = useState(item.trackMode || "cycle");
  const [iconShape, setIconShape] = useState(item.iconShape || "bottle");
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [expiryDate, setExpiryDate] = useState(item.expiryDate || "");
  const [expiryWarnDays, setExpiryWarnDays] = useState(
    item.expiryWarnDays != null ? String(item.expiryWarnDays) : "3"
  );
  const [confirmExpiryInput, setConfirmExpiryInput] = useState("");

  const cycleNum = () => parseInt(cycleDays, 10) || item.cycleDays;

  const handleCycleChange = (value) => {
    setCycleDays(value);
    if (warnMode === "percent") {
      const days = parseInt(value, 10);
      if (days > 0) setWarningDays(String(calcWarnDays(days, percent)));
    }
  };
  const handlePercentChange = (p) => {
    setPercent(p);
    setWarningDays(String(calcWarnDays(cycleNum(), p)));
  };
  const handleToggleFixed = (useFixed) => {
    setWarnMode(useFixed ? "fixed" : "percent");
    if (!useFixed) {
      setWarningDays(String(calcWarnDays(cycleNum(), percent)));
    }
  };

  const updateBarcode = (index, value) => {
    setBarcodes((prev) => prev.map((b, i) => (i === index ? value : b)));
  };
  const updateBarcodeMemo = (index, value) => {
    setBarcodeMemoList((prev) => prev.map((m, i) => (i === index ? value : m)));
  };
  const deleteBarcode = (index) => {
    haptics.warning();
    setBarcodes((prev) => prev.filter((_, i) => i !== index));
    setBarcodeMemoList((prev) => prev.filter((_, i) => i !== index));
  };

  if (confirming) {
    const isExpiry = item.trackMode === "expiry";
    return (
      <ModalShell onClose={onClose} closing={closing} title="この内容で記録しますか？">
        <div
          style={{
            background: COLORS.card,
            border: `1px solid ${COLORS.line}`,
            borderRadius: 14,
            padding: "16px 14px",
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 12, color: COLORS.inkSoft, marginBottom: 4 }}>対象の商品</div>
          <div style={{ fontWeight: 900, fontSize: 18, fontFamily: "'Zen Maru Gothic', sans-serif" }}>
            {item.name}
          </div>
          <div style={{ fontSize: 12, color: COLORS.inkSoft, marginTop: 6 }}>
            {isExpiry
              ? "「買った」として記録します。新しいパッケージの期限日を入力してください"
              : "「買った」として記録し、使い切りサイクルをリセットします"}
          </div>
        </div>
        {isExpiry && (
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>新しい賞味/使用期限日</label>
            <input
              type="date"
              style={{ ...inputStyle, marginBottom: 0 }}
              value={confirmExpiryInput}
              onChange={(e) => setConfirmExpiryInput(e.target.value)}
              autoFocus
            />
          </div>
        )}
        <button
          style={{ ...primaryBtn, marginBottom: 10 }}
          disabled={isExpiry && !confirmExpiryInput}
          onClick={() => {
            onManualReset(item.id, isExpiry ? confirmExpiryInput : undefined);
            onClose();
          }}
        >
          この内容で記録する
        </button>
        <button style={secondaryBtn} onClick={() => setConfirming(false)}>
          キャンセル
        </button>
      </ModalShell>
    );
  }

  if (confirmingDelete) {
    return (
      <ModalShell onClose={onClose} closing={closing} title="この商品を削除しますか？">
        <div
          style={{
            background: COLORS.dangerBg,
            border: `1px solid ${COLORS.danger}`,
            borderRadius: 14,
            padding: "16px 14px",
            marginBottom: 16,
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 18, fontFamily: "'Zen Maru Gothic', sans-serif", color: COLORS.danger }}>
            {item.name}
          </div>
          <div style={{ fontSize: 12, color: COLORS.inkSoft, marginTop: 6 }}>
            削除すると、登録情報（サイクル日数・バーコード・メモなど）はすべて失われます。この操作は取り消せません。
          </div>
        </div>
        <button
          style={{
            ...primaryBtn,
            marginBottom: 10,
            background: COLORS.danger,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
          onClick={onDelete}
        >
          <Trash2 size={16} /> 削除する
        </button>
        <button style={secondaryBtn} onClick={() => setConfirmingDelete(false)}>
          キャンセル
        </button>
      </ModalShell>
    );
  }

  if (showIconPicker) {
    return (
      <ModalShell onClose={() => setShowIconPicker(false)} closing={closing} title="アイコンを選択">
        <IconShapeGrid
          value={iconShape}
          onChange={(key) => {
            setIconShape(key);
            setShowIconPicker(false);
          }}
        />
      </ModalShell>
    );
  }

  return (
    <ModalShell onClose={onClose} closing={closing} title="商品を編集">
      {showBuyButton && (
        <button
          style={{
            ...primaryBtn,
            marginBottom: item.trackMode === "expiry" ? 10 : 18,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
          onClick={() => setConfirming(true)}
        >
          <Check size={16} /> 買った（今日からリセット）
        </button>
      )}
      {showBuyButton && item.trackMode === "expiry" && (
        <button
          style={{
            ...secondaryBtn,
            marginBottom: 18,
            color: COLORS.danger,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
          onClick={() => setConfirmingDelete(true)}
        >
          <Trash2 size={16} /> この商品を削除
        </button>
      )}

      <FieldSection title="基本情報">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <label style={{ ...labelStyle, marginBottom: 0 }}>商品名</label>
          {trackMode === "cycle" && (
            <button
              type="button"
              onClick={() => {
                haptics.light();
                setShowIconPicker(true);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                border: "none",
                background: "none",
                padding: "2px 4px",
              }}
            >
              <Bottle level="safe" ratio={0.75} shape={iconShape} />
              <ChevronDown size={13} color={COLORS.inkSoft} />
            </button>
          )}
        </div>
        <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} />
        <label style={{ ...labelStyle, marginTop: 4 }}>ジャンル</label>
        <select
          style={{ ...inputStyle, appearance: "auto" }}
          value={genre}
          onChange={(e) => setGenre(e.target.value)}
        >
          {GENRES.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <label style={{ ...labelStyle, marginTop: 4 }}>メモ（任意）</label>
        <input
          style={{ ...inputStyle, marginBottom: 0 }}
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="例：コストコの大容量がお得"
        />
      </FieldSection>

      <FieldSection>
        <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.inkSoft, marginBottom: 10 }}>使い切り方の管理方法</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => {
              haptics.light();
              setTrackMode("cycle");
            }}
            style={{
              flex: 1,
              padding: "9px 0",
              borderRadius: 10,
              border: `1px solid ${trackMode === "cycle" ? COLORS.navy : COLORS.line}`,
              background: trackMode === "cycle" ? COLORS.navy : COLORS.card,
              color: trackMode === "cycle" ? "#fff" : COLORS.ink,
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            サイクルで管理
          </button>
          <button
            type="button"
            onClick={() => {
              haptics.light();
              setTrackMode("expiry");
            }}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "9px 0",
              borderRadius: 10,
              border: `1px solid ${trackMode === "expiry" ? COLORS.navy : COLORS.line}`,
              background: trackMode === "expiry" ? COLORS.navy : COLORS.card,
              color: trackMode === "expiry" ? "#fff" : COLORS.ink,
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            <CalendarIcon size={14} /> 期限日で管理
          </button>
        </div>
      </FieldSection>

      {trackMode === "expiry" ? (
        <FieldSection>
          <label style={labelStyle}>賞味/使用期限日</label>
          <input
            type="date"
            style={inputStyle}
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
          />
          <label style={labelStyle}>何日前から買い物リストに入れるか</label>
          <input
            type="number"
            style={{ ...inputStyle, marginBottom: 0 }}
            value={expiryWarnDays}
            onChange={(e) => setExpiryWarnDays(e.target.value)}
          />
        </FieldSection>
      ) : (
        <>
          <FieldSection>
            <CyclePicker days={cycleNum()} onChange={handleCycleChange} />
          </FieldSection>

          <FieldSection title="予備在庫">
            <p style={{ fontSize: 11.5, color: COLORS.inkSoft, marginBottom: 10, lineHeight: 1.5 }}>
              ストックがある分だけ、使い切りサイクルが延長されます（1個につき+{cycleNum()}日）
            </p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18 }}>
              <button
                type="button"
                onClick={() => {
                  haptics.light();
                  setSpareStock((s) => Math.max(0, s - 1));
                }}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  border: `1px solid ${COLORS.line}`,
                  background: COLORS.card,
                  fontSize: 18,
                  fontWeight: 700,
                  color: COLORS.ink,
                }}
              >
                −
              </button>
              <div style={{ minWidth: 60, textAlign: "center" }}>
                <div
                  key={spareStock}
                  style={{
                    fontSize: 22,
                    fontWeight: 900,
                    fontFamily: "'Zen Maru Gothic', sans-serif",
                    color: COLORS.navy,
                    animation: "bounceScale 0.3s ease",
                  }}
                >
                  {spareStock}
                </div>
                <div style={{ fontSize: 10.5, color: COLORS.inkSoft }}>個</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  haptics.light();
                  setSpareStock((s) => s + 1);
                  if (onSpareBump) onSpareBump(1);
                }}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  border: `1px solid ${COLORS.line}`,
                  background: COLORS.card,
                  fontSize: 18,
                  fontWeight: 700,
                  color: COLORS.ink,
                }}
              >
                ＋
              </button>
            </div>
            {spareStock > 0 && (
              <div style={{ fontSize: 11.5, color: COLORS.inkSoft, marginTop: 10, textAlign: "center" }}>
                合計で+{spareStock * cycleNum()}日分の余裕があります
              </div>
            )}
          </FieldSection>

          <FieldSection>
            {warnMode === "percent" ? (
              <WarnPercentSlider cycleDays={cycleNum()} percent={percent} warnDays={warningDays} onChange={handlePercentChange} />
            ) : (
              <div style={{ fontSize: 12, color: COLORS.inkSoft, marginBottom: 14 }}>
                現在の設定：{warningDays || 0}日前から買い物リストに追加（詳細設定で変更できます）
              </div>
            )}
            <FixedWarnAdvanced
              mode={warnMode}
              fixedDays={warningDays}
              onToggle={handleToggleFixed}
              onFixedDaysChange={setWarningDays}
            />
          </FieldSection>
        </>
      )}

      {trackMode !== "expiry" && (
        <button
          style={{
            ...secondaryBtn,
            marginBottom: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
          onClick={() => onOpenExtend(item)}
        >
          期限を延長する（まだ持ちそうな時）
        </button>
      )}

      <FieldSection>
        <button
          type="button"
          onClick={() => {
            haptics.light();
            setBarcodesOpen((o) => !o);
          }}
          style={{
            border: "none",
            background: "none",
            color: COLORS.inkSoft,
            fontSize: 12.5,
            fontWeight: 700,
            padding: "2px 0",
            display: "flex",
            alignItems: "center",
            gap: 4,
            width: "100%",
            justifyContent: "space-between",
          }}
        >
          <span>登録バーコード（{barcodes.length}件）</span>
          {barcodesOpen ? "▲" : "▼"}
        </button>
        <div
          style={{
            display: "grid",
            gridTemplateRows: barcodesOpen ? "1fr" : "0fr",
            transition: "grid-template-rows 0.28s ease",
          }}
        >
          <div style={{ overflow: "hidden" }}>
            <div style={{ marginTop: 12 }}>
              {barcodes.length === 0 && (
                <div style={{ fontSize: 12, color: COLORS.inkSoft, marginBottom: 8 }}>
                  バーコードが登録されていません。スキャンでの自動照合ができなくなります。
                </div>
              )}
              {barcodes.map((code, i) => (
                <div
                  key={i}
                  style={{
                    marginBottom: 10,
                    paddingBottom: 10,
                    borderBottom: i < barcodes.length - 1 ? `1px solid ${COLORS.line}` : "none",
                  }}
                >
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                    <input
                      style={{ ...inputStyle, marginBottom: 0, flex: 1 }}
                      value={code}
                      onChange={(e) => updateBarcode(i, e.target.value)}
                      inputMode="numeric"
                    />
                    <button
                      type="button"
                      onClick={() => deleteBarcode(i)}
                      style={{
                        border: `1px solid ${COLORS.line}`,
                        background: COLORS.card,
                        borderRadius: 10,
                        padding: "9px 10px",
                        color: COLORS.danger,
                        flexShrink: 0,
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <input
                    style={{ ...inputStyle, marginBottom: 0, fontSize: 12.5 }}
                    value={barcodeMemoList[i] || ""}
                    onChange={(e) => updateBarcodeMemo(i, e.target.value)}
                    placeholder="メモ（例：本体・詰め替え用）"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </FieldSection>

      <button
        style={primaryBtn}
        disabled={trackMode === "expiry" && !expiryDate}
        onClick={() => {
          const trimmedBarcodes = barcodes.map((b) => b.trim());
          const nextBarcodeMemos = {};
          trimmedBarcodes.forEach((b, i) => {
            const m = (barcodeMemoList[i] || "").trim();
            if (b && m) nextBarcodeMemos[b] = m;
          });
          onSave({
            name: name.trim() || item.name,
            genre,
            memo: memo.trim(),
            spareStock: trackMode === "expiry" ? 0 : Math.max(0, spareStock),
            cycleDays: trackMode === "expiry" ? null : cycleNum(),
            warningDays: trackMode === "expiry" ? null : Math.max(0, parseInt(warningDays, 10) || 0),
            warnMode,
            trackMode,
            iconShape,
            expiryDate: trackMode === "expiry" ? expiryDate : null,
            expiryWarnDays: trackMode === "expiry" ? Math.max(0, parseInt(expiryWarnDays, 10) || 3) : null,
            barcodes: trimmedBarcodes.filter(Boolean),
            barcodeMemos: nextBarcodeMemos,
          });
        }}
      >
        保存する
      </button>
      {!(showBuyButton && item.trackMode === "expiry") && (
        <button
          style={{ ...secondaryBtn, marginTop: 10, color: COLORS.danger, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          onClick={() => setConfirmingDelete(true)}
        >
          <Trash2 size={16} /> この商品を削除
        </button>
      )}
    </ModalShell>
  );
}

function SettingsModal({
  appId,
  onSaveAppId,
  warnPercent,
  onSaveWarnPercent,
  onApplyToAll,
  itemCount,
  darkMode,
  onToggleDarkMode,
  user,
  syncing,
  onSignIn,
  onSignOut,
  closing,
  onClose,
}) {
  const [value, setValue] = useState(appId || "");
  const [percent, setPercent] = useState(warnPercent);

  return (
    <ModalShell onClose={onClose} closing={closing} title="設定">
      <FieldSection title="クラウド同期">
        {user ? (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <Cloud size={18} color={COLORS.safe} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user.displayName || user.email}
                </div>
                <div style={{ fontSize: 11, color: COLORS.inkSoft }}>
                  {syncing ? "同期中…" : "この端末と同期済み"}
                </div>
              </div>
            </div>
            <button
              style={{ ...secondaryBtn, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              onClick={onSignOut}
            >
              <LogOut size={16} /> ログアウト
            </button>
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <CloudOff size={18} color={COLORS.inkSoft} />
              <div style={{ fontSize: 12, color: COLORS.inkSoft, lineHeight: 1.6 }}>
                今はこの端末だけに保存されています。ログインすると他の端末とも自動で同期されます。
              </div>
            </div>
            <button
              style={{ ...primaryBtn, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              onClick={onSignIn}
            >
              <LogIn size={16} /> Googleでログイン
            </button>
          </div>
        )}
      </FieldSection>

      <FieldSection>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700 }}>ダークモード</span>
          <span
            onClick={() => onToggleDarkMode(!darkMode)}
            style={{
              width: 44,
              height: 26,
              borderRadius: 13,
              background: darkMode ? COLORS.navy : COLORS.line,
              position: "relative",
              transition: "background 0.15s",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 3,
                left: darkMode ? 21 : 3,
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: "#fff",
                transition: "left 0.15s",
                boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
              }}
            />
          </span>
        </label>
      </FieldSection>

      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>買い物リストに追加するタイミング（デフォルト）</div>
      <p style={{ fontSize: 12, color: COLORS.inkSoft, marginBottom: 12, lineHeight: 1.6 }}>
        新規登録した商品や、商品ごとに個別設定していないものに使われる基本のタイミングです（例は30日サイクルの場合）。
      </p>
      <FieldSection>
        <WarnPercentSlider
          cycleDays={30}
          percent={percent}
          warnDays={String(calcWarnDays(30, percent))}
          onChange={setPercent}
        />
      </FieldSection>
      <button
        style={{ ...primaryBtn, marginBottom: 10 }}
        onClick={() => onSaveWarnPercent(percent)}
      >
        今後の新規登録に使う（保存）
      </button>
      <button
        style={{ ...secondaryBtn, marginBottom: 20 }}
        onClick={() => {
          onSaveWarnPercent(percent);
          onApplyToAll(percent);
        }}
        disabled={itemCount === 0}
      >
        登録済みの{itemCount}件すべてに反映する
      </button>

      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Yahoo!ショッピング商品検索の連携</div>
      <p style={{ fontSize: 12, color: COLORS.inkSoft, marginBottom: 14, lineHeight: 1.6 }}>
        バーコード未登録の商品をスキャンした時に、Yahoo!ショッピングの商品名を自動入力します。Yahoo!デベロッパーネットワークで無料のアプリケーションID（Client ID）を発行し、下に貼り付けてください。ブラウザからの直接アクセスがブロックされる場合は、これまで通り手入力にフォールバックします。
      </p>
      <label style={labelStyle}>Yahoo! アプリケーションID（Client ID）</label>
      <input
        style={inputStyle}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="dj00aiZpP..."
      />
      <button
        style={primaryBtn}
        onClick={() => {
          onSaveAppId(value.trim());
          onClose();
        }}
      >
        保存する
      </button>
    </ModalShell>
  );
}
