---
id: OPS-STORAGE-001-001
status: Draft
traces:
  spec: [SPEC-STORAGE-001-001]
  impl: [IMPL-STORAGE-001-001]
  verify: [VERIFY-STORAGE-001-001]
---

# OPS: Persistent Context Store

## 0. 対応するSPEC / IMPL / VERIFY
- SPEC: `SPEC-STORAGE-001-001`
- IMPL: `IMPL-STORAGE-001-001`
- VERIFY: `VERIFY-STORAGE-001-001`
- Feature: `STORAGE-001`

## 1. 運用モード
STORAGE-001 は standard/lightweight Shirube mode で進める。strict start、merge-authority、role-bound governance は有効化しない。

## 2. DB 方針
- MVP は local SQLite。
- SQLite DB path は後続実装で環境変数または config file により指定する。
- Test は temporary DB または in-memory DB を使う。
- Migration は `schema_migrations` で version 管理する。

## 3. データ保持
- raw file content の保持可否は source `storage_mode` に従う。
- `index` mode では extracted text、metadata、chunk、relation を保存してよい。
- `reference` mode では raw content を保存せず、URI、metadata、permission/provenance を保存する。
- `ephemeral` mode では search/index 永続化を行わない。

## 4. 監査
最低限、retrieval run と source/document provenance を保存する。権限ロールが未設定のため、MVP では actor identity がある場合のみ記録し、権限制御の最終判断には使わない。

## 5. Backup / restore
Local dogfood では SQLite file のコピーを backup 単位とする。Postgres 移行時は logical export/import を別 feature として定義する。

## 6. Known pending governance
- `.github/workflows/merge-authority.yml` は governance activation まで pending。
- `.framework/archive/` は commit 対象外。
- Role bindings and publishPolicy are not configured yet.

