# 周年日記（On This Day）インデックス UI 実装計画

## 1. 概要

`on-this-day-index.json` のデータを基に、GitHub Contributions Graph を 3 次元的に拡張したような、周年記事のインデックスページを作成します。
ユーザーは 1 年を通じた記事の分布を、年ごとの層（レイヤー）として積み重なった 3D ブロック群として俯瞰することができます。

## 2. ビジュアルコンセプト

- **レイアウト:** GitHub Contributions Graph ライクな 52 週 x 7 日 のグリッド配置。
- **視点:** アイソメトリック（斜め上からの俯瞰視点）。
- **構成要素:**
  - **X 軸:** 週（1 月〜12 月）。
  - **Y 軸:** 曜日（日曜〜土曜）。
  - **Z 軸（高さ）:** 年（Year）。古い年を下層、新しい年を上層として積み上げます。
- **カラーリング:** 各「年」に対してユニークな色を割り当て、層ごとの区別を明確にします。

## 3. データ構造とマッピング

### 入力データ (`on-this-day-index.json`)

```typescript
{
  years: number[]; // [2020, 2021, 2022, ...]
  entries: {
    [mmdd: string]: [yearIndex, count][] // "0101": [[0, 1], [2, 3]]
  }
}
```

### ビジュアルへのマッピング方針

1.  **グリッド生成:** 366 日分（うるう年考慮）のカレンダーグリッドを生成。
2.  **スタック構築:** 各日付（`mmdd`）において、記事が存在する `yearIndex` に対応するブロックを 3D 空間の `(x, y, z)` 座標に配置します。
    - X: 週番号
    - Z: 曜日インデックス
    - Y (高さ): 積み上げ順序（0, 1, 2...）
    - ※ Three.js の座標系に合わせて適宜軸を調整します（例: Y を高さとするのが一般的）。

## 4. 技術アプローチ

### 4.1. フロントエンド構成

- **Framework:** React (Vike)
- **Visualization:** **React Three Fiber (R3F)** - Three.js の React ラッパー。
- **Styling:** Tailwind CSS (コンテナ周り)

### 4.2. 3D 実装手法 (React Three Fiber)

WebGL を使用し、パフォーマンスと表現力に優れた 3D グラフを構築します。

- **ライブラリ:**
  - `three`: コアライブラリ。
  - `@react-three/fiber`: React コンポーネントとして 3D シーンを記述。
  - `@react-three/drei`: `OrbitControls`（カメラ操作）、`OrthographicCamera`（アイソメトリック視点）、`Text` などの便利なヘルパー。
- **カメラ:** `OrthographicCamera` を使用し、遠近感のないアイソメトリック視点を実現します。
- **レンダリング:**
  - 各「日」の各「年」ブロックを `<mesh geometry={boxGeometry} material={yearMaterial} />` として描画。
  - パフォーマンス最適化が必要な場合（数千個以上）、`InstancedMesh` の利用を検討しますが、まずは単純なコンポーネント分割から開始します。
- **インタラクション:**
  - `OrbitControls` により、ユーザーは自由に視点を回転・ズーム可能。
  - `onPointerOver` / `onPointerOut` イベントでホバー効果（色変更やツールチップ）を実装。

### 4.3. カラーパレット生成

- 年のリスト (`years`) の長さに応じて、HSL 色空間上で色相（Hue）を等間隔に分割し、ユニークな色を動的に生成します。

## 5. 実装ステップ

### Step 1: データ取得と整形

- `packages/web/pages/on-this-day/+data.ts` を作成。
- `on-this-day-index.json` をフェッチし、3D レンダリングしやすい形式（座標付きオブジェクト配列など）に変換するロジックを実装。

### Step 2: ライブラリのセットアップ

- `three`, `@react-three/fiber`, `@react-three/drei`, `@types/three` をインストール。

### Step 3: 3D シーンの構築 (プロトタイプ)

- Canvas を設置し、基本的なカメラとライトを配置。
- ダミーデータを使って単純な立方体をグリッド状に並べて表示を確認。

### Step 4: データ連携とスタッキング実装

- 実際のデータを読み込み、年ごとの色分けと積み上げロジックを実装。
- カレンダー座標へのマッピング調整。

### Step 5: インタラクションと UI 調整

- ホバー時のツールチップ表示（Html Overlay を使用）。
- クリック時の遷移処理。
- 全体の見た目（背景色、ブロックの隙間、面取りなど）の調整。

## 6. 懸念点・考慮事項

- **バンドルサイズ:** Three.js は大きいため、適切なコード分割が必要（Vike がある程度処理してくれるはず）。
- **パフォーマンス:** ブロック数が多くなると描画負荷が増える。`InstancedMesh` への移行判断ラインを意識しておく。

## 7. ファイル構成案

```
packages/web/
  pages/
    on-this-day/
      +data.ts             // データ取得
      +Page.tsx            // メインページ (Canvas コンテナ)
      index.css            // 必要に応じて
      components/
        GraphScene.tsx     // 3Dシーン定義
        BlockStack.tsx     // 1日分の積み上げロジック
        YearBlock.tsx      // 個別のブロック
```
