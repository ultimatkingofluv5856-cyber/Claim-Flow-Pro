# ClaimFlow Pro - AI Agent Instructions

## Project Overview

**ClaimFlow Pro** is an expense claims management system built with React/TypeScript (Vite frontend) and Supabase (PostgreSQL backend). It features role-based workflows for employee claims submission, manager approval, and admin final approval with email notifications.

## Architecture

### Tech Stack
- **Frontend**: React 18, TypeScript, Vite, shadcn-ui, Tailwind CSS, React Router
- **Backend**: Supabase (PostgreSQL), Edge Functions
- **Email**: Resend API via Supabase Edge Function
- **UI Components**: Radix UI primitives through shadcn-ui
- **Forms**: React Hook Form + Zod validation
- **State**: React Context (Auth), TanStack Query, local state

### Core Data Model

**Users** → **Claims** (with Expense Items) → **Manager/Admin Approval** → **Transactions**

- `users`: Roles (User, Manager, Admin, Super Admin), password hashed with SHA256
- `claims`: Status workflow (Pending Manager → Pending Admin → Approved/Rejected)
- `expense_items`: Line items per claim with attachment tracking
- `transactions`: Financial records (credits/debits for approve/reject actions)
- `sessions`: Custom token-based authentication (not Supabase Auth)
- `notifications`: In-app notification records
- `audit_logs`: Compliance tracking of all actions
- `app_lists`: Master data dropdowns (categories, project codes, sites)

### Service Boundaries

1. **Auth Service** ([src/lib/auth.ts](src/lib/auth.ts)): Session token generation, password hashing (SHA256), role verification
2. **Claims API** ([src/lib/claims-api.ts](src/lib/claims-api.ts)): ~800 LOC with all business logic—claim CRUD, approvals, balance calculations, audit logging
3. **Email Service** ([src/lib/send-email.ts](src/lib/send-email.ts)): Frontend wrapper calling Edge Function via `supabase.functions.invoke()`
4. **Supabase Edge Function** (supabase/functions/send-notification/): Receives email requests, applies templates, calls Resend API

## Critical Workflows

### Local Development
```bash
npm install          # Install dependencies (uses pnpm-lock.yaml)
npm run dev          # Start Vite dev server at :8080 with HMR
npm run build        # Production build to dist/
npm run lint         # ESLint check (unused vars disabled)
npm test             # Run vitest tests
npm test:watch       # Watch mode
```

### Email Testing (Browser Console)
```javascript
await testSendEmail('user@example.com', 'user_created', { name: 'John' })
// Response: {success: true, id: '...', message: '...'}
```

### Authentication Flow
1. User logs in → `auth.login()` hashes password (SHA256) and checks `users` table
2. Session token created → stored in `sessions` table + `sessionStorage`
3. Token verified on app load via `verifyToken()` in `AuthContext.useEffect`
4. Token passed in API calls to authorize database operations

### Claim Approval Flow
1. User submits → `submitClaim()` creates record with status "Pending Manager Approval"
2. Manager approves → `approveClaimAsManager()` → status "Pending Admin Approval" + email sent
3. Admin approves → `approveClaimAsAdmin()` → status "Approved" + transaction recorded + balance updated
4. Any rejection → `rejectClaim()` → status "Rejected" + email with reason + optional balance credit

## Project-Specific Conventions

### Component Organization
- **Pages** ([src/pages/](src/pages/)): Route-level components (Index, EmailTest, NotFound)
- **Views** ([src/components/views/](src/components/views/)): Feature modules (SubmitClaimView, DashboardView, ApprovalView, etc.)
- **UI** ([src/components/ui/](src/components/ui/)): Reusable shadcn-ui primitives
- **Contexts** ([src/contexts/](src/contexts/)): AuthContext for global state

### API Patterns
- All database access via `supabase.from('table_name')` with `.select()`, `.insert()`, `.update()`, `.delete()`
- Return objects with `{ ok: boolean; message?: string; data?: any }` pattern
- Error handling: log to console + return error in response object (never throw in API functions)
- Audit logging: call `logAudit(action, performedBy, targetType, targetId, details)` for all sensitive operations

### Form Patterns
- Use React Hook Form with Zod validation
- Example: [src/components/views/SubmitClaimView.tsx](src/components/views/SubmitClaimView.tsx) line 1-100
- Layout: useState for form state, useEffect for data loading, onSubmit handler with loading state
- Error display: `toast.error()` for user feedback

### UI Patterns
- **Colors**: Text colors use `text-primary`, `text-muted-foreground`, `text-destructive`
- **Icons**: lucide-react icons passed as component props (e.g., `<FileText />`, `<Users />`)
- **Responsive**: Tailwind grid utilities (`grid-cols-1 md:grid-cols-3 lg:grid-cols-4`)
- **Toasts**: Sonner library for notifications (already wrapped in App.tsx)

### Email Templates
Five template types: `user_created`, `claim_submitted`, `claim_approved`, `claim_rejected`, `password_reset`. Defined server-side in Edge Function, data passed via `data` object in `sendEmail()` call.

## Integration Points & External Dependencies

### Supabase
- **Client init**: [src/integrations/supabase/client.ts](src/integrations/supabase/client.ts) reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from .env
- **Edge Function**: Endpoint: `https://jluzssnjbwykkhomxomy.supabase.co/functions/v1/send-notification`
- **RLS Policies**: Disabled (`ALLOW ALL`) because app uses custom session tokens, not Supabase Auth

### Resend Email API
- **API Key**: Stored as `RESEND_API_KEY` in Supabase secrets (accessed by Edge Function)
- **Endpoint**: POST `https://api.resend.com/emails`
- **Rate**: No limits observed in this codebase

### Environment Variables (Frontend)
- `VITE_SUPABASE_URL`: Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Public anon key (safe to expose)

## Common Development Tasks

### Adding a New View/Feature
1. Create component in [src/components/views/](src/components/views/) following SubmitClaimView pattern
2. Add navigation link in [src/components/AppHeader.tsx](src/components/AppHeader.tsx) or [src/components/AppSidebar.tsx](src/components/AppSidebar.tsx)
3. Import UI components from [src/components/ui/](src/components/ui/)
4. Use `useAuth()` hook for user context and role checking
5. Call API functions from [src/lib/claims-api.ts](src/lib/claims-api.ts) for data

### Adding a Database Field
1. Create SQL migration in [supabase/migrations/](supabase/migrations/) with timestamp filename
2. Update [supabase/migrations/complete_schema.sql](supabase/migrations/complete_schema.sql) for reference
3. Update TypeScript interfaces if needed (check [src/lib/auth.ts](src/lib/auth.ts) and [src/lib/claims-api.ts](src/lib/claims-api.ts) for examples)

### Adding a New Email Template
1. Add type to `EmailType` in [src/lib/send-email.ts](src/lib/send-email.ts)
2. Create template handler in Edge Function (supabase/functions/send-notification/index.ts)
3. Call `sendEmail(email, newType, data)` from app code

### Debugging
- **Email issues**: Check browser console for `📧 Sending email:` logs, then check Supabase logs for Edge Function errors
- **Auth issues**: Check `sessionStorage.getItem('claimsToken')` in DevTools
- **Database issues**: Use [src/lib/debug-supabase.ts](src/lib/debug-supabase.ts) for connection testing
- **Build errors**: Ensure TypeScript strict null checks pass (some are disabled in [tsconfig.json](tsconfig.json))

## Testing Strategy
- **Unit tests**: Place `.test.ts` or `.spec.ts` in [src/test/](src/test/) (vitest with jsdom)
- **Integration tests**: Manually test in browser or use email test helpers
- **Coverage**: No strict requirements; focus on critical auth and approval workflows

## Special Notes
- **No migrations needed locally**: Use Supabase Cloud dashboard to sync migrations
- **Lovable integration**: Project scaffolded with Lovable; componentTagger() runs in dev mode for UI building
- **Session storage**: Tokens stored in `sessionStorage` (cleared on browser close) not `localStorage`
- **Currency**: Hard-coded as ₹ (Indian Rupee) in multiple places; update formatCurrency() if needed
- **First admin setup**: Check in [src/lib/claims-api.ts](src/lib/claims-api.ts) `createFirstAdmin()` for special logic
- **Mobile support**: Components use responsive classes; check [src/components/MobileBottomNav.tsx](src/components/MobileBottomNav.tsx) for mobile nav

## Key Files Quick Reference
- [src/App.tsx](src/App.tsx) — App setup, routing, providers
- [src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx) — Auth state + login/logout
- [src/lib/claims-api.ts](src/lib/claims-api.ts) — All business logic (~800 LOC)
- [src/pages/Index.tsx](src/pages/Index.tsx) — Main dashboard routing by role
- [src/components/views/](src/components/views/) — Feature-specific views
- [supabase/migrations/complete_schema.sql](supabase/migrations/complete_schema.sql) — Full DB schema
