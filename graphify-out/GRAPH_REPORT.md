# Graph Report - vloeistoffenkast-demo  (2026-06-22)

## Corpus Check
- 16 files · ~12,329 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 91 nodes · 205 edges · 10 communities
- Extraction: 86% EXTRACTED · 14% INFERRED · 0% AMBIGUOUS · INFERRED: 28 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `0e9ad8fe`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]

## God Nodes (most connected - your core abstractions)
1. `tr()` - 22 edges
2. `tr()` - 15 edges
3. `ShelfDetail()` - 9 edges
4. `aSh()` - 7 edges
5. `ConsumptionView()` - 7 edges
6. `ReportModal()` - 7 edges
7. `migrateHashes()` - 6 edges
8. `shL()` - 5 edges
9. `App()` - 5 edges
10. `QRPrintModal()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `FeedbackModal()` --calls--> `tr()`  [INFERRED]
  src/components/FeedbackModal.jsx → src/i18n/trans.js
- `SdsControl()` --calls--> `tr()`  [INFERRED]
  src/components/SdsControl.jsx → src/i18n/trans.js
- `ShelfDetail()` --calls--> `tr()`  [INFERRED]
  src/App.jsx → src/i18n/trans.js
- `QRPrintModal()` --calls--> `locName()`  [INFERRED]
  src/App.jsx → src/lib/db.js
- `Hdr()` --calls--> `tr()`  [INFERRED]
  src/components/shared.jsx → src/i18n/trans.js

## Communities (10 total, 0 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.12
Nodes (7): dbSet(), defCfgFor(), hashPw(), isHashed(), keyFor(), locName(), migrateHashes()

### Community 1 - "Community 1"
Cohesion: 0.19
Nodes (21): dloc(), tr(), AccountLoginPanel(), AdminPanel(), App(), aSh(), AuditView(), ConsumptionView() (+13 more)

### Community 2 - "Community 2"
Cohesion: 0.19
Nodes (14): locName(), aPr(), fCol(), ShelfDetail(), shL(), shP(), aPr(), defCfgFor() (+6 more)

### Community 3 - "Community 3"
Cohesion: 0.24
Nodes (7): SdsControl(), ConfirmModal(), Ftr(), Hdr(), HelloFreshLogo(), PinPad(), useFocusTrap()

### Community 4 - "Community 4"
Cohesion: 0.32
Nodes (9): FeedbackModal(), dbSet(), hashPw(), hashSha256(), isHashed(), keyFor(), migrateHashes(), toHex() (+1 more)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `tr()` connect `Community 1` to `Community 0`, `Community 2`, `Community 3`, `Community 4`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Why does `verifyPw()` connect `Community 4` to `Community 0`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Why does `tr()` connect `Community 1` to `Community 0`, `Community 2`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **Are the 17 inferred relationships involving `tr()` (e.g. with `App()` and `AccountLoginPanel()`) actually correct?**
  _`tr()` has 17 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `ShelfDetail()` (e.g. with `shL()` and `fCol()`) actually correct?**
  _`ShelfDetail()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `aSh()` (e.g. with `App()` and `ConsumptionView()`) actually correct?**
  _`aSh()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `ConsumptionView()` (e.g. with `dloc()` and `tr()`) actually correct?**
  _`ConsumptionView()` has 3 INFERRED edges - model-reasoned connections that need verification._