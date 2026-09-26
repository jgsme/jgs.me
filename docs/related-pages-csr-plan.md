# CSR 遷移時の関連ページ保持を修正する計画

## 現象と原因

記事なしページ間の CSR 遷移で、遷移前の「関連ページ」が残る。
`Backlinks` は `initial` と `initialHasMore` を `useState` の初期値に使い、props 更新時には更新しない。呼び出し元の 2 箇所に title に対応する key がなく、コンポーネントが再利用されると一覧・もっと見る・読み込み状態が前のページのままになる。

`+data.ts` は記事なしページでも遷移先 title の被リンクを取得している。「似てるかもしれんページ」は別コンポーネントで、今回の修正対象外。

## 検証

基点: origin/main `f4c8cef`。
実際の `Backlinks` と `PageTileGrid` を React 19.2.8 / ReactDOM でバンドルし、Chrome headless で同じ root の props を更新した。検証用ファイルは OS の一時ディレクトリにのみ作成した。

1. A の初期一覧を表示: A-related。
2. B の初期一覧に props を更新: A-related のまま。
3. 空の初期一覧に props を更新: A-related のまま。
4. B の title を key に指定: B-related に切り替わる。
5. 空一覧の title を key に指定: 一覧が消える。

DOM 出力で上記を確認した。Chrome のプロセスはコマンドの 60 秒制限内に終了せずタイムアウトした。本番サイトでの実際の CSR 操作は未検証。

セキュリティ影響: NONE。今回の調査範囲で攻撃経路は見つかっていない。

## 修正手順（承認済み）

1. 記事ページの呼び出し元を通す回帰テストを追加する。記事なし A → B → 関連なし C の再レンダーで、各遷移先の一覧だけが表示されることを検証し、現状で失敗することを確認する。
2. `packages/web/pages/article/@title/+Page.tsx` の `Backlinks` 呼び出し 2 箇所に `key={d.title}` を指定する。title 変更時に state 全体をリセットする。
3. 「もっと見る」で追加した一覧・hasMore・loading が別 title に引き継がれないことをテストする。取得中に遷移し、旧リクエストが完了しても新しい一覧に混ざらないことも確認する。
4. clip 間と記事なしページ間の遷移を検証する。同じ title 内の「もっと見る」は従来どおり追加されることを確認する。
5. `pnpm --filter web test` と必要な型検査を実行する。DOM テスト用の依存追加が必要かは実装時に既存構成に合わせて判断する。

## 完了条件

1. CSR 遷移直後から遷移先の関連ページとボタン状態のみを表示する。
2. 関連ページがない遷移先に古い一覧が残らない。
3. 旧ページの非同期取得結果が遷移先に混ざらない。
4. SSR の初期一覧と同一ページ内の追加取得を維持する。

API・DB・類似ページ検索の変更は行わない。

## 実装・検証結果

1. `Backlinks` 呼び出し 2 箇所に title の key を追加した。
2. DOM テスト用の開発依存として `happy-dom` を追加した。実際の Page と Backlinks を使用し、Vike のデータ供給と client-only island 境界のみ差し替えた。
3. 修正前は記事なし・clip の両方で A → B の一覧置き換えテストが失敗し、修正後は成功した。
4. 追加取得済み一覧、同じ title の再レンダー、遷移中の古いリクエスト完了、loading/hasMore のリセット、空一覧、SSR を含む 8 件のテストを追加した。
5. web の全 268 テスト、TypeScript 型検査、production build が成功した。本番サイトでの CSR 操作は未検証。
6. 当初のコミット操作は main 上と判定されガードに拒否された。PR 作成時に `git -C` で対象 worktree を明示し、`fix/related-pages-behavior` へのコミットが成功した。
