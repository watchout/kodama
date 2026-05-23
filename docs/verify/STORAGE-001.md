---
id: VERIFY-STORAGE-001-001
status: Draft
traces:
  spec: [SPEC-STORAGE-001-001]
  impl: [IMPL-STORAGE-001-001]
  ops: [OPS-STORAGE-001-001]
---

# VERIFY: Persistent Context Store

## 0. 対応するSPEC / IMPL
- SPEC: `SPEC-STORAGE-001-001`
- IMPL: `IMPL-STORAGE-001-001`
- Feature: `STORAGE-001`

## 1. 機能テスト
### 1.1 AC-STORAGE-001-001 persist document with chunks
```gherkin
Feature: Persistent Context Store
  Scenario: Persist a local file document and chunks
    Given a registered local_files source
    When a document and two chunks are stored
    Then the document can be fetched with its chunks and source provenance
```

### 1.2 AC-STORAGE-001-002 lexical search over chunks
```gherkin
Feature: Persistent Context Store
  Scenario: Search chunk text through store interface
    Given chunks containing "GraphRAG" and "SQLite FTS5"
    When lexical search is invoked with "GraphRAG"
    Then the matching chunk is returned with document and source ids
```

### 1.3 AC-STORAGE-001-003 relation expansion basis
```gherkin
Feature: Persistent Context Store
  Scenario: Store and read relation edges
    Given two chunks and one entity
    When mentions and same_topic relations are stored
    Then relation queries can return adjacent records with weights
```

### 1.4 AC-STORAGE-001-004 retrieval audit
```gherkin
Feature: Persistent Context Store
  Scenario: Record retrieval run
    Given a lexical search result
    When a retrieval run is recorded
    Then query, candidate ids, selected ids, and score summary are persisted
```

## 2. 境界値テスト
| 項目 | 境界 | 期待値 |
|---|---|---|
| empty document text | allowed only if metadata marks binary or unavailable text | stored without FTS row |
| chunk text | non-empty | FTS row exists |
| relation weight | 0.0 to 1.0 | accepted |
| relation weight | outside 0.0 to 1.0 | rejected |
| lexical limit | 1 | one result max |

## 3. 異常系テスト
| 入力 | 期待するエラー |
|---|---|
| unknown entity type | validation error |
| unknown relation type | validation error |
| missing source id on document | validation error |
| chunk references unknown document in durable adapter | persistence error |
| malformed JSON metadata | impossible through typed API; adapter test guards serialization |

## 4. セキュリティテスト
| 攻撃ベクタ | 想定結果 |
|---|---|
| file path contains shell metacharacters | stored as data only |
| metadata contains token-like key | rejected or redacted by validation policy |
| FTS query contains quotes/operators | parsed through SQLite parameter binding, not string interpolation |
| restricted document status | not returned by future search unless policy permits |

## 5. Performance smoke
| 項目 | 基準 |
|---|---|
| insert 100 documents and 500 chunks | completes in local test DB without network |
| lexical search over 500 chunks | returns within test timeout |

## 6. Definition of Done
- [ ] Domain types and store interfaces exist.
- [ ] In-memory store tests pass.
- [ ] SQLite adapter tests pass.
- [ ] FTS5 lexical search is tested.
- [ ] Relation adjacency is tested.
- [ ] Retrieval run persistence is tested.
- [ ] `npm run type-check` passes.
- [ ] `npm test` passes.
- [ ] `npm run build` passes.
- [ ] Shirube gate check passes.
- [ ] Shirube trace verify passes.

## 7. トレース
| acceptance id | requirement | implementation target |
|---|---|---|
| AC-STORAGE-001-001 | FR-STORAGE-003, FR-STORAGE-004, FR-STORAGE-009 | `DocumentStore` |
| AC-STORAGE-001-002 | FR-STORAGE-007 | `DocumentStore.searchChunksLexical` |
| AC-STORAGE-001-003 | FR-STORAGE-005, FR-STORAGE-006 | `EntityStore`, `RelationStore` |
| AC-STORAGE-001-004 | FR-STORAGE-008 | `RetrievalRunStore` |

