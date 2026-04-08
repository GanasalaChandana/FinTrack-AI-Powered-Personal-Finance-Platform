# FinTrack Visual Refresh — Design Preview

## 1. COLOR PALETTE SYSTEM

### Primary Colors
```
🟦 Indigo (Primary)
   - Indigo-50:   #EEF2FF (backgrounds)
   - Indigo-100:  #E0E7FF
   - Indigo-500:  #6366F1 (actions, highlights)
   - Indigo-600:  #4F46E5 (primary brand)
   - Indigo-700:  #4338CA (hover states)
   - Indigo-900:  #1E1B4B (dark text)

🟢 Emerald (Success)
   - Emerald-100:  #D1FAE5
   - Emerald-500:  #10B981
   - Emerald-600:  #059669 (success actions)
   - Emerald-700:  #047857 (hover)

🔴 Red (Error/Alert)
   - Red-100:     #FEE2E2
   - Red-500:     #EF4444
   - Red-600:     #DC2626 (destructive actions)
   - Red-700:     #B91C1C (hover)

🟡 Amber (Warning)
   - Amber-100:   #FEF3C7
   - Amber-500:   #F59E0B
   - Amber-600:   #D97706 (warning states)

🔵 Cyan (Accents/Charts)
   - Cyan-500:    #06B6D4
   - Cyan-600:    #0891B2

🩷 Pink (Secondary Accent)
   - Pink-500:    #EC4899
   - Pink-600:    #DB2777
```

### Dark Mode Colors
```
🌙 Dark Theme
   - Dark-50:     #F9FAFB (light text)
   - Dark-100:    #F3F4F6
   - Dark-200:    #E5E7EB
   - Dark-700:    #374151 (cards/sections)
   - Dark-800:    #1F2937 (backgrounds)
   - Dark-900:    #111827 (deep backgrounds)
```

### Semantic Color Usage
```
✅ Success/Positive:        Emerald-600
❌ Error/Negative:          Red-600
⚠️  Warning:                Amber-600
ℹ️  Information:             Indigo-600
💬 Informational:           Cyan-600
💡 Highlight/Feature:       Pink-600

📊 Chart Colors (for spending/income categories):
   - Category 1: Indigo-600  (Groceries)
   - Category 2: Emerald-600 (Transport)
   - Category 3: Cyan-600    (Entertainment)
   - Category 4: Pink-600    (Utilities)
   - Category 5: Amber-600   (Shopping)
   - Category 6: Red-600     (Subscriptions)
```

---

## 2. TYPOGRAPHY SYSTEM

### Font Pairing
```
Primary (Headers):     Inter Bold/SemiBold — Modern, clean, professional
Body Text:            Inter Regular — Excellent readability
Monospace (Numbers):  JetBrains Mono — For financial values & codes
```

### Scale & Sizes
```
Display:              48-56pt bold  (Page titles, hero sections)
H1 (Heading 1):       32-40pt bold  (Section headers)
H2 (Heading 2):       24-28pt semibold (Subsection headers)
H3 (Heading 3):       18-20pt semibold (Card titles)
Body Large:           16pt regular  (Primary text)
Body:                 14pt regular  (Standard paragraph text)
Body Small:           12pt regular  (Secondary info, hints)
Label:                11pt semibold (Form labels, tags)
Caption:              10pt regular  (Captions, timestamps)

Line Heights:
   - Display:  1.1 (tight, impactful)
   - Headers:  1.2 (clean, scannable)
   - Body:     1.6 (readable, spacious)
   - Labels:   1.4 (clear, concise)
```

### Typography Examples
```
DISPLAY
The Future of Your Finances

H1 - Dashboard Overview
Welcome back, Sarah

H2 - Financial Summary
Your spending by category

H3 - Card Title
Monthly Transactions

Body
Track your spending across multiple accounts and never miss an expense. 
Real-time notifications keep you in control.

Caption
Last updated: 3 hours ago
```

---

## 3. SPACING & SIZING SYSTEM

### Spacing Scale
```
xs:   4px    (small gaps, tight spacing)
sm:   8px    (small components)
md:   12px   (standard padding)
lg:   16px   (generous padding)
xl:   24px   (section spacing)
2xl:  32px   (major section breaks)
3xl:  48px   (page margins)
```

### Component Sizing
```
Button Heights:
   - Small:    28px (tight UI)
   - Regular:  40px (primary CTA)
   - Large:    48px (hero/attention-grabbing)

Input Heights:
   - Standard: 40px (forms)
   - Compact:  32px (filters, sidebars)

Card Padding:
   - Compact:  12px (dashboards)
   - Regular:  16px (forms, dialogs)
   - Spacious: 24px (featured content)

Border Radius:
   - Small:    4px  (minimal rounding)
   - Default:  8px  (standard components)
   - Large:    12px (cards, modals)
   - Full:     9999px (badges, avatars)
```

---

## 4. COMPONENT EXAMPLES

### Buttons

#### Primary Button
```
┌─────────────────────────┐
│  ✓ Add Transaction      │  ← Indigo-600, 40px height
└─────────────────────────┘
Hover:  Indigo-700 (darker)
Active: Indigo-800 (pressed state)
Disabled: Gray-300 (desaturated)

Padding: 0 16px
Font: 14pt semibold
Icon margin: 8px right
```

#### Secondary Button
```
┌─────────────────────────┐
│  ⟳ Refresh              │  ← Indigo-100 bg, Indigo-700 text
└─────────────────────────┘
Hover:  Indigo-200 bg
Border: 1px Indigo-200
```

#### Danger Button
```
┌─────────────────────────┐
│  🗑  Delete Account      │  ← Red-600
└─────────────────────────┘
Hover:  Red-700
Warning text: "This cannot be undone"
```

#### Ghost Button
```
┌─────────────────────────┐
│  ← Back                 │  ← Transparent, text-only
└─────────────────────────┘
Hover:  Light background
No border
Minimal visual weight
```

---

### Cards

#### Transaction Card
```
╔════════════════════════════════════════╗
║                                        ║
║  🛒 Coffee Shop          $4.50        ║  ← Icon, label, amount
║  Groceries • Today at 9:42 AM         ║  ← Category, timestamp
║                                        ║
╚════════════════════════════════════════╝

Padding: 16px
Border: none
Shadow: 0 1px 3px rgba(0,0,0,0.1)
Background: White (#FFFFFF)
Hover: Shadow increases, subtle lift
Dark mode: Dark-700 (#374151)
```

#### Account Summary Card
```
╔════════════════════════════════════════╗
║  Checking Account                      ║
║  ──────────────────────────────────── ║
║  Current Balance                       ║
║  $12,456.89                            ║  ← Large, bold number
║                                        ║
║  ▲ +$845.00 this month (↑ 7.3%)       ║  ← Green accent
╚════════════════════════════════════════╝

Background gradient (subtle):
  Light mode: White → Indigo-50
  Dark mode:  Dark-800 → Dark-700
Border: 1px Indigo-200 (light) / Dark-600 (dark)
```

#### Budget Card (with progress)
```
╔════════════════════════════════════════╗
║  Groceries                             ║
║  $280 of $400 budget     [70%]        ║  ← Progress bar
║  ████████████░░░░░░░░░░░             ║
║  $120 remaining                        ║
╚════════════════════════════════════════╝

Progress bar:
  Fill: Emerald-600 (on track) → Amber-600 (warning) → Red-600 (exceeded)
  Background: Gray-200 / Dark-600
Height: 6px
Border radius: 3px
```

---

### Form Inputs

#### Text Input
```
Label: Email Address
┌──────────────────────────────────────┐
│ sarah@example.com                    │  ← 40px height
└──────────────────────────────────────┘
Border: 1px Gray-300 (light) / Dark-600 (dark)
Focus: 2px solid Indigo-600 (glow effect)
Padding: 0 12px
Font: 14pt

Error state:
┌──────────────────────────────────────┐
│ sarah@invalid                        │
└──────────────────────────────────────┘
Border: 1px Red-500
Helper text: "Please enter a valid email"  (Red-600)

Placeholder:
  Color: Gray-400
  Opacity: 0.6
```

#### Select/Dropdown
```
Filter by Category ▼
┌──────────────────────────────────────┐
│ All Categories                    ▼  │
└──────────────────────────────────────┘

Expanded:
┌──────────────────────────────────────┐
│ All Categories                    ▲  │
├──────────────────────────────────────┤
│ 🛒 Groceries                         │
│ 🚗 Transportation                    │
│ 🎬 Entertainment                     │
│ 🏠 Utilities                         │
└──────────────────────────────────────┘

Selected item: Indigo-600 background
Hover: Light Indigo-100 background
```

#### Toggle Switch
```
Notifications  [●────]  OFF
                 └─ Indigo-600 circle
                 └─ Gray-400 track

Notifications  [────●]  ON
                    └─ Indigo-600 circle
                    └─ Indigo-300 track

Animation: Smooth 200ms transition
```

#### Date Picker
```
From Date                To Date
┌──────────────────┐  ┌──────────────────┐
│ Mar 01, 2026  ▼  │  │ Mar 31, 2026  ▼  │
└──────────────────┘  └──────────────────┘

Calendar popup:
┌─────────────────────────────────────┐
│ ← March 2026 →                      │
├─────────────────────────────────────┤
│ S  M  T  W  T  F  S                │
│    1  2  3  4  5  6                │
│ 7  8  9 10 11 12 13                │
│14 15 16[17]18 19 20   ← Today     │
│21 22 23 24 25 26 27                │
│28 29 30 31                          │
└─────────────────────────────────────┘

Selected date: Indigo-600 background
Today: Indigo-300 circle outline
Disabled dates: Gray-300 text
```

---

### Modals & Dialogs

#### Add Transaction Modal
```
╔═══════════════════════════════════════╗
║  ✕                                    ║  ← Close button (top-right)
║                                       ║
║  Add New Transaction                  ║  ← H2 header
║                                       ║
║  Description                          ║
║  ┌─────────────────────────────────┐ ║
║  │ Coffee at Brew & Co         │   │ ║
║  └─────────────────────────────────┘ ║
║                                       ║
║  Amount                               ║
║  ┌─────────────────────────────────┐ ║
║  │ $4.50                       │   │ ║
║  └─────────────────────────────────┘ ║
║                                       ║
║  Category  ▼                          ║
║  ┌─────────────────────────────────┐ ║
║  │ Groceries                   ▼  │ ║
║  └─────────────────────────────────┘ ║
║                                       ║
║  ┌──────────────┐  ┌──────────────┐  ║
║  │ Cancel       │  │ Save         │  ║  ← Buttons (right-aligned)
║  └──────────────┘  └──────────────┘  ║
║                                       ║
╚═══════════════════════════════════════╝

Backdrop: rgba(0,0,0,0.5) (semi-transparent)
Modal padding: 32px
Title: H2, Indigo-900
Inputs: Standard 40px height
Buttons: 40px height, spaced 12px apart
Border radius: 12px
Shadow: 0 20px 25px -5px rgba(0,0,0,0.1)
Animation: Fade in 200ms, scale 1.0-1.05
```

#### Confirmation Dialog
```
╔═══════════════════════════════════════╗
║                                       ║
║  ⚠️  Delete Transaction?              ║  ← Warning icon
║                                       ║
║  This action cannot be undone.        ║  ← Body text (14pt)
║  Are you sure you want to delete      ║
║  "Coffee Shop" transaction?           ║
║                                       ║
║              ┌──────────────────┐     ║
║              │ Delete (Red-600) │     ║  ← Primary action (danger)
║              └──────────────────┘     ║
║          ┌──────────────────────┐     ║
║          │ Keep (secondary)     │     ║
║          └──────────────────────┘     ║
║                                       ║
╚═══════════════════════════════════════╝

Primary button: Red-600 (danger context)
Secondary button: Gray-300 background
Width: 400px (standard dialog)
Button stack: Full width, 12px gap
```

#### Success Toast
```
╔══════════════════════════════════════════╗
║  ✓ Transaction saved successfully       ║  ← Emerald icon
║  Tap to undo                            ║  ← Action link
╚══════════════════════════════════════════╝

Position: Bottom-right, 16px from edges
Background: Emerald-600
Text: White
Auto-dismiss: 4 seconds
Animation: Slide up 300ms, fade out 200ms
Icon margin: 12px right
Action link: Underlined, hover = darker
```

---

## 5. PAGE LAYOUT MOCKUPS

### Dashboard Page

```
╔═══════════════════════════════════════════════════════════════════════╗
║                                                                       ║
║  👤 Welcome back, Sarah!                         🔔 Settings        ║  ← Header
║  March 15, 2026                                                       ║
║                                                                       ║
╠═══════════════════════════════════════════════════════════════════════╣
║                                                                       ║
║  💰 Net Worth                        📊 Monthly Summary               ║
║  ┌────────────────────┐             ┌────────────────────┐          ║
║  │ $24,560.45         │             │ Income   $3,200    │          ║
║  │ ↑ +$1,240 (5.3%)   │             │ Spending $1,850    │          ║
║  └────────────────────┘             │ Net      +$1,350   │          ║
║                                     └────────────────────┘          ║
║  📈 Chart (6-month trend)                                            ║
║  ┌─────────────────────────────────────────────────────────────┐    ║
║  │ 30K ┤                                                  ╱      │    ║
║  │ 25K ┤                           ╱                    ╱        │    ║
║  │ 20K ┤                        ╱                    ╱           │    ║
║  │ 15K ┤    ╱─────────────────╱                 ╱               │    ║
║  │     ├──────────────────────────────────────────────────── Sep Oct Nov Dec Jan Feb  │    ║
║  └─────────────────────────────────────────────────────────────┘    ║
║                                                                       ║
║  💳 Accounts                                                          ║
║  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────┐ ║
║  │ Checking           │  │ Savings            │  │ Credit Card    │ ║
║  │ $12,456.89         │  │ $9,240.50          │  │ $2,863.06      │ ║
║  │ ↑ +$845 this month │  │ ↑ +$120 this month │  │ Due: $2,500    │ ║
║  └────────────────────┘  └────────────────────┘  └────────────────┘ ║
║                                                                       ║
║  📋 Recent Transactions                                              ║
║  ┌───────────────────────────────────────────────────────────────┐  ║
║  │ 🛒 Whole Foods              -$87.34   Today, 2:45 PM        │  ║
║  │ 🚗 Shell Gas Station        -$45.00   Yesterday, 4:20 PM    │  ║
║  │ 💼 Direct Deposit           +$2,400   2 days ago            │  ║
║  │ 🎬 Netflix Premium          -$15.99   Mar 1, 2026           │  ║
║  │ 🏠 Rent Payment            -$1,500    Feb 28, 2026          │  ║
║  └───────────────────────────────────────────────────────────────┘  ║
║  [View All Transactions →]                                           ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝

Layout Details:
  - 2 column header with title on left, actions on right
  - 3 cards in grid row (net worth, summary, empty/weather/news)
  - Full-width chart
  - 3 account cards in horizontal scroll
  - Transaction list with divider lines
  - Spacing: 24px between sections
```

### Transactions Page

```
╔═══════════════════════════════════════════════════════════════════════╗
║                                                                       ║
║  📋 Transactions                            [+ Add Transaction] [⋯]  ║  ← Actions
║                                                                       ║
║  Filters: [All Categories ▼] [All Accounts ▼] [Mar 01 - Mar 31 ▼]  ║
║                                                                       ║
║  ────────────────────────────────────────────────────────────────── ║
║  TODAY                                                               ║
║  ┌───────────────────────────────────────────────────────────────┐  ║
║  │ 🛒 Whole Foods                    -$87.34   [More ⋯]         │  ║
║  │ Groceries • 2:45 PM                                          │  ║
║  └───────────────────────────────────────────────────────────────┘  ║
║  ┌───────────────────────────────────────────────────────────────┐  ║
║  │ ☕ Brew & Co                       -$4.50    [More ⋯]         │  ║
║  │ Coffee • 10:22 AM                                            │  ║
║  └───────────────────────────────────────────────────────────────┘  ║
║                                                                       ║
║  ────────────────────────────────────────────────────────────────── ║
║  YESTERDAY                                                           ║
║  ┌───────────────────────────────────────────────────────────────┐  ║
║  │ 🚗 Shell Gas Station              -$45.00   [More ⋯]         │  ║
║  │ Transportation • 4:20 PM                                     │  ║
║  └───────────────────────────────────────────────────────────────┘  ║
║                                                                       ║
║  ────────────────────────────────────────────────────────────────── ║
║  MAR 13                                                              ║
║  ┌───────────────────────────────────────────────────────────────┐  ║
║  │ 💼 ABC Corp                       +$2,400   [More ⋯]         │  ║
║  │ Income • Salary                                              │  ║
║  └───────────────────────────────────────────────────────────────┘  ║
║                                                                       ║
║  [Load more...]                                                       ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝

List Details:
  - Date headers (TODAY, YESTERDAY, specific dates)
  - Transaction cards with:
    - Icon + Description
    - Amount (red for expenses, green for income)
    - Category + time
    - More menu (edit, duplicate, delete)
  - Divider between transactions
  - Sticky filters at top
  - Lazy loading with "Load more" button
```

### Reports & Analytics Page

```
╔═══════════════════════════════════════════════════════════════════════╗
║                                                                       ║
║  📊 Analytics & Reports               [Export ▼]                     ║
║                                                                       ║
║  Views: [Monthly ●] [Quarterly] [Annual] [Custom Range]             ║
║                                                                       ║
║  ═══════════════════════════════════════════════════════════════════ ║
║  Spending by Category (March 2026)                                   ║
║  ┌─────────────────────────────┐  Category Breakdown                 ║
║  │         ╱╲                  │  ────────────────────────────────   ║
║  │        ╱  ╲                 │  🛒 Groceries        $420    28%    ║
║  │       ╱    ╲                │  ████████████░░░░░░░░░░░░░░         ║
║  │      ╱      ╲               │                                      ║
║  │     ╱  ◉ 28% ╲              │  🎬 Entertainment     $280    19%    ║
║  │    ╱          ╲             │  ████████░░░░░░░░░░░░░░░░░░░░░░░   ║
║  │   ╱            ╲            │                                      ║
║  │  ╱              ╲           │  🚗 Transportation    $210    14%    ║
║  │ ╱                ╲          │  ███████░░░░░░░░░░░░░░░░░░░░░░░░░  ║
║  │                  ◉ 19%      │                                      ║
║  │ ◉ 14%                       │  🏠 Utilities         $180    12%    ║
║  │                             │  ██████░░░░░░░░░░░░░░░░░░░░░░░░░░  ║
║  └─────────────────────────────┘                                     ║
║                                 Other (6 categories)  $360    27%    ║
║                                 ███████████░░░░░░░░░░░░░░░░░░░░░░░  ║
║                                                                       ║
║  ═══════════════════════════════════════════════════════════════════ ║
║  Income vs Spending Trend (Last 6 Months)                           ║
║  ┌──────────────────────────────────────────────────────────────┐   ║
║  │ $4000 ┤                                                       │   ║
║  │       ┤  Income    ▁▂▃▄▅▆▇                                   │   ║
║  │ $2000 ┤  Spending  ▃▄▅▆▅▄▃                                   │   ║
║  │       ├───────────────────────────────────────────────────── │   ║
║  │ $0    ┤ Sep     Oct     Nov     Dec     Jan     Feb            │   ║
║  └──────────────────────────────────────────────────────────────┘   ║
║                                                                       ║
║  Summary Stats                                                       ║
║  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐    ║
║  │ Total Income     │ │ Total Spending   │ │ Net Savings      │    ║
║  │ $5,200          │ │ $3,850           │ │ $1,350 (+26%)    │    ║
║  └──────────────────┘ └──────────────────┘ └──────────────────┘    ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝

Chart Details:
  - Donut chart with 6 colors (Indigo, Emerald, Cyan, Pink, Amber, Red)
  - Bar chart for trends
  - Legend with percentages
  - Hover tooltips showing exact values
  - Export button for PDF/CSV
```

### Goals & Budgets Page

```
╔═══════════════════════════════════════════════════════════════════════╗
║                                                                       ║
║  🎯 Goals & Budgets                    [+ New Budget] [+ New Goal]   ║
║                                                                       ║
║  MONTHLY BUDGETS                                                     ║
║  ┌───────────────────────────────────────────────────────────────┐  ║
║  │ 🛒 Groceries                                   [Edit] [Delete] │  ║
║  │ $280 / $400 budget                           [70% used]       │  ║
║  │ ████████████░░░░░░░░░░░                                        │  ║
║  │ $120 remaining                                                │  ║
║  └───────────────────────────────────────────────────────────────┘  ║
║                                                                       ║
║  ┌───────────────────────────────────────────────────────────────┐  ║
║  │ 🎬 Entertainment                               [Edit] [Delete] │  ║
║  │ $150 / $200 budget                           [75% used]       │  ║
║  │ ██████████░░░░░░░░░░░░░░░░░░                                   │  ║
║  │ $50 remaining                                                 │  ║
║  └───────────────────────────────────────────────────────────────┘  ║
║                                                                       ║
║  ┌───────────────────────────────────────────────────────────────┐  ║
║  │ 🚗 Transportation                              [Edit] [Delete] │  ║
║  │ $200 / $300 budget                           [67% used]       │  ║
║  │ ███████████░░░░░░░░░░░░░░░░░░░░                               │  ║
║  │ $100 remaining                                                │  ║
║  └───────────────────────────────────────────────────────────────┘  ║
║                                                                       ║
║  SAVINGS GOALS                                                       ║
║  ┌───────────────────────────────────────────────────────────────┐  ║
║  │ 🏠 Home Down Payment                           [Edit] [Delete] │  ║
║  │ $25,000 / $50,000 goal                        [50% progress]  │  ║
║  │ ████████████████░░░░░░░░░░░░░░░░░░░░░░░                       │  ║
║  │ $25,000 remaining • Target date: Dec 2026                    │  ║
║  └───────────────────────────────────────────────────────────────┘  ║
║                                                                       ║
║  ┌───────────────────────────────────────────────────────────────┐  ║
║  │ ✈️  Vacation Fund                              [Edit] [Delete] │  ║
║  │ $8,200 / $10,000 goal                         [82% progress]  │  ║
║  │ ████████████████████░░░░░░░░░░                                 │  ║
║  │ $1,800 remaining • Target date: Aug 2026                     │  ║
║  └───────────────────────────────────────────────────────────────┘  ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝

Progress Bar Colors:
  - On track (≤ 75%): Emerald-600
  - Warning (75-95%): Amber-600
  - Exceeded (95-100%): Red-600
```

### Settings Page

```
╔═══════════════════════════════════════════════════════════════════════╗
║                                                                       ║
║  ⚙️  Settings                           [← Back]                     ║
║                                                                       ║
║  PROFILE                                                             ║
║  ┌───────────────────────────────────────────────────────────────┐  ║
║  │ 👤 Profile Picture                                            │  ║
║  │ ┌──────────────────────────────────────────────────────────┐ │  ║
║  │ │ [Avatar]  Sarah Johnson                   [Change Avatar] │ │  ║
║  │ │           sarah@example.com               [Change Email] │ │  ║
║  │ └──────────────────────────────────────────────────────────┘ │  ║
║  └───────────────────────────────────────────────────────────────┘  ║
║                                                                       ║
║  ACCOUNTS                                                            ║
║  ┌───────────────────────────────────────────────────────────────┐  ║
║  │ Linked Accounts                                               │  ║
║  │ ✓ Chase Bank (Checking)                         [Disconnect] │  ║
║  │ ✓ Wells Fargo (Savings)                         [Disconnect] │  ║
║  │ ✓ Amex Credit Card                              [Disconnect] │  ║
║  │                                  [+ Add Bank Account]         │  ║
║  └───────────────────────────────────────────────────────────────┘  ║
║                                                                       ║
║  PREFERENCES                                                         ║
║  ┌───────────────────────────────────────────────────────────────┐  ║
║  │ Theme                                          [Light] [Dark] │  ║
║  │ Currency                                    [USD ▼]           │  ║
║  │ Language                                    [English ▼]       │  ║
║  │ Timezone                                    [EST ▼]           │  ║
║  │                                                               │  ║
║  │ Notifications                                  [Toggle ON]   │  ║
║  │ Email Digest                                   [Toggle ON]   │  ║
║  │ Two-Factor Authentication                     [Toggle OFF]   │  ║
║  └───────────────────────────────────────────────────────────────┘  ║
║                                                                       ║
║  CATEGORIES                                                          ║
║  ┌───────────────────────────────────────────────────────────────┐  ║
║  │ Manage Spending Categories                                    │  ║
║  │ 🛒 Groceries                                  [Edit] [Delete]  │  ║
║  │ 🚗 Transportation                             [Edit] [Delete]  │  ║
║  │ 🎬 Entertainment                              [Edit] [Delete]  │  ║
║  │ 🏠 Utilities                                   [Edit] [Delete]  │  ║
║  │                                    [+ Create Custom Category] │  ║
║  └───────────────────────────────────────────────────────────────┘  ║
║                                                                       ║
║  SECURITY & PRIVACY                                                  ║
║  ┌───────────────────────────────────────────────────────────────┐  ║
║  │ Change Password                              [Change]         │  ║
║  │ Login History                                 [View]           │  ║
║  │ Privacy Settings                              [Manage]        │  ║
║  │ Data Export                                   [Download]      │  ║
║  │ Delete Account                                [Delete Data]   │  ║
║  └───────────────────────────────────────────────────────────────┘  ║
║                                                                       ║
║  ABOUT                                                               ║
║  ┌───────────────────────────────────────────────────────────────┐  ║
║  │ FinTrack Version 2.0.0                                        │  ║
║  │ © 2026 FinTrack. All rights reserved.                         │  ║
║  │ [Terms of Service] [Privacy Policy] [Contact Support]        │  ║
║  └───────────────────────────────────────────────────────────────┘  ║
║                                                                       ║
╚═══════════════════════════════════════════════════════════════════════╝

Settings Layout:
  - Left navigation (optional for desktop) or collapsible sections
  - Section groupings with visual dividers
  - Icons + labels for settings groups
  - Toggle switches for binary options
  - Dropdowns for multi-option selections
  - Inline actions (Edit, Delete, Change)
  - Destructive actions in red (Delete Account)
```

---

## 6. DARK MODE COMPARISON

### Light Mode (Default)
```
Background:     White (#FFFFFF)
Text Primary:   Indigo-900 (#1E1B4B)
Text Secondary: Gray-600 (#4B5563)
Borders:        Gray-200 (#E5E7EB)
Hover/Accent:   Indigo-50 (#EEF2FF)
Cards:          White (#FFFFFF) with shadow
```

### Dark Mode
```
Background:     Dark-900 (#111827)
Text Primary:   Dark-50 (#F9FAFB)
Text Secondary: Dark-400 (#9CA3AF)
Borders:        Dark-700 (#374151)
Hover/Accent:   Dark-800 (#1F2937)
Cards:          Dark-800 (#1F2937) with subtle shadow
```

### Component Theming Example
```
LIGHT MODE                          DARK MODE
┌─────────────────────────┐        ┌─────────────────────────┐
│ Add Transaction  (Blue) │        │ Add Transaction  (Blue) │  ← Same color
└─────────────────────────┘        └─────────────────────────┘
Background: White                  Background: Dark-800
Border: Gray-200                   Border: Dark-700
Text: Indigo-900                   Text: Dark-50
Hover shadow: Light                Hover shadow: Stronger

CARD EXAMPLE
Light:                            Dark:
┌──────────────────────────┐      ┌──────────────────────────┐
│ Checking Account         │      │ Checking Account         │
│ $12,456.89              │      │ $12,456.89              │
│ ↑ +$845 (↑ 7.3%)        │      │ ↑ +$845 (↑ 7.3%)        │
└──────────────────────────┘      └──────────────────────────┘
Shadow: 0 1px 3px rgba(0,0,0,0.1)  Shadow: 0 1px 3px rgba(0,0,0,0.3)
```

---

## 7. MICRO-INTERACTIONS & ANIMATIONS

### Button Interactions
```
Click Animation:
  1. Hover: Lighten color 50ms
  2. Press: Darken color + scale 0.98
  3. Release: Return to normal 100ms

Loading State:
  [Loading...] spinner (animated dots)
  Button disabled, cursor = wait
  Spinner: 20px, Indigo-600

Disabled State:
  Opacity: 0.5
  Cursor: not-allowed
  No hover effects
```

### Transitions & Timing
```
Page Transitions:        200ms fade + 100ms slide-up
Modal Open/Close:        250ms ease-out / 200ms ease-in
Button Hover:            150ms color change
Input Focus:             200ms border glow
Slide Animations:        300ms cubic-bezier(0.4, 0, 0.2, 1)
Toast Notifications:     300ms slide-in, 200ms slide-out
Loading Spinners:        1s rotation loop
Skeleton Loading:        1.5s pulse animation
```

### Form Interactions
```
Input Focus:
  Border: 2px solid Indigo-600
  Box shadow: 0 0 0 3px rgba(99, 102, 241, 0.1)
  Background: Indigo-50
  Animation: 200ms ease-out

Error Animation:
  1. Shake (±2px) for 300ms
  2. Show error message (fade in 200ms)
  3. Text color: Red-600
  4. Border: Red-500

Success Checkmark:
  Scale: 0 → 1.2 → 1 (animated over 400ms)
  Color fade: Green-600
  Icon spins 360° while scaling
```

### Loading States
```
Skeleton Screen:
  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
  ▓▓▓▓▓▓ ▓▓▓▓▓▓
  ▓▓▓▓ ▓▓ ▓▓▓▓▓▓▓▓▓
  
  Background: Gray-200
  Shimmer effect: 1.5s diagonal sweep
  Brightness: 100% → 80% → 100%
  Direction: Left to right

Spinner:
  ◴ (rotating square) or ◷ (rotating circle)
  Size: 24px, 40px, or 56px variants
  Color: Indigo-600
  Speed: 1s full rotation
  Animation: Linear, infinite
```

### Scroll Interactions
```
Sticky Header on Scroll:
  Appears 100px from top
  Fade in over 300ms
  Shadow increases
  Text color remains consistent

Floating Action Button (FAB):
  Position: Bottom-right
  Scroll down: Fade out, slide down
  Scroll up: Fade in, slide up
  Animation: 200ms
  
Card Hover on List:
  Background slightly lighter/darker
  Shadow increases subtly
  Scale: 1 → 1.01
  Animation: 150ms
```

---

## 8. ACCESSIBILITY FEATURES

### Color Contrast
```
✓ All text on backgrounds: 4.5:1 minimum ratio
✓ Buttons & interactive elements: 3:1 minimum ratio
✓ Icons: High contrast with background
✓ Dark mode: Increased contrast for readability

Example:
  Light mode: Indigo-900 (#1E1B4B) on White (#FFFFFF) = 12.2:1 ✓
  Dark mode:  Dark-50 (#F9FAFB) on Dark-900 (#111827) = 14.1:1 ✓
```

### Interactive Elements
```
Focus Indicators:
  Keyboard tab navigation: 2px solid Indigo-600 outline
  Outline offset: 2px
  High visibility on all backgrounds

Hover/Active States:
  Visual feedback required for all interactive elements
  Color change + scale + shadow
  Clear visual distinction from normal state
```

### ARIA Labels
```
Buttons:
  <button aria-label="Add new transaction">+</button>

Icons:
  <span role="img" aria-label="Groceries category">🛒</span>

Form inputs:
  <input aria-label="Transaction description" />
  <input aria-describedby="amount-helper" />

Skip links:
  <a href="#main-content" class="sr-only">Skip to main content</a>
```

### Font & Sizing
```
Minimum font size: 12px
Body text: 14-16px
Headings: 20pt+
Line height: 1.4-1.6 for body text
Letter spacing: 0.3-0.5px for small text
```

---

## 9. BEFORE & AFTER COMPARISON

### Current Design Issues → New Design Solutions

```
❌ BEFORE                              ✅ AFTER

Multiple primary colors               Single Indigo primary
(Indigo-600, Blue-600, Purple-600)    + Coordinated accent palette
Result: Visual confusion              Result: Cohesive brand identity

No design tokens                       Complete token system
Hardcoded colors/spacing              Reusable, maintainable values
Result: Inconsistent styling          Result: Consistent experience

Minimal dark mode                      Full dark mode parity
Partial dark variants                 All components dark-enabled
Result: Poor night UX                 Result: Polished dark experience

Unclear spacing scale                  3/8px grid system
Random padding/margins                Semantic spacing tokens
Result: Misaligned layouts            Result: Professional spacing

Text-heavy components                 Visual-first design
Little use of icons/color             Icons + color + imagery
Result: Boring interface              Result: Delightful experience

No interaction feedback                Smooth micro-interactions
Static buttons/inputs                 100+ animation specs
Result: Feels unresponsive            Result: Premium feel

Mixed typography                      Clear type hierarchy
Inconsistent font sizes               Defined scale (8 sizes)
Result: Scattered appearance          Result: Professional typography

Generic white cards                   Rich card variations
No visual distinction                 Gradient accents, shadows
Result: Flat appearance               Result: Depth & dimension
```

---

## 10. IMPLEMENTATION CHECKLIST

### Phase 1: Design System Foundation
- [ ] Create `tailwind.config.js` with complete color tokens
- [ ] Define spacing, sizing, border radius scales
- [ ] Set up typography tokens (font sizes, weights, line heights)
- [ ] Create CSS variables for dark mode
- [ ] Create `globals.css` with utility classes
- [ ] Document color usage guidelines
- [ ] Create design token reference guide

### Phase 2: Component Refresh
- [ ] Button component (4 variants: primary, secondary, ghost, danger)
- [ ] Card component (3 layouts: standard, gradient, featured)
- [ ] Input component (text, email, number with variants)
- [ ] Select dropdown with styling
- [ ] Toggle switch
- [ ] Modal/Dialog with animation
- [ ] Toast notifications
- [ ] Loading skeleton screens
- [ ] Badges & tags
- [ ] Icons with semantic colors

### Phase 3: Page Redesigns
- [ ] Dashboard (add visual hierarchy, improve charts)
- [ ] Transactions list (better grouping, filters)
- [ ] Reports & Analytics (enhanced visualizations)
- [ ] Goals & Budgets (clearer progress indicators)
- [ ] Settings (organized sections)

### Phase 4: Dark Mode Polish
- [ ] Test all components in dark mode
- [ ] Verify contrast ratios
- [ ] Fine-tune shadow depths
- [ ] Adjust hover/active states
- [ ] Test theme toggle functionality

### Phase 5: Micro-interactions
- [ ] Button hover/press animations
- [ ] Form input focus states
- [ ] Loading spinners
- [ ] Page transitions
- [ ] Toast animations
- [ ] Skeleton loading

---

## Summary

The FinTrack visual refresh transforms the app from functional to delightful:

**Visual Identity:**
- Modern Indigo primary with coordinated accent palette
- Professional spacing and typography
- Cohesive dark mode experience

**User Experience:**
- Clear visual hierarchy and information density
- Smooth animations and interactions
- Accessible color contrast and interactive states

**Development:**
- Complete design token system for consistency
- Reusable component patterns
- Easy to maintain and extend

**Timeline:**
- Phase 1-2 (Design System + Components): 2-3 days
- Phase 3 (Page Redesigns): 2 days
- Phase 4-5 (Polish + Interactions): 1-2 days
- **Total: 5-8 days of focused development**

Ready to implement when approved! 🎨
