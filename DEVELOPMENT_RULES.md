DEVELOPMENT RULES

General

Always prefer modular code.
Never duplicate logic.
Reuse services and utilities.

Backend Architecture

Framework
FastAPI

Database
PostgreSQL

ORM
SQLAlchemy

Validation
Pydantic

Testing
PyTest

Folder Structure

backend/

app/
main.py

api/
routes/

models/
schemas/

services/

database/

utils/

tests/

API RULES

Endpoints must be thin.

Example flow:

API → Service → Database

Business logic must live in services.

Example

services/progression_service.py

calculate_next_weight()

TESTING RULES

Every service must have tests.

Tests must cover

normal cases
edge cases
invalid input
boundary conditions

CODE QUALITY

Functions must be

short
single responsibility
testable

Avoid:

giant files
duplicate logic
tight coupling