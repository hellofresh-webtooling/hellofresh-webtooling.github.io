# Graph Report - vloeistoffenkast-demo  (2026-06-18)

## Corpus Check
- 3 files · ~10,547 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 41 nodes · 71 edges · 7 communities
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a07a2e30`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]

## God Nodes (most connected - your core abstractions)
1. `tr()` - 15 edges
2. `migrateHashes()` - 5 edges
3. `aSh()` - 5 edges
4. `ShelfDetail()` - 5 edges
5. `dloc()` - 4 edges
6. `shL()` - 4 edges
7. `ConsumptionView()` - 4 edges
8. `ReportModal()` - 4 edges
9. `locName()` - 3 edges
10. `aPr()` - 3 edges

## Surprising Connections (you probably didn't know these)
- `App()` --calls--> `tr()`  [EXTRACTED]
  src/App.jsx → src/App.jsx  _Bridges community 1 → community 2_
- `ShelfDetail()` --calls--> `tr()`  [EXTRACTED]
  src/App.jsx → src/App.jsx  _Bridges community 1 → community 4_
- `QRPrintModal()` --calls--> `tr()`  [EXTRACTED]
  src/App.jsx → src/App.jsx  _Bridges community 1 → community 5_

## Communities (7 total, 0 thin omitted)

### Community 1 - "Community 1"
Cohesion: 0.22
Nodes (9): AccountLoginPanel(), AdminPanel(), AuditView(), FeedbackModal(), Hdr(), LoginCard(), ManualModal(), tr() (+1 more)

### Community 2 - "Community 2"
Cohesion: 0.33
Nodes (7): App(), aSh(), ConsumptionView(), dloc(), orderSummary(), ReportModal(), SdsControl()

### Community 3 - "Community 3"
Cohesion: 0.4
Nodes (5): dbSet(), hashPw(), isHashed(), keyFor(), migrateHashes()

### Community 4 - "Community 4"
Cohesion: 0.5
Nodes (5): aPr(), fCol(), ShelfDetail(), shL(), shP()

### Community 5 - "Community 5"
Cohesion: 0.67
Nodes (3): defCfgFor(), locName(), QRPrintModal()

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `tr()` connect `Community 1` to `Community 0`, `Community 2`, `Community 4`, `Community 5`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **Why does `migrateHashes()` connect `Community 3` to `Community 0`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._
- **Why does `ShelfDetail()` connect `Community 4` to `Community 0`, `Community 1`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._