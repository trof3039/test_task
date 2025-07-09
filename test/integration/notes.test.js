const { test, beforeEach, teardown } = require('tap');
const fastify = require('fastify')({ logger: false });
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Note = require('../../src/models/Note');

let mongoServer;
let app;

// Setup before all tests
test('setup', async (t) => {
  // Start in-memory MongoDB instance
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  // Register the plugin with test database
  await fastify.register(require('../../index.js'), {
    mongoUrl: mongoUri,
    prefix: '/api/v1'
  });
  
  app = fastify;
  
  // Wait for MongoDB connection to be ready
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  t.pass('Setup completed');
});

// Cleanup before each test
beforeEach(async () => {
  // Clear all notes before each test
  try {
    await Note.deleteMany({});
  } catch (error) {
    // Ignore cleanup errors in tests
    console.warn('Cleanup error:', error.message);
  }
});

test('POST /api/v1/notes', async (t) => {
  t.test('should create a note successfully', async (t) => {
    const noteData = {
      title: 'Integration Test Note',
      body: 'This is a test note created via API'
    };
    
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/notes',
      payload: noteData
    });
    
    t.equal(response.statusCode, 201, 'Should return 201 status');
    
    const result = JSON.parse(response.payload);
    t.ok(result._id, 'Response should include note ID');
    t.equal(result.title, noteData.title, 'Title should match');
    t.equal(result.body, noteData.body, 'Body should match');
    t.ok(result.createdAt, 'Should include createdAt');
    t.ok(result.updatedAt, 'Should include updatedAt');
  });

  t.test('should return 400 for missing title', async (t) => {
    const noteData = {
      body: 'Body without title'
    };
    
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/notes',
      payload: noteData
    });
    
    t.equal(response.statusCode, 400, 'Should return 400 status');
    
    const result = JSON.parse(response.payload);
    t.ok(result.error, 'Should include error message');
    t.equal(result.statusCode, 400, 'Should include status code');
  });

  t.test('should return 400 for missing body', async (t) => {
    const noteData = {
      title: 'Title without body'
    };
    
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/notes',
      payload: noteData
    });
    
    t.equal(response.statusCode, 400, 'Should return 400 status');
    
    const result = JSON.parse(response.payload);
    t.ok(result.error, 'Should include error message');
  });

  t.test('should validate title length', async (t) => {
    const noteData = {
      title: 'x'.repeat(201), // Exceeds maxlength of 200
      body: 'Valid body'
    };
    
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/notes',
      payload: noteData
    });
    
    t.equal(response.statusCode, 400, 'Should return 400 for title too long');
  });
});

test('GET /api/v1/notes', async (t) => {
  t.test('should return empty array when no notes exist', async (t) => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/notes'
    });
    
    t.equal(response.statusCode, 200, 'Should return 200 status');
    
    const result = JSON.parse(response.payload);
    t.type(result, 'object', 'Should return an array');
    t.equal(result.length, 0, 'Should return empty array');
  });

  t.test('should return all notes', async (t) => {
    // Create test notes directly in database
    await Note.create({ title: 'Note 1', body: 'Body 1' });
    await Note.create({ title: 'Note 2', body: 'Body 2' });
    await Note.create({ title: 'Note 3', body: 'Body 3' });
    
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/notes'
    });
    
    t.equal(response.statusCode, 200, 'Should return 200 status');
    
    const result = JSON.parse(response.payload);
    t.equal(result.length, 3, 'Should return 3 notes');
    t.ok(result[0]._id, 'Each note should have an ID');
    t.ok(result[0].title, 'Each note should have a title');
    t.ok(result[0].body, 'Each note should have a body');
  });

  t.test('should respect limit query parameter', async (t) => {
    // Create test notes
    await Note.create({ title: 'Note 1', body: 'Body 1' });
    await Note.create({ title: 'Note 2', body: 'Body 2' });
    await Note.create({ title: 'Note 3', body: 'Body 3' });
    
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/notes?limit=2'
    });
    
    t.equal(response.statusCode, 200, 'Should return 200 status');
    
    const result = JSON.parse(response.payload);
    t.equal(result.length, 2, 'Should return only 2 notes');
  });

  t.test('should respect skip query parameter', async (t) => {
    // Create test notes
    await Note.create({ title: 'Note 1', body: 'Body 1' });
    await Note.create({ title: 'Note 2', body: 'Body 2' });
    await Note.create({ title: 'Note 3', body: 'Body 3' });
    
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/notes?skip=1&limit=2'
    });
    
    t.equal(response.statusCode, 200, 'Should return 200 status');
    
    const result = JSON.parse(response.payload);
    t.equal(result.length, 2, 'Should return 2 notes');
  });
});

test('GET /api/v1/notes/:id', async (t) => {
  t.test('should return note by valid ID', async (t) => {
    const note = await Note.create({ title: 'Test Note', body: 'Test Body' });
    
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/notes/${note._id}`
    });
    
    t.equal(response.statusCode, 200, 'Should return 200 status');
    
    const result = JSON.parse(response.payload);
    t.equal(result._id, note._id.toString(), 'Should return correct note');
    t.equal(result.title, 'Test Note', 'Title should match');
    t.equal(result.body, 'Test Body', 'Body should match');
  });

  t.test('should return 404 for non-existent ID', async (t) => {
    const fakeId = new mongoose.Types.ObjectId();
    
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/notes/${fakeId}`
    });
    
    t.equal(response.statusCode, 404, 'Should return 404 status');
    
    const result = JSON.parse(response.payload);
    t.ok(result.error, 'Should include error message');
    t.equal(result.statusCode, 404, 'Should include status code');
  });

  t.test('should return 400 for invalid ID format', async (t) => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/notes/invalid-id'
    });
    
    t.equal(response.statusCode, 400, 'Should return 400 for invalid ID format');
    
    const result = JSON.parse(response.payload);
    t.ok(result.error, 'Should include error message');
    t.equal(result.statusCode, 400, 'Should include status code');
  });
});

test('GET /api/v1/notes/search', async (t) => {
  // Setup test data
  t.beforeEach(async () => {
    await Note.create({ title: 'JavaScript Basics', body: 'Learn about variables and functions' });
    await Note.create({ title: 'React Tutorial', body: 'Building components with JavaScript' });
    await Note.create({ title: 'Node.js Guide', body: 'Server-side development with Node' });
    await Note.create({ title: 'Database Design', body: 'MongoDB and SQL fundamentals' });
  });

  t.test('should search notes by title', async (t) => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/notes/search?q=JavaScript'
    });
    
    t.equal(response.statusCode, 200, 'Should return 200 status');
    
    const result = JSON.parse(response.payload);
    t.ok(result.length > 0, 'Should find notes');
    t.ok(result.some(note => note.title.includes('JavaScript')), 'Should find JavaScript note');
  });

  t.test('should search notes by body content', async (t) => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/notes/search?q=components'
    });
    
    t.equal(response.statusCode, 200, 'Should return 200 status');
    
    const result = JSON.parse(response.payload);
    t.ok(result.length > 0, 'Should find notes');
    t.ok(result.some(note => note.body.includes('components')), 'Should find note with components');
  });

  t.test('should return 400 for missing query parameter', async (t) => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/notes/search'
    });
    
    t.equal(response.statusCode, 400, 'Should return 400 status');
    
    const result = JSON.parse(response.payload);
    t.ok(result.error, 'Should include error message');
  });

  t.test('should handle empty search results', async (t) => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/notes/search?q=nonexistent'
    });
    
    t.equal(response.statusCode, 200, 'Should return 200 status');
    
    const result = JSON.parse(response.payload);
    t.equal(result.length, 0, 'Should return empty array');
  });

  t.test('should respect limit in search', async (t) => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/notes/search?q=Node&limit=1'
    });
    
    t.equal(response.statusCode, 200, 'Should return 200 status');
    
    const result = JSON.parse(response.payload);
    t.ok(result.length <= 1, 'Should respect limit parameter');
  });
});

test('PUT /api/v1/notes/:id', async (t) => {
  t.test('should update note successfully', async (t) => {
    const note = await Note.create({ title: 'Original Title', body: 'Original Body' });
    
    const updateData = {
      title: 'Updated Title',
      body: 'Updated Body'
    };
    
    const response = await app.inject({
      method: 'PUT',
      url: `/api/v1/notes/${note._id}`,
      payload: updateData
    });
    
    t.equal(response.statusCode, 200, 'Should return 200 status');
    
    const result = JSON.parse(response.payload);
    t.equal(result.title, 'Updated Title', 'Title should be updated');
    t.equal(result.body, 'Updated Body', 'Body should be updated');
    t.equal(result._id, note._id.toString(), 'ID should remain the same');
  });

  t.test('should return 404 for non-existent note', async (t) => {
    const fakeId = new mongoose.Types.ObjectId();
    
    const response = await app.inject({
      method: 'PUT',
      url: `/api/v1/notes/${fakeId}`,
      payload: { title: 'New Title' }
    });
    
    t.equal(response.statusCode, 404, 'Should return 404 status');
  });

  t.test('should allow partial updates', async (t) => {
    const note = await Note.create({ title: 'Original Title', body: 'Original Body' });
    
    const response = await app.inject({
      method: 'PUT',
      url: `/api/v1/notes/${note._id}`,
      payload: { title: 'Only Title Updated' }
    });
    
    t.equal(response.statusCode, 200, 'Should return 200 status');
    
    const result = JSON.parse(response.payload);
    t.equal(result.title, 'Only Title Updated', 'Title should be updated');
    t.equal(result.body, 'Original Body', 'Body should remain unchanged');
  });
});

test('DELETE /api/v1/notes/:id', async (t) => {
  t.test('should delete note successfully', async (t) => {
    const note = await Note.create({ title: 'To Delete', body: 'Delete me' });
    
    const response = await app.inject({
      method: 'DELETE',
      url: `/api/v1/notes/${note._id}`
    });
    
    t.equal(response.statusCode, 200, 'Should return 200 status');
    
    const result = JSON.parse(response.payload);
    t.equal(result.deleted, true, 'Should confirm deletion');
    t.ok(result.message, 'Should include success message');
    
    // Verify note is actually deleted
    const deletedNote = await Note.findById(note._id);
    t.equal(deletedNote, null, 'Note should be deleted from database');
  });

  t.test('should return 404 for non-existent note', async (t) => {
    const fakeId = new mongoose.Types.ObjectId();
    
    const response = await app.inject({
      method: 'DELETE',
      url: `/api/v1/notes/${fakeId}`
    });
    
    t.equal(response.statusCode, 404, 'Should return 404 status');
  });
});

test('GET /api/v1/notes/vector-search (bonus)', async (t) => {
  t.test('should return empty results when no embeddings exist', async (t) => {
    // Create notes without embeddings
    await Note.create({ title: 'Test Note', body: 'Test content' });
    
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/notes/vector-search?q=test'
    });
    
    t.equal(response.statusCode, 200, 'Should return 200 status');
    
    const result = JSON.parse(response.payload);
    t.equal(result.length, 0, 'Should return empty array when no embeddings exist');
  });

  t.test('should return 400 for missing query parameter', async (t) => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/notes/vector-search'
    });
    
    t.equal(response.statusCode, 400, 'Should return 400 status');
    
    const result = JSON.parse(response.payload);
    t.ok(result.error, 'Should include error message');
  });

  t.test('should handle threshold parameter', async (t) => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/notes/vector-search?q=test&threshold=0.8'
    });
    
    t.equal(response.statusCode, 200, 'Should return 200 status');
  });
});

test('GET /health', async (t) => {
  t.test('should return health status', async (t) => {
    const response = await app.inject({
      method: 'GET',
      url: '/health'
    });
    
    t.equal(response.statusCode, 200, 'Should return 200 status');
    
    const result = JSON.parse(response.payload);
    t.equal(result.status, 'ok', 'Should return ok status');
    t.ok(result.timestamp, 'Should include timestamp');
    t.ok(result.uptime >= 0, 'Should include uptime');
    t.ok(result.database, 'Should include database status');
    t.ok(result.version, 'Should include version');
  });
});

test('Integration - Complete workflow', async (t) => {
  t.test('should handle complete CRUD workflow', async (t) => {
    // 1. Create a note
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/notes',
      payload: {
        title: 'Workflow Test',
        body: 'Testing complete workflow'
      }
    });
    
    t.equal(createResponse.statusCode, 201, 'Should create note');
    const createdNote = JSON.parse(createResponse.payload);
    
    // 2. Get the note by ID
    const getResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/notes/${createdNote._id}`
    });
    
    t.equal(getResponse.statusCode, 200, 'Should get note by ID');
    
    // 3. Update the note
    const updateResponse = await app.inject({
      method: 'PUT',
      url: `/api/v1/notes/${createdNote._id}`,
      payload: {
        title: 'Updated Workflow Test',
        body: 'Updated workflow content'
      }
    });
    
    t.equal(updateResponse.statusCode, 200, 'Should update note');
    const updatedNote = JSON.parse(updateResponse.payload);
    t.equal(updatedNote.title, 'Updated Workflow Test', 'Title should be updated');
    
    // 4. Search for the note
    const searchResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/notes/search?q=Updated'
    });
    
    t.equal(searchResponse.statusCode, 200, 'Should search notes');
    const searchResults = JSON.parse(searchResponse.payload);
    t.ok(searchResults.length > 0, 'Should find updated note');
    
    // 5. Delete the note
    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: `/api/v1/notes/${createdNote._id}`
    });
    
    t.equal(deleteResponse.statusCode, 200, 'Should delete note');
    
    // 6. Verify deletion
    const getDeletedResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/notes/${createdNote._id}`
    });
    
    t.equal(getDeletedResponse.statusCode, 404, 'Should return 404 for deleted note');
  });
});

// Cleanup after all tests
teardown(async () => {
  if (app) {
    await app.close();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
}); 