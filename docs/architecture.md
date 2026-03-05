# Backend Architecture

## Overview

The Workout Progress Tracker backend follows a layered architecture using FastAPI, SQLAlchemy, and Pydantic.

## Folder Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI entry point
│   ├── api/
│   │   ├── __init__.py
│   │   └── routes/           # Thin endpoint handlers
│   │       └── __init__.py
│   ├── models/               # SQLAlchemy ORM models
│   │   └── __init__.py
│   ├── schemas/              # Pydantic request/response schemas
│   │   └── __init__.py
│   ├── services/             # Business logic layer
│   │   └── __init__.py
│   ├── database/             # DB connection and session management
│   │   └── __init__.py
│   └── utils/                # Shared helpers and utilities
│       └── __init__.py
└── tests/                    # PyTest test suite
    └── __init__.py
```

## Request Flow

```
Client → API Route → Service → Database
```

- **Routes** handle HTTP concerns only (validation, response codes).
- **Services** contain all business logic (progression, plateau detection).
- **Models** define the database schema via SQLAlchemy.
- **Schemas** define Pydantic models for request/response validation.

## Tech Stack

| Layer       | Technology |
|-------------|------------|
| Framework   | FastAPI    |
| Database    | PostgreSQL |
| ORM         | SQLAlchemy |
| Validation  | Pydantic   |
| Testing     | PyTest     |
