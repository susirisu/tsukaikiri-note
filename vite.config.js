import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// リポジトリ名に合わせて base を書き換えてください（例: "/tsukaikiri-note/"）
// ユーザー名.github.io というリポジトリ名で公開する場合は "/" のままでOKです
export default defineConfig({
  plugins: [react()],
  base: "/tsukaikiri-note/",
});
