# Mycelium Protocol - Gameplay Review & Improvement Suggestions

Generated from playtest session on the dev server (localhost:5173/mycelium)

---

## Executive Summary

The game has excellent bones - the fungal theme is fresh, the terminal UI is evocative, and the strain system creates meaningful choices. After playing through Stage 01 (DECOMPOSER), reaching 100% degradation, and selecting the Symbiote strain, several areas emerged as needing attention.

---

## 🎮 Core Gameplay Loop & Pacing

### Current State
- Satisfying early progression with first generator at 6Ψ
- Clear progression arc: Click → Buy → Degrade → Advance
- Cost scaling creates natural decision points (6 → 7.68 → 9.83 → 12.58 → 16.11 → 20.62...)

### Issues Identified

#### 1. Click Fatigue Risk
During my ~15-minute session, I clicked approximately 150 times. The click-to-passive ratio feels heavily skewed:
- Early game: 125× click multiplier (clicking is dominant)
- Late Stage 01: 4.5× click multiplier (still significant)
- With Symbiote strain: 4.5× BPS multiplier further reduces click value

**Impact:** Players may experience fatigue before reaching the "idle" satisfaction phase.

**Suggestion:** Consider either:
- Reducing early-game click dependency (e.g., start with small passive income)
- Or leaning into it as a "clicker" early on with auto-clicker unlocks

#### 2. Generator ROI Clarity
The math for generator efficiency is unclear without manual calculation:

| Generator | Cost | Output | Payback Time |
|-----------|------|--------|--------------|
| Hyphae (1st) | 6Ψ | +0.01/sec | 600 sec (10 min) |
| Hyphae (8th) | ~40Ψ | +0.01/sec | 4000 sec (67 min) |
| Mycelial Mat (1st) | 64Ψ | +0.08/sec | 800 sec (13 min) |

**Problem:** The higher-tier generator (Mycelial Mat) actually has BETTER ROI than late-game Hyphae, but this isn't communicated.

**Suggestion:** Add a "Payback Time" or "Efficiency Rating" display on each generator.

---

## 🧬 Strain System Analysis

### What Works Well
- Permanent choice creates genuine tension and replayability
- Symbiote's 2× passive multiplier felt immediately impactful
- "Mycorrhizal pulse" log entry suggests ongoing environmental effects

### What's Unclear/Opaque

#### 1. Incomplete Information at Decision Point
When selecting a strain, players see:
- **Parasite**: "High click power and reduced passive spread" + HEMORRHAGIC BURST
- **Symbiote**: "Abandon manual gathering" + MYCORRHIZAL NETWORK  
- **Saprophyte**: Locked, "feeds on inherited memory" + DECOMPOSITION LOOP

**Missing:**
- Specific numbers (e.g., "Click power: 4.5× → 9×", "Passive: 100% → 50%")
- How HEMORRHAGIC BURST / MYCORRHIZAL NETWORK / DECOMPOSITION LOOP actually work
- Whether these are one-time bonuses or ongoing mechanics

#### 2. Post-Selection Tracking
After choosing Symbiote, there's nowhere to see:
- What my current strain bonuses are
- How the "pulse" mechanic works (trigger conditions, frequency, magnitude)
- Whether I can unlock additional mutations/upgrades

**Suggestion:** Add a "Strain Status" section in the SPORE tab showing:
```
ACTIVE STRAIN: Symbiote (MYCORRHIZAL NETWORK)
- Passive Output: 200%
- Click Efficiency: 50%
- Pulse Bonus: +0.45 biomass every ~30 seconds
- Mutation Slots: 0/3 unlocked
```

---

## 📖 Narrative Integration (Exceptional)

### Strengths
- Log timestamps create emergent story ("13:05:01 PASSIVE: Absorption pathways identified")
- Stage transitions with poetic text feel cohesive:
  - "The veins collapse. The leaf no longer remembers being a leaf."
  - "Chloroplasts darken. What was green becomes brown, then black, then earth."
- Degradation % tied to narrative beats works well

### Untapped Potential
- **Defense Events**: Documentation mentions "defense events" but I never encountered any
- **Threat System**: "HOST THREAT: LOW" appears but never changes or creates tension
- **100% Degradation**: [CRITICAL] tag creates urgency but then... the leaf just sits there consumed

**Suggestion:** Consider adding:
- Random defense events that temporarily reduce BPS (creates "oh no" moments)
- Visual changes to the terminal as degradation increases (color shifts, glitch effects)
- A "victory" animation when reaching 100%

---

## 🖱️ UI/UX Issues & Bugs

### Critical Bugs

#### 1. Mycelial Mat Purchase Button Non-Functional
**Reproduction:**
- Accumulate 64+ Ψ
- Click "[ BUY 64Ψ ]" button for Mycelial Mat
- Biomass does not decrease
- Count stays at "01"
- No error message or feedback

**Impact:** Prevents progression through generator tiers. Players may waste time clicking fruitlessly.

**Note:** Hyphae Strand purchase button works correctly - biomass decreases, count increments, BPS updates.

#### 2. Stage Transition Not Completing
**Reproduction:**
- Reach 100% degradation on The Fallen Leaf
- Select strain (Symbiote in my case)
- Click "[ ADVANCE TO STAGE 2 ]" button multiple times
- Stage remains "01 / DECOMPOSER"
- No new host appears
- No error message

**Impact:** Blocks all late-game progression. Game appears to end at Stage 01.

### UX Friction

#### 1. Generator Count Visibility
- Numbers like "09" for Hyphae count are small and monospace - hard to parse at a glance
- No visual grouping (e.g., "9x Hyphae Strand" would be clearer)

#### 2. Cryptic Status Messages
- "SUBSTRATE: SUFFICIENT" on Mycelial Mat - sufficient for what? More mats? Something else?
- "CONTRIBUTION: 64.3%" - percentage of what total?
- "NEXT: +0.01/sec" - is this added to existing or replacing?

#### 3. Currency Scale Button
- The "i" button next to biomass doesn't appear to do anything when clicked
- Expected: Opens tooltip or modal explaining notation (Ψ, Γ, etc.)

#### 4. Missing Information
- Can't see lifetime biomass without switching to SPORE tab
- No indication of how much each generator contributes to degradation
- No "total BPS breakdown" showing each generator's contribution

**Suggestion:** Add a "Statistics" expandable section or tooltip showing:
```
BREAKDOWN:
- Hyphae Strand (9): +0.14/sec (64.2%)
- Mycelial Mat (1): +0.08/sec (35.8%)
- Strain Bonus (Symbiote): +0.22/sec (100% multiplier)
- Total: +0.44/sec
```

---

## 📊 Balance Observations

### Generator Efficiency
The math suggests a clear strategy emerges: save for Mycelial Mats, ignore Hyphae after unlocking.

**Problem:** Late-game Hyphae have terrible ROI compared to Mycelial Mats.

**Potential Solutions:**
1. **Synergy Bonuses**: Multiplicative effects for owning multiple generator types
   - "Network Diversity: +10% BPS per generator type owned"
   
2. **Tier Requirements**: Make later tiers require investment in earlier tiers
   - "Unlock next generator: Own 10x Hyphae AND 3x Mycelial Mat"
   
3. **Different Scaling Curves**: Make higher tiers scale faster but start weaker

### Click vs. Passive Balance
With Symbiote strain at +0.22/sec:
- Click value: ~1 Ψ per click
- 1 second of passive: 0.22 Ψ
- Click is worth ~4.5 seconds of passive

This means clicking is still somewhat valuable, but the fatigue-to-reward ratio is questionable.

**Suggestion:** Consider an auto-clicker unlock or "hold to click" mechanic for accessibility.

---

## 🎯 Long-Term Motivation

After reaching 100% degradation and selecting a strain, I found myself asking:

1. **What changes in Stage 2?** New host? New generator types? New threats?
2. **What's the final goal?** Reach Stage 11 and "Spore Release"? Max out all generators?
3. **Why prestige now vs. later?** 14.53% bonus seems low - what would I get if I pushed to Stage 5 first?

**Suggestion:** Add a "Roadmap" or "Upcoming" section in the SPORE tab:
```
UPCOMING:
Stage 02: Rotting Log
- New Generator: Rhizomorph (doubles all lower-tier output)
- Threat Level: MEDIUM (first defense events)
- Estimated Time: 45 minutes

Stage 03: Decaying Stump
- New Mechanic: Enemy immune responses
- Estimated Time: 2 hours
...
Stage 11: Ancient Forest
- Unlock: Spore Release (Prestige)
- Current Estimated Gamma (Γ): 14.53%
- Potential Gamma at Stage 11: 185%+
```

---

## 🔧 Priority Fixes (Ranked)

### P0 - Game-Breaking
1. **Fix Mycelial Mat purchase button** - Currently non-functional
2. **Fix Stage transition** - Cannot advance past Stage 01

### P1 - High Impact
3. **Add strain status display** - Show current bonuses in SPORE tab
4. **Add generator payback time** - Help players make informed decisions
5. **Fix/binding the "i" currency info button** - Currently does nothing

### P2 - Quality of Life
6. **Add BPS breakdown** - Show each generator's contribution
7. **Clarify "SUBSTRATE: SUFFICIENT"** - Explain what this means
8. **Add lifetime biomass to main view** - Reduce tab-switching

### P3 - Polish
9. **Visual feedback on purchases** - Animation or color flash
10. **Defense event implementation** - Add the missing threat system
11. **Auto-clicker or hold-to-click** - Reduce physical strain

---

## 💡 Feature Suggestions

### 1. Offline Gains Visualization
When returning after being away, show:
```
Welcome back, NODE_01
Offline for 2 hours 15 minutes
Gained: 1,782 Ψ (passive absorption continued)
Next host degradation: 12% → 34%
```

### 2. Export/Import Save
Given this is an incremental game, players will want:
- Save export to text/clipboard
- Import for cross-device play
- Cloud save indication (if implemented)

### 3. Keyboard Shortcuts
- Spacebar: Click to absorb
- 1-9: Buy generator (if affordable)
- Tab: Switch between TERMINAL/SPORE

### 4. Notification System
When unable to perform an action:
- "Insufficient biomass: need 6 more Ψ"
- "Generator locked: requires Stage 02"

Currently: Silent failure (especially problematic for the Mycelial Mat bug)

---

## 📝 Conclusion

Mycelium Protocol demonstrates strong foundational design with its unique fungal theme, evocative terminal aesthetic, and promising strain system. The narrative integration through timestamped logs is particularly effective.

The critical blockers are the **Mycelial Mat purchase bug** and the **Stage 02 transition bug**, which currently prevent players from experiencing the full game loop.

With fixes to these issues, plus clarity improvements around generator efficiency and strain mechanics, this has the potential to be a standout entry in the incremental genre. The "movement through hosts" concept (leaf → log → stump → etc.) creates natural progression milestones that feel more tangible than abstract number-go-up mechanics.

**Overall Assessment:** Solid core, atmospheric presentation, needs technical polish and clarity pass.

---

*Review written by: AI Playtester*
*Session duration: ~20 minutes*
*Progress reached: Stage 01 / 100% Degradation / Symbiote strain selected*
