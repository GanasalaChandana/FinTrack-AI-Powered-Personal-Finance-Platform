# FinTrack UI Component Library

## Overview

A complete, design-system-compliant component library built with Tailwind CSS and React. All components support light/dark modes, accessibility, and responsive design.

---

## Core Components

### 1. **Button** (`components/ui/Button.tsx`)

Versatile button component with multiple variants and sizes.

```tsx
import { Button } from '@/components/ui';

// Basic usage
<Button>Click me</Button>

// Variants
<Button variant="primary">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="danger">Danger</Button>

// Sizes
<Button size="sm">Small</Button>
<Button size="md">Medium (default)</Button>
<Button size="lg">Large</Button>

// With icon
<Button icon={<PlusIcon />} iconPosition="left">
  Add Transaction
</Button>

// Loading state
<Button isLoading={true}>Processing...</Button>

// Full width
<Button fullWidth>Full Width Button</Button>

// Disabled
<Button disabled>Disabled</Button>
```

**Props:**
- `variant`: 'primary' | 'secondary' | 'ghost' | 'danger' (default: 'primary')
- `size`: 'sm' | 'md' | 'lg' (default: 'md')
- `isLoading`: boolean (default: false)
- `icon`: React.ReactNode
- `iconPosition`: 'left' | 'right' (default: 'left')
- `fullWidth`: boolean (default: false)

---

### 2. **Card** (`components/ui/Card.tsx`)

Flexible card component with multiple variants and sub-components.

```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui';

// Basic usage
<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Card description goes here</CardDescription>
  </CardHeader>
  <CardContent>
    Your content here
  </CardContent>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>

// Card variants
<Card variant="default">Default card</Card>
<Card variant="elevated">Elevated with more shadow</Card>
<Card variant="outlined">Outlined with border</Card>

// Padding options
<Card padding="sm">Small padding</Card>
<Card padding="md">Medium padding (default)</Card>
<Card padding="lg">Large padding</Card>

// Interactive card
<Card isInteractive onClick={() => navigate('/details')}>
  Clickable card with hover effects
</Card>
```

**Props:**
- `variant`: 'default' | 'elevated' | 'outlined' (default: 'default')
- `padding`: 'sm' | 'md' | 'lg' (default: 'md')
- `isInteractive`: boolean (default: false)

**Sub-components:**
- `CardHeader` - Container for header content
- `CardTitle` - Styled title (sizes: 'sm' | 'md' | 'lg')
- `CardDescription` - Secondary text
- `CardContent` - Main content area
- `CardFooter` - Footer with divider

---

### 3. **Input** (`components/ui/Input.tsx`)

Form input with validation and helper text.

```tsx
import { Input, Textarea, Select } from '@/components/ui';

// Basic input
<Input 
  label="Email Address" 
  placeholder="you@example.com"
  type="email"
  required
/>

// With validation
<Input 
  label="Amount"
  error="Amount must be greater than 0"
  variant="error"
/>

// With success state
<Input 
  value="verified@email.com"
  variant="success"
/>

// With icon
<Input 
  label="Search"
  icon={<SearchIcon />}
  iconPosition="left"
/>

// With description
<Input 
  label="Password"
  type="password"
  description="Must be at least 8 characters"
/>

// Sizes
<Input size="sm" />
<Input size="md" /> {/* default */}
<Input size="lg" />

// Textarea
<Textarea 
  label="Notes"
  rows={4}
  placeholder="Enter your notes here"
/>

// Select
<Select 
  label="Category"
  options={[
    { value: 'groceries', label: '🛒 Groceries' },
    { value: 'transport', label: '🚗 Transportation' },
  ]}
/>
```

**Input Props:**
- `label`: string
- `description`: string
- `error`: string
- `variant`: 'default' | 'error' | 'success' (default: 'default')
- `size`: 'sm' | 'md' | 'lg' (default: 'md')
- `icon`: React.ReactNode
- `iconPosition`: 'left' | 'right' (default: 'left')
- `fullWidth`: boolean (default: true)

---

### 4. **Modal** (`components/ui/Modal.tsx`)

Dialog component with animations and keyboard support.

```tsx
import { Modal, ModalContent, ModalFooter } from '@/components/ui';

const [isOpen, setIsOpen] = useState(false);

<Modal 
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Add Transaction"
  size="md"
  closeButton={true}
>
  <ModalContent>
    <form>{/* form fields */}</form>
  </ModalContent>
  <ModalFooter>
    <Button variant="secondary" onClick={() => setIsOpen(false)}>
      Cancel
    </Button>
    <Button variant="primary">Save</Button>
  </ModalFooter>
</Modal>
```

**Props:**
- `isOpen`: boolean (required)
- `onClose`: () => void (required)
- `title`: string
- `size`: 'sm' | 'md' | 'lg' | 'xl' (default: 'md')
- `closeButton`: boolean (default: true)

**Features:**
- Click outside to close
- Escape key to close
- Fade in animation
- Prevents body scroll when open

---

### 5. **Badge** (`components/ui/Badge.tsx`)

Small label component for tags and status indicators.

```tsx
import { Badge } from '@/components/ui';

// Basic badge
<Badge>New</Badge>

// Variants
<Badge variant="primary">Primary</Badge>
<Badge variant="success">Success</Badge>
<Badge variant="error">Error</Badge>
<Badge variant="warning">Warning</Badge>
<Badge variant="accent">Accent</Badge>
<Badge variant="neutral">Neutral</Badge>

// Sizes
<Badge size="sm">Small</Badge>
<Badge size="md">Medium (default)</Badge>
<Badge size="lg">Large</Badge>

// With icon
<Badge icon={<CheckIcon />}>Verified</Badge>

// Dismissible
<Badge onDismiss={() => remove()}>
  Removable Badge
</Badge>
```

**Props:**
- `variant`: 'primary' | 'success' | 'error' | 'warning' | 'accent' | 'neutral' (default: 'primary')
- `size`: 'sm' | 'md' | 'lg' (default: 'md')
- `icon`: React.ReactNode
- `onDismiss`: () => void

---

### 6. **Toggle** (`components/ui/Toggle.tsx`)

Switch component for boolean options.

```tsx
import { Toggle } from '@/components/ui';

const [enabled, setEnabled] = useState(false);

// Basic toggle
<Toggle 
  checked={enabled}
  onChange={(e) => setEnabled(e.target.checked)}
/>

// With label
<Toggle 
  label="Enable notifications"
  checked={enabled}
  onChange={(e) => setEnabled(e.target.checked)}
/>

// With description
<Toggle 
  label="Dark mode"
  description="Use dark theme for better night viewing"
  checked={darkMode}
  onChange={(e) => setDarkMode(e.target.checked)}
/>

// Sizes
<Toggle size="sm" />
<Toggle size="md" /> {/* default */}
<Toggle size="lg" />

// Disabled
<Toggle disabled />
```

**Props:**
- `label`: string
- `description`: string
- `checked`: boolean
- `size`: 'sm' | 'md' | 'lg' (default: 'md')
- `disabled`: boolean (default: false)

---

### 7. **Skeleton** (`components/ui/Skeleton.tsx`)

Loading placeholder component.

```tsx
import { 
  Skeleton, 
  CardSkeleton, 
  TableRowSkeleton,
  TransactionItemSkeleton 
} from '@/components/ui';

// Basic skeleton
<Skeleton />

// Specific variants
<Skeleton variant="text" width="80%" />
<Skeleton variant="avatar" />
<Skeleton variant="card" />
<Skeleton variant="circle" />

// Custom sizing
<Skeleton width="200px" height="40px" />

// Multiple skeletons
<Skeleton count={3} />

// Specialized loaders
<CardSkeleton /> {/* Card-shaped loading */}
<TableRowSkeleton /> {/* Table row loading */}
<TransactionItemSkeleton /> {/* Transaction item loading */}
```

**Props:**
- `variant`: 'text' | 'avatar' | 'card' | 'circle' (default: 'text')
- `height`: string
- `width`: string
- `count`: number (for multiple skeletons)

---

### 8. **Alert** (`components/ui/Alert.tsx`)

Message container for alerts and notifications.

```tsx
import { Alert } from '@/components/ui';

// Basic alert
<Alert variant="info">
  This is an informational message
</Alert>

// With title
<Alert 
  variant="success" 
  title="Success"
>
  Your transaction has been saved
</Alert>

// Variants
<Alert variant="success">Success state</Alert>
<Alert variant="error" title="Error">Error message</Alert>
<Alert variant="warning">Warning message</Alert>
<Alert variant="info">Information message</Alert>

// Dismissible
<Alert onDismiss={() => setVisible(false)}>
  Dismissible alert
</Alert>

// Without icon
<Alert showIcon={false}>
  Alert without icon
</Alert>
```

**Props:**
- `variant`: 'success' | 'error' | 'warning' | 'info' (default: 'info')
- `title`: string
- `showIcon`: boolean (default: true)
- `onDismiss`: () => void

---

### 9. **Toast** (`components/ui/Toast.tsx`)

Toast notification system with context provider.

```tsx
import { ToastProvider, useToast } from '@/components/ui';

// Wrap your app with provider
<ToastProvider>
  <App />
</ToastProvider>

// Use in components
function MyComponent() {
  const { toast } = useToast();

  return (
    <Button 
      onClick={() => {
        toast.success('Transaction saved!');
        // Other variants
        toast.error('Failed to save');
        toast.warning('Please review changes');
        toast.info('Loading...');
      }}
    >
      Save
    </Button>
  );
}

// With action
toast.success('Undo', 4000, {
  label: 'Undo',
  onClick: () => undoAction()
});
```

**Methods:**
- `toast.success(message, duration?, action?)`
- `toast.error(message, duration?, action?)`
- `toast.info(message, duration?, action?)`
- `toast.warning(message, duration?, action?)`

---

## Updated Components

### StatCard (Enhanced)

Replaced hardcoded colors with design tokens.

```tsx
<StatCard
  title="Monthly Savings"
  value="$1,350"
  change={7.3}
  icon={TrendingUpIcon}
  color="success" // primary | success | error | warning | accent
  sparklineData={monthlyData}
  onClick={() => navigate('/savings')}
/>
```

### ConfirmationModal (Refactored)

Now uses Modal component with new design system.

```tsx
<ConfirmationModal
  isOpen={isOpen}
  onClose={() => setOpen(false)}
  onConfirm={handleDelete}
  title="Delete transaction?"
  message="This action cannot be undone"
  variant="danger" // danger | warning | info
  confirmText="Delete"
  cancelText="Keep it"
  isLoading={isDeleting}
/>
```

---

## Color System

All components use semantic color tokens:

```tsx
// Primary
bg-primary-50, bg-primary-100, bg-primary-500, bg-primary-600, bg-primary-700, bg-primary-900

// Success
bg-success-100, bg-success-500, bg-success-600, bg-success-700

// Error
bg-error-100, bg-error-500, bg-error-600, bg-error-700

// Warning
bg-warning-100, bg-warning-500, bg-warning-600

// Accent
bg-accent-500, bg-accent-600

// Neutral
bg-neutral-50, bg-neutral-100, bg-neutral-200, bg-neutral-300, bg-neutral-400, bg-neutral-500, bg-neutral-600, bg-neutral-700, bg-neutral-800, bg-neutral-900
```

---

## Dark Mode

All components automatically support dark mode via CSS variables.

No additional configuration needed — dark mode is built-in to every component!

```tsx
// Light mode (default)
<div className="bg-white text-neutral-900">

// Dark mode (automatic with .dark class on html/body)
// In dark mode, becomes:
// .dark { background: #1F2937; color: #F9FAFB; }
```

---

## Accessibility

All components include:
- ✅ Proper ARIA labels and roles
- ✅ Keyboard navigation support
- ✅ Focus states with 2px solid rings
- ✅ Color contrast ratios 4.5:1+ (WCAG AA)
- ✅ Screen reader support

---

## Animation Classes

All components support Tailwind animations:

```tsx
animate-fade-in      /* 0.2s fade */
animate-slide-up     /* 0.3s slide up */
animate-slide-down   /* 0.3s slide down */
animate-scale-in     /* 0.2s scale */
animate-pulse-subtle /* 1.5s subtle pulse */
```

---

## Responsive Design

All components are fully responsive:
- Mobile-first design
- Touch-friendly sizing
- Adaptive layouts

---

## Usage Tips

1. **Import from `@/components/ui`** - All components exported from the index
2. **Type-safe props** - Full TypeScript support
3. **Ref forwarding** - All components support React.forwardRef
4. **Composable** - Build complex UIs by combining components
5. **Themeable** - Colors work globally through CSS variables

---

## Next Steps

The component library is complete! Next phases:
- ✅ Phase 1: Design System Foundation (DONE)
- ✅ Phase 2: Component Refresh (DONE)
- ⏳ Phase 3: Page Redesigns (Coming next)
- ⏳ Phase 4: Dark Mode Polish
- ⏳ Phase 5: Micro-interactions
