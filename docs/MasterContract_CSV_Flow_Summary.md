# Master Contract CSV Upload & Data Flow – Technical Summary

## Purpose of This Document
This document explains the **end-to-end flow**, **system architecture**, and **root causes of issues** related to the **Master Contract CSV upload and data rendering** feature.  
It is intended to help **GitHub Copilot and developers** quickly understand the logic, constraints, and problems without re-reading the entire codebase.

---

## High-Level Architecture

```
User (UI)
  ↓
React (MasterContractManagement.jsx)
  ↓
backendClient (REST API)
  ↓
Fastify Routes
  ↓
EntityController
  ↓
EntityService
  ↓
EntityRepository
  ↓
PostgreSQL (Prisma)
```

---

## Expected Business Flow

### 1. CSV Template Download
- User downloads a CSV template from UI.
- Columns **match a subset** of `MasterContract` schema.
- Columns like `effective_status`, `version`, `approval fields` are **NOT included**.

This is intentional.

---

### 2. CSV Upload (Frontend Responsibility)

**User Actions**
1. Click **Upload Excel**
2. Select upload mode:
   - `new` → create new contracts
   - `revise` → create new version of existing contract
3. Upload `.csv` file

**Frontend Responsibilities**
- Parse CSV safely
- Validate mandatory fields (`contract_id`, `policy_no`)
- Ignore unused columns (e.g. `remark`, `currency` not used in table UI)
- Send clean payload to backend
- Reload table data after success

---

## Root Cause Analysis (Critical Issues)

### ❌ Issue 1: CSV Parsing Error (`Column count mismatch`)

**What Happened**
- CSV was parsed using:
  ```js
  line.split(',')
  ```
- CSV values contain commas inside quoted fields:
  ```csv
  "1,2,3"
  "DKI Jakarta,Jawa Barat"
  ```

**Impact**
- Column count mismatch
- False validation errors
- Partial upload with many failures

**Correct Approach**
- CSV must be parsed using a real CSV parser (e.g. PapaParse)
- Headers should be mapped by name, not index

---

### ❌ Issue 2: Data Not Appearing in UI Table

**What Happened**
- MasterContractManagement.jsx loads data using:
  ```js
  base44.entities.MasterContract.list()
  ```

**But**
- Team decision: **DO NOT USE base44**
- Other modules (Dashboard, BorderoManagement) already use:
  ```js
  backend.list('EntityName')
  ```

**Impact**
- Data exists in database
- UI table stays empty
- Manual refresh does not help

---

### ❌ Issue 3: Confusion Between Schema vs UI Fields

**Reality**
- UI table only needs:
  - contract_id
  - policy_no
  - product_type
  - credit_type
  - coverage period
  - max_plafond
  - share_tugure_percentage
  - effective_status

**Misunderstanding**
- Upload fails because CSV doesn't contain all schema fields

**Clarification**
- Missing fields are **expected**
- Backend should apply defaults:
  - `effective_status = Draft`
  - `version = 1`
  - approval fields = null

---

## Correct Upload Flow (Target State)

```
CSV File
  ↓
PapaParse (header-based parsing)
  ↓
Row validation
  ↓
backend.create('MasterContract', payload)
  ↓
EntityController.create()
  ↓
EntityService.create()
  ↓
EntityRepository.create()
  ↓
Database insert
  ↓
frontend reloads data
```

---

## Backend Flow (Already Correct)

### REST Endpoint
```
POST /api/apps/:appId/entities/MasterContract
```

### Controller
- Validates request
- Calls service

### Service
- No business logic
- Delegates to repository

### Repository
- Stores payload into `entityRecord`
- Uses Prisma safely

**No backend changes required**

---

## Data Reload Strategy (Frontend)

After upload success:
```js
await loadData();
```

Where `loadData()` must use:
```js
backend.list('MasterContract')
```

This guarantees:
- No page refresh needed
- Table updates instantly
- Consistent data source

---

## Logging & Debugging Strategy

### Frontend (Browser DevTools)
- CSV parsing result
- Per-row payload
- Backend responses

### Backend (Server Logs)
- Entity creation payload
- Prisma errors (if any)

This ensures:
- Fast root cause identification
- Clear separation of frontend vs backend issues

---

## Final Notes

- CSV parsing must NEVER be manual
- UI does not need full schema coverage
- Backend architecture is already solid
- Main fixes are **frontend-only**
- This document is optimized for GitHub Copilot context awareness

---

## Status
✅ Root causes identified  
✅ Architecture validated  
✅ Clear corrective direction  
⬜ Awaiting frontend refactor implementation
