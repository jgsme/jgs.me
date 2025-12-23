# Jujutsu 導入計画

このリポジトリで Jujutsu (jj) を有効化するための計画。

## ステップ 1: Jujutsu のインストール確認

まず、開発環境に `jj` コマンドがインストールされているかを確認します。

```bash
jj --version
```

もしインストールされていない場合は、公式ドキュメントに従ってインストールしてください。

- [Installation - Jujutsu](https://github.com/martinvonz/jj/blob/main/docs/install.md)

Homebrew (macOS) の場合は、以下のコマンドでインストールできます。

```bash
brew install jj
```

## ステップ 2: Jujutsu の初期化

既存の Git リポジトリを Jujutsu で管理できるように、以下のコマンドを実行します。

```bash
jj init --git
```

このコマンドは、リポジトリのルートに `.jj` ディレクトリを作成し、Jujutsu の設定を初期化します。Git の設定はそのまま維持されます。

## ステップ 3: 状態確認

Jujutsu が有効化されたことを確認するために、以下のコマンドを実行して、リポジトリの状態を確認します。

```bash
jj status
```

Git のコミット履歴が Jujutsu 上で見えることを確認します。

```bash
jj log
```

以上で、Jujutsu の導入は完了です。以降は `jj` コマンドを使ってバージョン管理を行うことができます。
