# kodama — 開発開始ガイド

このファイルを読んで、指示に従って進めてください。

## あなたのタスク

CLAUDE.md を読んで、フレームワークの手順に従ってプロジェクトを立ち上げてください。

IDEA_CANVAS.md が存在しないので、ディスカバリーフローから開始してください。

## ルール

- 質問は1回に1つだけ（まとめて聞かない）
- 各ドキュメントは1つずつ生成して、都度ユーザーの確認を挟む
- 全Phase完了後、Gate A/B/C を通過させて開発可能な状態にする

## フロー

```
Phase 1: ディスカバリー（ヒアリング → IDEA_CANVAS等を生成）
Phase 2: 事業設計（IDEA_CANVAS → PERSONA → COMPETITOR → VALUE_PROP）
Phase 3: プロダクト設計（PRD → FEATURE_CATALOG → UI_STATE → 各機能SSOT）
Phase 4: 技術設計（TECH_STACK → API → DB → CROSS_CUTTING → 規約）
Phase 5: 実装計画（framework plan → Gate B 通過）
Phase 6: 環境構築（Gate A 通過）
Phase 7: SSOT品質確認（Gate C 通過）
Phase 8: 開発開始
```

まず「どんなサービスを作りたいですか？」から始めてください。
