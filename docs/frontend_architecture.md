# Frontend Architecture

## Overview

The Workout Progress Tracker frontend is a vanilla HTML/CSS/JavaScript single-page application (SPA) that communicates with the FastAPI backend via REST API.

## Folder Structure

```
frontend/
├── public/                    # Static assets (images, icons)
├── src/
│   ├── components/            # Reusable UI components
│   │   ├── navbar.js          # Navigation bar
│   │   ├── exercise-card.js   # Exercise display card
│   │   ├── set-row.js         # Single set input row
│   │   └── chart.js           # Progression chart component
│   ├── screens/               # Page-level modules
│   │   ├── login.js           # Auth screen
│   │   ├── workout-log.js     # Log a workout (Phase 5)
│   │   ├── workout-history.js # View past workouts (Phase 5)
│   │   └── progression.js     # Progression dashboard (Phase 5)
│   ├── services/              # API client layer
│   │   ├── api.js             # Base HTTP client (fetch wrapper)
│   │   ├── auth-service.js    # Auth API calls
│   │   ├── workout-service.js # Workout/set API calls
│   │   └── exercise-service.js# Exercise API calls
│   ├── styles/                # CSS files
│   │   ├── main.css           # Global styles & design tokens
│   │   └── components.css     # Component-specific styles
│   └── utils/                 # Shared helpers
│       ├── router.js          # Client-side hash router
│       └── storage.js         # Token/session storage helper
├── index.html                 # Entry point
└── app.js                     # App bootstrap & router init
```

## Screen-to-API Mapping

| Screen             | API Endpoints Used                              |
|--------------------|--------------------------------------------------|
| Login              | `POST /auth/register`, `POST /auth/login`        |
| Workout Log        | `POST /workouts`, `POST /sets`, `GET /exercises`  |
| Workout History    | `GET /workouts`, `GET /workouts/{id}`             |
| Progression        | `GET /exercises/{id}/progression`, `/recommendation` |

## Architecture Principles

1. **Separation of concerns** — Screens handle layout, components handle UI, services handle API
2. **Thin screens** — Screens compose components and delegate to services
3. **Reusable components** — Cards, rows, and charts are shared across screens
4. **Centralized API** — All HTTP calls go through `services/api.js`
5. **Client-side routing** — Hash-based router (`#/login`, `#/log`, `#/history`, `#/progression`)
