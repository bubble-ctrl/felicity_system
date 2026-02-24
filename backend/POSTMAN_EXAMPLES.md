# Felicity Auth API — Postman Examples

Base URL: `http://localhost:5000`

---

## 1. Health Check

```
GET /api/health
```

**Response (200):**
```json
{
  "success": true,
  "message": "Server running",
  "timestamp": "2026-02-19T06:30:00.000Z"
}
```

---

## 2. Register — IIIT Participant

```
POST /api/auth/register
Content-Type: application/json

{
  "firstName": "Laveena",
  "lastName": "Jain",
  "email": "laveena.jain@students.iiit.ac.in",
  "password": "Test@123",
  "participantType": "iiit",
  "contactNumber": "9876543210",
  "collegeOrOrg": "IIIT Hyderabad"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "user": { "_id": "...", "firstName": "Laveena", "role": "participant", ... },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

---

## 3. Register — Non-IIIT Participant

```
POST /api/auth/register
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@gmail.com",
  "password": "Test@123",
  "participantType": "non-iiit",
  "contactNumber": "9876543211",
  "collegeOrOrg": "IIT Delhi"
}
```

---

## 4. Login (any role)

```
POST /api/auth/login
Content-Type: application/json

{
  "email": "laveena.jain@students.iiit.ac.in",
  "password": "Test@123"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": { ... },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

---

## 5. Get Current User Profile

```
GET /api/auth/me
Authorization: Bearer <token>
```

---

## 6. Admin Login

```
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@felicity.iiit.ac.in",
  "password": "Admin@123"
}
```

> First run `npm run seed` to create the admin account.

---

## 7. Admin Creates Organizer

```
POST /api/auth/create-organizer
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "organizerName": "Coding Club",
  "email": "coding.club@felicity.org",
  "password": "Club@123",
  "category": "Technical",
  "description": "IIIT Hyderabad Coding Club",
  "contactNumber": "9876543212"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Organizer account created successfully",
  "data": {
    "organizer": { "_id": "...", "organizerName": "Coding Club", "role": "organizer", ... },
    "credentials": {
      "email": "coding.club@felicity.org",
      "note": "Share these credentials securely with the organizer"
    }
  }
}
```

---

## Error Examples

**Duplicate email (400):**
```json
{ "success": false, "message": "An account with this email already exists" }
```

**Invalid IIIT email (400):**
```json
{ "success": false, "message": "IIIT participants must register with an IIIT-issued email address" }
```

**Wrong credentials (401):**
```json
{ "success": false, "message": "Invalid email or password" }
```

**No token (401):**
```json
{ "success": false, "message": "Access denied. No token provided." }
```

**Unauthorized role (403):**
```json
{ "success": false, "message": "Access denied. Role 'participant' is not authorized." }
```
