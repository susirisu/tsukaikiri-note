# つかいきりノート

日用品のバーコードをスキャンして、使い切りタイミングを管理する買い忘れ防止アプリ。
完全無料（Firebase無料枠 + GitHub Pages）で、PWA対応（ホーム画面に追加してアプリのように使える）。

- 画面：GitHub Pages（静的ホスティング、無料）
- データ保存：Firebase Firestore（Googleログインで、どの端末からでも同期）
- オフライン時／未ログイン時：ブラウザのlocalStorageに保存されるので、ログインしなくても普通に使える

---

## 1. Firebaseプロジェクトを作る

1. https://console.firebase.google.com/ を開き、「プロジェクトを追加」
2. プロジェクト名を入力（例：tsukaikiri-note）。Googleアナリティクスは不要なのでOFFでよい
3. 作成が終わったら、プロジェクトのトップ画面で **Authentication** を開き、「始める」→ サインイン方法で **Google** を有効化
4. 左メニューの **Firestore Database** を開き、「データベースの作成」。本番環境モードで開始（リージョンは `asia-northeast1`＝東京 がおすすめ）
5. Firestoreの「ルール」タブを開き、このプロジェクトに含まれる `firestore.rules` の内容を貼り付けて公開（本人のデータだけ読み書きできるようにする設定です）

## 2. Webアプリを登録してAPIキーを取得

1. プロジェクトのトップ画面の歯車アイコン →「プロジェクトの設定」
2. 「マイアプリ」→ `</>`（ウェブ）アイコンをクリックしてアプリを登録（Firebase Hostingは使わないのでチェック不要）
3. 表示される `firebaseConfig` の値を、このプロジェクト内の `.env.example` を `.env` にコピーしたファイルに転記する

```
cp .env.example .env
# .env を開いて値を埋める
```

この値は公開されても問題ない種類のものです（実際のデータ保護は手順1-5のFirestoreルールで行っています）。

4. **Authentication → Settings → 承認済みドメイン** に、後で使うGitHub PagesのURL（例：`ユーザー名.github.io`）を追加してください。追加しないとGoogleログインが失敗します。

## 3. 利用を許可するアカウントを制限する

デフォルトのままだと、Googleアカウントさえあれば誰でもログインできてしまいます。自分（と許可した人）だけが使えるように、2箇所を設定してください。**特にfirestore.rulesの方が本当のセキュリティ境界（サーバー側で強制される制限）なので、こちらは必須です。**

1. **`firestore.rules`** を開き、`"your-email@gmail.com"` の部分を実際に許可したいGoogleアカウントのメールアドレスに書き換える（複数人いる場合はカンマ区切りで行を追加）。書き換えたら、Firebaseコンソール → Firestore Database → ルール タブに貼り直して公開する
2. **`.env`**（ローカル用）と、GitHub Secrets（公開用）の両方に `VITE_ALLOWED_EMAILS` を追加。値は同じメールアドレスをカンマ区切りで（例：`you@gmail.com,family@gmail.com`）

この2箇所を設定すると、許可されていないアカウントでログインした場合は自動的にログアウトされ、「認証されていないため表示できません」という画面が表示されます。

## 4. ローカルで動作確認

```
npm install
npm run dev
```

表示されたURL（`http://localhost:5173` など）をブラウザで開いて、ログインや商品登録ができるか確認してください。
バーコードスキャンはカメラ権限が必要なので、スマホの場合は同じWi-Fi内からアクセスするか、後述のGitHub Pages公開後（HTTPS）に試すのが確実です。

## 5. GitHubに公開する

1. GitHubで新しいリポジトリを作成（例：`tsukaikiri-note`）
2. `vite.config.js` の `base` を、リポジトリ名に合わせて書き換える（例：`/tsukaikiri-note/`）。`public/manifest.json` の `start_url` と `scope` も同じ値に揃えてください
3. コードをpush

```
git init
git add .
git commit -m "init"
git branch -M main
git remote add origin https://github.com/ユーザー名/tsukaikiri-note.git
git push -u origin main
```

4. リポジトリの **Settings → Pages** で、Source を「GitHub Actions」に設定
5. リポジトリの **Settings → Secrets and variables → Actions** で、`.env` に入れた7つの値（Firebaseの6つ＋`VITE_ALLOWED_EMAILS`）をそれぞれ同じ名前でSecretとして登録
6. mainブランチにpushすると自動でビルド・公開されます（Actionsタブで進捗を確認できます）
7. 公開されたURL（`https://ユーザー名.github.io/tsukaikiri-note/`）にスマホでアクセスし、「ホーム画面に追加」するとアプリのように使えます

## Yahoo!ショッピング連携について

アプリ内の設定画面から、Yahoo!デベロッパーネットワークで取得したアプリケーションIDを入力すると、未登録バーコードの商品名を自動取得できます。この値はブラウザのlocalStorage（およびログイン時はFirestore）に保存され、コードには含まれません。

## 技術的な注意点

- バーコードスキャンは `BarcodeDetector` API を使用しており、Android版Chromeなど対応ブラウザが必要です。iPhone(Safari)など非対応ブラウザでは、バーコード番号の手入力にフォールバックします（カメラでの自動読み取り自体は行われません）。
- カメラ・振動(Vibration API)はいずれもHTTPS環境でのみ動作します。GitHub Pagesは自動的にHTTPSになるので問題ありません。
- 振動(Haptics)はAndroid版Chromeなど対応ブラウザ・実機のみで動作します。PC(Windowsなど)のブラウザには振動するハードウェア自体がないため、動作確認はスマホ実機で行ってください。iPhone(Safari)は仕様上Vibration API自体に対応していません。
- Firebaseを設定しなくてもアプリ自体は動きます（ローカル保存のみ、単一端末での利用になります）。
