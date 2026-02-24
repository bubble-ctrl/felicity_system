# Felicity Event Management System

A comprehensive event management platform built with the MERN stack for managing college fest events, registrations, attendance, and communications.

## Technology Stack

- **MongoDB** – Database (MongoDB Atlas)
- **Express.js** – Backend REST API framework
- **React** (Vite) – Frontend SPA
- **Node.js** – Runtime

## Features Implemented

### Part 1: Core System (70 Marks)

- **Authentication & Security** — Participant registration (IIIT email validation for IIIT students, email+password for non-IIIT), organizer accounts provisioned by admin, bcrypt password hashing, JWT-based auth, role-based access control, session persistence
- **User Onboarding** — Post-signup preference selection (interests & club following), skip option, editable from Profile
- **User Data Models** — Participant (firstName, lastName, email, participantType, contactNumber, collegeOrOrg) and Organizer (organizerName, category, description, contactEmail, discordWebhookUrl)
- **Event Types** — Normal events (individual registration) and Merchandise events (variant-based purchases)
- **Event Attributes** — Name, description, type, eligibility, dates, limits, fee, tags, custom registration form (dynamic form builder), merchandise variants with stock/price/purchase limits
- **Participant Features** — Dashboard, Browse Events (search/filter/trending), Event Details, Registration Workflows (normal + merchandise), My Events (tabs: Upcoming, Normal, Merchandise, Completed, Cancelled), Profile editing (including interests, followed clubs, password change), Clubs/Organizers listing with follow/unfollow, Organizer detail page
- **Organizer Features** — Dashboard with analytics (registrations, attendance, revenue), Event CRUD with status lifecycle (Draft → Published → Ongoing → Closed → Completed), editing restrictions per status, Form Builder (text, dropdown, checkbox, file upload), Event Detail page (overview, analytics, participants, search/filter, CSV export), Profile editing with Discord Webhook URL
- **Admin Features** — Manage organizers (create with auto-generated credentials, disable/remove), Password Reset Requests management (approve/reject)
- **Email & Tickets** — Registration confirmation emails via Nodemailer, QR code tickets with unique Ticket IDs

### Part 2: Advanced Features (30 Marks)

#### Tier A: Core Advanced Features (2 chosen — 16 Marks)

1. **Merchandise Payment Approval Workflow** — Payment proof upload, Pending Approval state, organizer approve/reject tab, stock decrement on approval, QR ticket + confirmation email on approval
2. **QR Scanner & Attendance Tracking** — Built-in QR scanner (camera + file upload), attendance marking with timestamp, duplicate scan rejection, live attendance dashboard, CSV export, manual override

#### Tier B: Real-time & Communication Features (2 chosen — 12 Marks)

1. **Real-Time Discussion Forum** — Socket.IO powered real-time messaging on Event Details page, participant posting, organizer moderation (delete/pin), announcements
2. **Organizer Password Reset Workflow** — Organizer requests reset, admin views/approves/rejects with comments, auto-generates new password, request status tracking and history

#### Tier C: Integration & Enhancement Features (1 chosen — 2 Marks)

1. **Anonymous Feedback System** — Star rating (1–5) + text comments, anonymous via SHA-256 hashing, organizer dashboard with aggregated stats/distribution/filtering, CSV export

## Project Structure

```
felicity/
├── backend/
│   ├── config/         # Constants, DB config
│   ├── controllers/    # Route handlers
│   ├── middleware/      # Auth, validation
│   ├── models/          # Mongoose schemas
│   ├── routes/          # Express routes
│   ├── utils/           # Email, JWT, errors
│   └── server.js        # Entry point
├── frontend/
│   ├── src/
│   │   ├── components/  # Reusable components
│   │   ├── context/     # Auth context
│   │   ├── pages/       # Page components
│   │   ├── services/    # API client
│   │   └── App.jsx      # Router setup
│   └── index.html
├── deployment.txt       # Deployment URLs
└── README.md
```

## Setup & Running

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)

### Backend
```bash
cd backend
npm install
cp .env.example .env  # Configure environment variables
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Environment Variables (Backend)
- `MONGODB_URI` — MongoDB connection string
- `JWT_SECRET` — JWT signing secret
- `PORT` — Server port (default: 5000)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` — Email configuration
