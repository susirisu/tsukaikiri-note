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
  return localStorage.getItem(LOCAL_PREFIX + key);
}
function localSet(key, value) {
  localStorage.setItem(LOCAL_PREFIX + key, value);
}

// key-value インターフェース（アーティファクト版の window.storage と互換）
export const storage = {
  async get(key) {
    const local = localGet(key);
    if (local !== null) return { key, value: local };
    throw new Error("not found");
  },
  async set(key, value) {
    localSet(key, value);
    if (currentUser && db) {
      try {
        await setDoc(doc(db, "users", currentUser.uid, "data", key), {
          value,
          updatedAt: Date.now(),
        });
      } catch (e) {
        console.warn("クラウドへの保存に失敗しました（ローカルには保存済みです）", e);
      }
    }
    return { key, value };
  },
};

// ログイン直後に1回だけ呼ぶ：クラウドにデータがあれば取り込み、なければローカルの内容をアップロードする
export async function syncOnLogin() {
  if (!currentUser || !db) return;
  for (const key of KNOWN_KEYS) {
    try {
      const snap = await getDoc(doc(db, "users", currentUser.uid, "data", key));
      if (snap.exists()) {
        localSet(key, snap.data().value);
      } else {
        const local = localGet(key);
        if (local !== null) {
          await setDoc(doc(db, "users", currentUser.uid, "data", key), {
            value: local,
            updatedAt: Date.now(),
          });
        }
      }
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
