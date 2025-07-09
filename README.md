# mod-notes

A modular Fastify plugin for notes management with MongoDB and optional vector search capabilities.

## Overview

`mod-notes` is a Fastify plugin that provides a complete notes management system with CRUD operations, search functionality, and optional AI-powered vector search.

## Features

- **CRUD Operations**: Create, read, update, delete notes
- **MongoDB Integration**: Data persistence with Mongoose
- **Search Functionality**: Full-text search by title and body
- **Pagination Support**: Limit and skip options for all endpoints
- **Input Validation**: Request validation with JSON schemas
- **Error Handling**: Structured error responses
- **Swagger Documentation**: Auto-generated API documentation
- **Health Checks**: Built-in health monitoring endpoint
- **Vector Search**: Semantic similarity search with mock embeddings

## Installation

### Prerequisites
- Node.js 16+ 
- MongoDB 4.4+
- npm or yarn

### Quick Start

1. **Clone and Install**
```bash
git clone <repository-url>
cd mod-notes
npm install
```

2. **Environment Setup**
```bash
cp .env.example .env
# Edit .env with your MongoDB connection string
```

3. **Start MongoDB**
```bash
# Using Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

4. **Run the Application**
```bash
# Development mode
npm run dev

# Production mode
npm start
```

5. **Verify Installation**
Visit http://localhost:3000/health to check if the service is running.

## Configuration

### Environment Variables

Create a `.env` file based on `.env.example`:

```bash
MONGODB_URL=mongodb://localhost:27017/mod-notes
PORT=3000
HOST=0.0.0.0
NODE_ENV=development
```

## Usage

### As a Fastify Plugin

```javascript
const fastify = require('fastify')({ logger: true });

await fastify.register(require('mod-notes'), {
  mongoUrl: 'mongodb://localhost:27017/your-db',
  prefix: '/api/v1'
});

await fastify.listen({ port: 3000 });
```

### Standalone Server

```bash
npm run dev
```

The server will start on http://localhost:3000 with the following endpoints available:

- 📝 **API**: http://localhost:3000/api/v1/notes
- 📚 **Swagger Docs**: http://localhost:3000/documentation  
- 💚 **Health Check**: http://localhost:3000/health

## API Documentation

### Base URL
```
http://localhost:3000/api/v1
```

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/notes` | Create a new note |
| `GET` | `/notes` | Get all notes (with pagination) |
| `GET` | `/notes/:id` | Get note by ID |
| `PUT` | `/notes/:id` | Update note by ID |
| `DELETE` | `/notes/:id` | Delete note by ID |
| `GET` | `/notes/search` | Search notes by text |
| `GET` | `/notes/vector-search` | Vector similarity search |

### Request/Response Examples

#### Create Note
```bash
curl -X POST http://localhost:3000/api/v1/notes \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My First Note",
    "body": "This is the content of my note"
  }'
```

**Response:**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "title": "My First Note",
  "body": "This is the content of my note",
  "createdAt": "2023-12-07T10:30:00.000Z",
  "updatedAt": "2023-12-07T10:30:00.000Z"
}
```

#### Get All Notes
```bash
curl "http://localhost:3000/api/v1/notes?limit=10&skip=0"
```

#### Search Notes
```bash
curl "http://localhost:3000/api/v1/notes/search?q=javascript&limit=5"
```

#### Vector Search
```bash
curl "http://localhost:3000/api/v1/notes/vector-search?q=machine learning&threshold=0.7"
```

## Testing

### Run All Tests
```bash
npm test
```

### Run Specific Test Types
```bash
# Unit tests only
npm run test:unit

# Integration tests only  
npm run test:integration
```

### Test Structure
```
test/
├── unit/
│   └── NotesService.test.js    # Service layer tests
└── integration/
    └── notes.test.js           # API endpoint tests
```

## Architecture

### Project Structure
```
mod-notes/
├── src/
│   ├── models/          # Mongoose schemas
│   │   └── Note.js
│   ├── services/        # Business logic
│   │   └── NotesService.js
│   ├── routes/          # Route handlers
│   │   └── notes.js
│   └── utils/           # Shared utilities
├── test/
│   ├── unit/            # Unit tests
│   └── integration/     # Integration tests
├── index.js             # Plugin entry point
├── example.js           # Usage example
└── package.json
```

## Vector Search

The plugin includes a mock vector search implementation that demonstrates the architecture for semantic similarity search:

```javascript
const results = await notesService.vectorSearch('machine learning', {
  limit: 10,
  threshold: 0.7
});
```

## Production Deployment

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Environment Variables for Production
```bash
NODE_ENV=production
MONGODB_URL=mongodb://your-production-db/mod-notes
PORT=3000
```

## Troubleshooting

**MongoDB Connection Issues:**
```bash
# Check MongoDB status
mongosh --eval "db.runCommand('ping')"
```

**Port Already in Use:**
```bash
# Change port in .env file
PORT=3001
```

**Test Failures:**
```bash
# Clean install dependencies
rm -rf node_modules package-lock.json
npm install
npm test
```

## License

MIT License - see LICENSE file for details.