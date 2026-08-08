import { doc, getDoc, setDoc } from "firebase/firestore";
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { auth, db, googleProvider, isFirebaseConfigured } from "./firebase";

const LOCAL_PREFIX = "tsukaikiri:";
export const KNOWN_KEYS = ["household-items", "yahoo-app-id", "warn-percent", "dark-mode"];

let currentUser = null;
let authReady = !auth; // Firebase未設定なら最初から「確認済み」扱いにする
const authListeners = [];

if (auth) {
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    authReady = true;
    authListeners.forEach((fn) => fn(user, authReady));
  });
}

export function subscribeAuth(fn) {
  authListeners.push(fn);
  // 現在の状態をすぐに1回通知
  fn(currentUser, authReady);
  return () => {
    const i = authListeners.indexOf(fn);
    if (i >= 0) authListeners.splice(i, 1);
  };
}

export function getCurrentUser() {
  return currentUser;
}

export async function signIn() {
  if (!auth) throw new Error("Firebaseが設定されていません");
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutUser() {
  if (!auth) return;
  await signOut(auth);
}

function localGet(key) {
  const raw = localStorage.getItem(LOCAL_PREFIX + key);
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && "value" in parsed && "updatedAt" in parsed) {
      return { value: parsed.value, updatedAt: parsed.updatedAt || 0 };
    }
  } catch (e) {
    // JSONとして壊れているなど：生の値扱いにフォールバック
  }
  // 旧形式（更新日時管理を入れる前に保存されたデータ）。日時が分からないので0扱いにし、
  // クラウド側に何かあればそちらを優先させる。
  return { value: raw, updatedAt: 0 };
}
function localSet(key, value, updatedAt = Date.now()) {
  localStorage.setItem(LOCAL_PREFIX + key, JSON.stringify({ value, updatedAt }));
}

// key-value インターフェース（アーティファクト版の window.storage と互換）
export const storage = {
  async get(key) {
    const local = localGet(key);
    if (local !== null) return { key, value: local.value };
    throw new Error("not found");
  },
  async set(key, value) {
    const updatedAt = Date.now();
    localSet(key, value, updatedAt);
    if (currentUser && db) {
      try {
        await setDoc(doc(db, "users", currentUser.uid, "data", key), { value, updatedAt });
      } catch (e) {
        console.warn("クラウドへの保存に失敗しました（ローカルには保存済みです）", e);
      }
    }
    return { key, value };
  },
};

// ログイン時・手動同期ボタンから呼ぶ：キーごとにローカルとクラウドの updatedAt を比較し、
// 新しい方を勝たせる（同時刻ならクラウドを優先）。片方にしか無ければそちらをそのまま採用する。
export async function syncOnLogin() {
  if (!currentUser || !db) return;
  for (const key of KNOWN_KEYS) {
    try {
      const snap = await getDoc(doc(db, "users", currentUser.uid, "data", key));
      const local = localGet(key);
      const cloud = snap.exists() ? snap.data() : null;
      const cloudUpdatedAt = cloud?.updatedAt || 0;
      const localUpdatedAt = local?.updatedAt || 0;

      if (cloud && local) {
        if (cloudUpdatedAt >= localUpdatedAt) {
          // クラウドの方が新しい（または同時刻）→ ローカルをクラウドの内容で上書き
          localSet(key, cloud.value, cloudUpdatedAt);
        } else {
          // ローカルの方が新しい → クラウドをローカルの内容で上書き
          await setDoc(doc(db, "users", currentUser.uid, "data", key), {
            value: local.value,
            updatedAt: localUpdatedAt,
          });
        }
      } else if (cloud && !local) {
        localSet(key, cloud.value, cloudUpdatedAt);
      } else if (!cloud && local) {
        await setDoc(doc(db, "users", currentUser.uid, "data", key), {
          value: local.value,
          updatedAt: localUpdatedAt || Date.now(),
        });
      }
      // 両方無ければ何もしない
    } catch (e) {
      console.warn(`同期に失敗しました: ${key}`, e);
    }
  }
}

const ALLOWED_EMAILS = (import.meta.env.VITE_ALLOWED_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

// VITE_ALLOWED_EMAILSが未設定の場合は制限しません（本番運用では必ず設定してください）
export function isEmailAllowed(email) {
  if (ALLOWED_EMAILS.length === 0) return true;
  return !!email && ALLOWED_EMAILS.includes(email.toLowerCase());
}

export { isFirebaseConfigured };
