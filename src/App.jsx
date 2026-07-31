import React, { useState, useEffect, useRef, useCallback } from "react";
import { Home, ShoppingCart, ScanLine, X, Plus, Trash2, Check, Package, ChevronRight, AlertCircle, Settings, Loader2, Tag, ChevronDown, LogIn, LogOut, Cloud, CloudOff } from "lucide-react";
import { storage, subscribeAuth, signIn, signOutUser, syncOnLogin, isFirebaseConfigured } from "./storage";

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@500;700;900&family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap');`;

const GENRES = ["食品・飲料", "洗面・バス用品", "掃除・洗濯用品", "医薬品・衛生用品", "キッチン用品", "ペット用品", "その他"];

const haptics = {
  light: () => {
    try {
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(8);
    } catch (e) {}
  },
  medium: () => {
    try {
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(15);
    } catch (e) {}
  },
  success: () => {
    try {
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(20);
    } catch (e) {}
  },
  warning: () => {
    try {
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([15, 40, 15]);
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

function statusOf(item) {
  const spareCycles = (item.spareStock || 0) * item.cycleDays;
  const totalCycle = item.cycleDays + (item.extensionDays || 0) + spareCycles;
  const due = addDays(item.lastPurchaseDate, totalCycle);
  const daysLeft = daysBetween(due);
  if (daysLeft <= 0) return { level: "danger", daysLeft, totalCycle };
  if (daysLeft <= item.warningDays) return { level: "warn", daysLeft, totalCycle };
  return { level: "safe", daysLeft, totalCycle };
}

function Bottle({ level, ratio }) {
  const palette = {
    safe: COLORS.safe,
    warn: COLORS.warn,
    danger: COLORS.danger,
  };
  const fillColor = palette[level];
  const h = 34;
  const fillH = Math.max(2, h * Math.max(0, Math.min(1, ratio)));
  return (
    <svg width="26" height="40" viewBox="0 0 26 40" style={{ flexShrink: 0 }}>
      <rect x="9" y="0" width="8" height="6" rx="1.5" fill={COLORS.bottleCap} />
      <rect x="7" y="5" width="12" height="4" rx="1" fill={COLORS.bottleCap} />
      <clipPath id={`clip-${level}-${Math.round(ratio * 100)}`}>
        <rect x="2" y="9" width="22" height="30" rx="6" />
      </clipPath>
      <rect x="2" y="9" width="22" height="30" rx="6" fill={COLORS.bottleBody} stroke={COLORS.bottleStroke} strokeWidth="1" />
      <g clipPath={`url(#clip-${level}-${Math.round(ratio * 100)})`}>
        <rect x="2" y={39 - fillH} width="22" height={fillH} fill={fillColor} opacity="0.85" />
      </g>
    </svg>
  );
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

export default function App() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(!isFirebaseConfigured);
  const [syncing, setSyncing] = useState(false);
  const [tab, setTab] = useState("home");
  const [scanning, setScanning] = useState(false);
  const [scanUnsupported, setScanUnsupported] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [scannedCode, setScannedCode] = useState(null);
  const [unknownStep, setUnknownStep] = useState(null); // null | 'choose' | 'new' | 'link'
  const [pendingKnown, setPendingKnown] = useState(null); // item awaiting confirmation
  const [newName, setNewName] = useState("");
  const [newCycle, setNewCycle] = useState("30");
  const [newWarn, setNewWarn] = useState("3");
  const [newGenre, setNewGenre] = useState(GENRES[0]);
  const [editingItem, setEditingItem] = useState(null);
  const [editingContext, setEditingContext] = useState("home"); // 'home' | 'shopping'
  const [extendingItem, setExtendingItem] = useState(null);
  const [extendDays, setExtendDays] = useState("7");
  const [toast, setToast] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [yahooAppId, setYahooAppId] = useState("");
  const [warnPercent, setWarnPercent] = useState(20);
  const [lookup, setLookup] = useState({ loading: false, ok: false, error: null });

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const detectorRef = useRef(null);

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
      setUser(nextUser);
      setAuthReady(ready);
      if (nextUser) {
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
  }, []);

  const closeScan = () => {
    stopCamera();
    setScanning(false);
    setScannedCode(null);
    setUnknownStep(null);
    setPendingKnown(null);
    setManualCode("");
    setNewName("");
    setNewCycle("30");
    setNewWarn(String(calcWarnDays(30, warnPercent)));
    setNewGenre(GENRES[0]);
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
        setPendingKnown(owner);
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
      if (!("BarcodeDetector" in window)) {
        setScanUnsupported(true);
        return;
      }
      setScanUnsupported(false);
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
        setScanUnsupported(true);
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

  const submitManualCode = () => {
    if (!manualCode.trim()) return;
    handleDetected(manualCode.trim());
  };

  const confirmKnownReset = () => {
    if (!pendingKnown) return;
    const next = items.map((it) =>
      it.id === pendingKnown.id ? { ...it, lastPurchaseDate: todayISO(), extensionDays: 0 } : it
    );
    persist(next);
    showToast(`「${pendingKnown.name}」を補充として記録しました`);
    haptics.success();
    closeScan();
  };

  const cancelKnownReset = () => {
    setPendingKnown(null);
    setScannedCode(null);
    closeScan();
  };

  const registerNewItem = () => {
    if (!newName.trim() || !scannedCode) return;
    const item = {
      id: uid(),
      name: newName.trim(),
      genre: newGenre || "その他",
      barcodes: [scannedCode],
      cycleDays: Math.max(1, parseInt(newCycle, 10) || 30),
      warningDays: Math.max(0, parseInt(newWarn, 10) || 3),
      lastPurchaseDate: todayISO(),
      extensionDays: 0,
      spareStock: 0,
    };
    persist([...items, item]);
    showToast(`「${item.name}」を登録しました`);
    haptics.success();
    closeScan();
  };

  const handleRegisterClick = () => {
    if (!newName.trim() || !scannedCode) return;
    const isDuplicate = items.some((it) => it.name.trim().toLowerCase() === newName.trim().toLowerCase());
    if (isDuplicate) {
      setUnknownStep("duplicateConfirm");
    } else {
      registerNewItem();
    }
  };

  const linkToExisting = (itemId) => {
    const next = items.map((it) =>
      it.id === itemId
        ? { ...it, barcodes: [...new Set([...it.barcodes, scannedCode])], lastPurchaseDate: todayISO(), extensionDays: 0 }
        : it
    );
    persist(next);
    const target = items.find((it) => it.id === itemId);
    showToast(`「${target?.name}」の買い替えとして記録しました`);
    haptics.success();
    closeScan();
  };

  const resetCycleManually = (id) => {
    const next = items.map((it) => (it.id === id ? { ...it, lastPurchaseDate: todayISO(), extensionDays: 0 } : it));
    persist(next);
    const target = items.find((it) => it.id === id);
    showToast(`「${target?.name}」を使い切りリセットしました`);
    haptics.success();
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
    haptics.warning();
    persist(items.filter((it) => it.id !== id));
    setEditingItem(null);
  };

  const updateItemFields = (id, fields) => {
    persist(items.map((it) => (it.id === id ? { ...it, ...fields } : it)));
    haptics.success();
  };

  const enriched = items
    .map((it) => {
      const status = statusOf(it);
      const ratio = status.totalCycle > 0 ? status.daysLeft / status.totalCycle : 0;
      return { ...it, ...status, ratio };
    })
    .sort((a, b) => a.ratio - b.ratio);
  const urgentCount = enriched.filter((it) => it.level !== "safe").length;

  // Firebaseが設定されている場合のみ、ログインするまで中身を一切表示しない
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
        <button
          onClick={() => setShowSettings(true)}
          style={{ border: "none", background: "none", color: COLORS.inkSoft, padding: 6, marginTop: 2 }}
        >
          <Settings size={22} />
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: "0 16px 96px", overflowY: "auto" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: COLORS.inkSoft }}>読み込み中…</div>
        ) : tab === "home" ? (
          <HomeList
            items={enriched}
            onEdit={openEditFromHome}
          />
        ) : (
          <ShoppingList
            items={enriched}
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

      {/* Scan modal */}
      {scanning && (
        <ScanModal
          videoRef={videoRef}
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
          items={items}
          newName={newName}
          setNewName={setNewName}
          newCycle={newCycle}
          setNewCycle={handleNewCycleChange}
          newWarn={newWarn}
          setNewWarn={setNewWarn}
          newGenre={newGenre}
          setNewGenre={setNewGenre}
          lookup={lookup}
          onRegisterNew={handleRegisterClick}
          onConfirmDuplicate={registerNewItem}
          onLinkExisting={linkToExisting}
          onGoNew={() => setUnknownStep("new")}
          onGoLink={() => setUnknownStep("link")}
          onBackToChoose={() => setUnknownStep("choose")}
        />
      )}

      {/* Edit modal */}
      {editingItem && (
        <EditModal
          item={editingItem}
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
        />
      )}

      {/* Extend modal */}
      {extendingItem && (
        <ExtendModal
          item={extendingItem}
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
      {showSettings && (
        <SettingsModal
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
    item.daysLeft > 0 ? `あと ${item.daysLeft} 日` : item.daysLeft === 0 ? "本日が目安" : `${-item.daysLeft} 日超過`;
  const statusColors = {
    safe: { fg: COLORS.safe, bg: COLORS.safeBg },
    warn: { fg: COLORS.warn, bg: COLORS.warnBg },
    danger: { fg: COLORS.danger, bg: COLORS.dangerBg },
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
      <Bottle level={item.level} ratio={ratio} />
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
      {onExtend && (
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
      {open && <div style={{ marginTop: 6 }}>{children}</div>}
    </div>
  );
}

function HomeList({ items, onEdit }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Package size={34} color={COLORS.inkSoft} />}
        title="まだ何も登録されていません"
        body="右下の丸いボタンからバーコードをスキャンして、日用品を登録しましょう。"
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
  const urgent = items.filter((it) => it.level !== "safe");
  const safe = items.filter((it) => it.level === "safe");
  return (
    <div style={{ paddingTop: 8 }}>
      <div style={{ fontSize: 12, color: COLORS.inkSoft, marginBottom: 8 }}>
        同じ商品(または代わりの商品)のバーコードをスキャンすると、リストから消えます
      </div>
      {urgent.length === 0 ? (
        <div style={{ fontSize: 13, color: COLORS.inkSoft, padding: "12px 4px 4px" }}>
          今すぐ買うべきものはありません
        </div>
      ) : (
        urgent.map((it) => (
          <ItemCard key={it.id} item={it} onEdit={onEdit} onManualReset={onManualReset} onExtend={onExtend} showMemo />
        ))
      )}
      {urgent.length > 0 && safe.length > 0 && <div style={{ height: 22 }} />}
      {safe.length > 0 && (
        <div style={{ fontSize: 11, color: "#9BA69B", fontWeight: 700, marginBottom: 4, paddingLeft: 4 }}>
          まだ余裕があるもの
        </div>
      )}
      {safe.map((it) => (
        <CompactItemRow key={it.id} item={it} onEdit={onEdit} onExtend={onExtend} />
      ))}
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

function ModalShell({ onClose, children, title }) {
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
  const daysLeftAtWarn = Math.max(0, cycleDays - parseInt(warnDays, 10) || 0);

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
      {open && (
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
      )}
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
    videoRef,
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
    items,
    newName,
    setNewName,
    newCycle,
    setNewCycle,
    newWarn,
    setNewWarn,
    newGenre,
    setNewGenre,
    lookup,
    onRegisterNew,
    onConfirmDuplicate,
    onLinkExisting,
    onGoNew,
    onGoLink,
    onBackToChoose,
  } = props;

  if (pendingKnown) {
    return (
      <ModalShell onClose={onClose} title="この内容で記録しますか？">
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
          <div style={{ fontSize: 12, color: COLORS.inkSoft, marginTop: 6 }}>
            「買った」として記録し、使い切りサイクルをリセットします
          </div>
        </div>
        <button style={{ ...primaryBtn, marginBottom: 10 }} onClick={onConfirmKnown}>
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
      <ModalShell onClose={onClose} title="未登録のバーコードです">
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

  if (unknownStep === "new") {
    return (
      <ModalShell onClose={onClose} title="新しい商品を登録">
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
        <label style={labelStyle}>商品名</label>
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
        <CyclePicker days={parseInt(newCycle, 10) || 0} onChange={setNewCycle} />
        <p style={{ fontSize: 11.5, color: COLORS.inkSoft, marginTop: -6, marginBottom: 14 }}>
          買い物リストに追加するタイミングは設定の一括ルールが自動で適用されます。この商品だけ個別に調整したい場合は、在庫一覧から商品を選んで設定できます。
        </p>
        <button style={primaryBtn} onClick={onRegisterNew} disabled={!newName.trim()}>
          登録する
        </button>
        <button style={{ ...secondaryBtn, marginTop: 10 }} onClick={onBackToChoose}>
          戻る
        </button>
      </ModalShell>
    );
  }

  if (unknownStep === "duplicateConfirm") {
    return (
      <ModalShell onClose={onClose} title="同じ名前の商品があります">
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
      <ModalShell onClose={onClose} title="どの商品の買い替えですか？">
        {items.length === 0 ? (
          <p style={{ fontSize: 13, color: COLORS.inkSoft }}>登録済みの商品がまだありません。</p>
        ) : (
          linkGroups.map((group) => (
            <GenreAccordion key={group.genre} genre={group.genre} count={group.list.length} defaultOpen={false}>
              {group.list.map((it) => (
                <button
                  key={it.id}
                  onClick={() => onLinkExisting(it.id)}
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

  return (
    <ModalShell onClose={onClose} title="バーコードをスキャン">
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
          <video ref={videoRef} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <div
            style={{
              position: "absolute",
              inset: "18% 12%",
              border: "2px solid rgba(255,255,255,0.85)",
              borderRadius: 12,
            }}
          />
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

function ExtendModal({ item, days, setDays, onClose, onSubmit }) {
  const presets = [3, 7, 14];
  return (
    <ModalShell onClose={onClose} title={`「${item.name}」の期限を延長`}>
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

function EditModal({ item, onClose, onSave, onDelete, onManualReset, onOpenExtend, showBuyButton }) {
  const [name, setName] = useState(item.name);
  const [genre, setGenre] = useState(item.genre || "その他");
  const [cycleDays, setCycleDays] = useState(String(item.cycleDays));
  const [warningDays, setWarningDays] = useState(String(item.warningDays));
  const [barcodes, setBarcodes] = useState(item.barcodes);
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
  const [warnMode, setWarnMode] = useState("percent");

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
  const deleteBarcode = (index) => {
    haptics.warning();
    setBarcodes((prev) => prev.filter((_, i) => i !== index));
  };

  if (confirming) {
    return (
      <ModalShell onClose={onClose} title="この内容で記録しますか？">
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
            「買った」として記録し、使い切りサイクルをリセットします
          </div>
        </div>
        <button
          style={{ ...primaryBtn, marginBottom: 10 }}
          onClick={() => {
            onManualReset(item.id);
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
      <ModalShell onClose={onClose} title="この商品を削除しますか？">
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

  return (
    <ModalShell onClose={onClose} title="商品を編集">
      {showBuyButton && (
        <button
          style={{
            ...primaryBtn,
            marginBottom: 18,
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

      <FieldSection title="基本情報">
        <label style={labelStyle}>商品名</label>
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
            <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "'Zen Maru Gothic', sans-serif", color: COLORS.navy }}>
              {spareStock}
            </div>
            <div style={{ fontSize: 10.5, color: COLORS.inkSoft }}>個</div>
          </div>
          <button
            type="button"
            onClick={() => {
              haptics.light();
              setSpareStock((s) => s + 1);
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
        {barcodesOpen && (
          <div style={{ marginTop: 12 }}>
            {barcodes.length === 0 && (
              <div style={{ fontSize: 12, color: COLORS.inkSoft, marginBottom: 8 }}>
                バーコードが登録されていません。スキャンでの自動照合ができなくなります。
              </div>
            )}
            {barcodes.map((code, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
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
            ))}
          </div>
        )}
      </FieldSection>

      <button
        style={primaryBtn}
        onClick={() =>
          onSave({
            name: name.trim() || item.name,
            genre,
            memo: memo.trim(),
            spareStock: Math.max(0, spareStock),
            cycleDays: cycleNum(),
            warningDays: Math.max(0, parseInt(warningDays, 10) || 0),
            barcodes: barcodes.map((b) => b.trim()).filter(Boolean),
          })
        }
      >
        保存する
      </button>
      <button
        style={{ ...secondaryBtn, marginTop: 10, color: COLORS.danger, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
        onClick={() => setConfirmingDelete(true)}
      >
        <Trash2 size={16} /> この商品を削除
      </button>
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
  onClose,
}) {
  const [value, setValue] = useState(appId || "");
  const [percent, setPercent] = useState(warnPercent);

  return (
    <ModalShell onClose={onClose} title="設定">
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
