# Graph Report - vloeistoffenkast-demo  (2026-06-19)

## Corpus Check
- 10 files · ~11,082 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 67 nodes · 145 edges · 10 communities
- Extraction: 83% EXTRACTED · 17% INFERRED · 0% AMBIGUOUS · INFERRED: 25 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `56061e09`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]

## God Nodes (most connected - your core abstractions)
1. `tr()` - 16 edges
2. `tr()` - 15 edges
3. `ShelfDetail()` - 9 edges
4. `ConsumptionView()` - 7 edges
5. `ReportModal()` - 7 edges
6. `aSh()` - 6 edges
7. `migrateHashes()` - 6 edges
8. `shL()` - 5 edges
9. `App()` - 5 edges
10. `QRPrintModal()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `ShelfDetail()` --calls--> `aPr()`  [INFERRED]
  src/App.jsx → src/constants.js
- `ShelfDetail()` --calls--> `shL()`  [INFERRED]
  src/App.jsx → src/constants.js
- `App()` --calls--> `tr()`  [INFERRED]
  src/App.jsx → src/i18n/trans.js
- `ShelfDetail()` --calls--> `tr()`  [INFERRED]
  src/App.jsx → src/i18n/trans.js
- `ConsumptionView()` --calls--> `tr()`  [INFERRED]
  src/App.jsx → src/i18n/trans.js

## Communities (10 total, 0 thin omitted)

### Community 1 - "Community 1"
Cohesion: 0.26
Nodes (13): tr(), AccountLoginPanel(), AdminPanel(), AuditView(), defCfgFor(), FeedbackModal(), Hdr(), locName() (+5 more)

### Community 2 - "Community 2"
Cohesion: 0.31
Nodes (9): dloc(), App(), aSh(), ConsumptionView(), dloc(), orderSummary(), ReportModal(), SdsControl() (+1 more)

### Community 3 - "Community 3"
Cohesion: 0.31
Nodes (8): locName(), aPr(), defCfgFor(), defI(), pL(), shL(), shP(), uCol()

### Community 4 - "Community 4"
Cohesion: 0.6
Nodes (5): dbSet(), hashPw(), isHashed(), keyFor(), migrateHashes()

### Community 5 - "Community 5"
Cohesion: 0.4
Nodes (6): aPr(), fCol(), ShelfDetail(), shL(), shP(), fCol()

### Community 6 - "Community 6"
Cohesion: 0.4
Nodes (5): dbSet(), hashPw(), isHashed(), keyFor(), migrateHashes()

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `tr()` connect `Community 1` to `Community 0`, `Community 2`, `Community 5`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Why does `tr()` connect `Community 1` to `Community 0`, `Community 2`, `Community 5`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Why does `ShelfDetail()` connect `Community 5` to `Community 0`, `Community 1`, `Community 3`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **Are the 14 inferred relationships involving `tr()` (e.g. with `App()` and `Hdr()`) actually correct?**
  _`tr()` has 14 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `ShelfDetail()` (e.g. with `shL()` and `fCol()`) actually correct?**
  _`ShelfDetail()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `ConsumptionView()` (e.g. with `dloc()` and `tr()`) actually correct?**
  _`ConsumptionView()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `ReportModal()` (e.g. with `dloc()` and `aSh()`) actually correct?**
  _`ReportModal()` has 3 INFERRED edges - model-reasoned connections that need verification._