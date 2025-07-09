const { test, beforeEach, teardown } = require('tap');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const NotesService = require('../../src/services/NotesService');
const Note = require('../../src/models/Note');

let mongoServer;
let notesService;

// Setup before all tests
test('setup', async (t) => {
  // Start in-memory MongoDB instance
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  // Connect to the in-memory database
  await mongoose.connect(mongoUri);
  
  // Initialize service
  notesService = new NotesService();
  
  t.pass('Setup completed');
});

// Cleanup before each test
beforeEach(async () => {
  // Clear all notes before each test
  await Note.deleteMany({});
});

test('NotesService - createNote', async (t) => {
  t.test('should create a note with valid data', async (t) => {
    const noteData = {
      title: 'Test Note',
      body: 'This is a test note content'
    };
    
    const result = await notesService.createNote(noteData);
    
    t.ok(result._id, 'Note should have an ID');
    t.equal(result.title, noteData.title, 'Title should match');
    t.equal(result.body, noteData.body, 'Body should match');
    t.ok(result.createdAt, 'Should have createdAt timestamp');
    t.ok(result.updatedAt, 'Should have updatedAt timestamp');
  });

  t.test('should trim whitespace from title and body', async (t) => {
    const noteData = {
      title: '  Whitespace Test  ',
      body: '  Content with whitespace  '
    };
    
    const result = await notesService.createNote(noteData);
    
    t.equal(result.title, 'Whitespace Test', 'Title should be trimmed');
    t.equal(result.body, 'Content with whitespace', 'Body should be trimmed');
  });

  t.test('should throw error if title is missing', async (t) => {
    const noteData = {
      body: 'Body without title'
    };
    
    try {
      await notesService.createNote(noteData);
      t.fail('Should have thrown an error');
    } catch (error) {
      t.match(error.message, /Title and body are required/, 'Should throw validation error');
    }
  });

  t.test('should throw error if body is missing', async (t) => {
    const noteData = {
      title: 'Title without body'
    };
    
    try {
      await notesService.createNote(noteData);
      t.fail('Should have thrown an error');
    } catch (error) {
      t.match(error.message, /Title and body are required/, 'Should throw validation error');
    }
  });
});

test('NotesService - getAllNotes', async (t) => {
  t.test('should return empty array when no notes exist', async (t) => {
    const result = await notesService.getAllNotes();
    
    t.type(result, 'object', 'Result should be an array');
    t.equal(result.length, 0, 'Should return empty array');
  });

  t.test('should return all notes', async (t) => {
    // Create test notes with delays to ensure proper ordering
    await notesService.createNote({ title: 'Note 1', body: 'Body 1' });
    await new Promise(resolve => setTimeout(resolve, 10));
    await notesService.createNote({ title: 'Note 2', body: 'Body 2' });
    await new Promise(resolve => setTimeout(resolve, 10));
    await notesService.createNote({ title: 'Note 3', body: 'Body 3' });
    
    const result = await notesService.getAllNotes();
    
    t.equal(result.length, 3, 'Should return 3 notes');
    t.equal(result[0].title, 'Note 3', 'Should be sorted by createdAt desc (most recent first)');
  });

  t.test('should respect limit option', async (t) => {
    // Create test notes
    await notesService.createNote({ title: 'Note 1', body: 'Body 1' });
    await notesService.createNote({ title: 'Note 2', body: 'Body 2' });
    await notesService.createNote({ title: 'Note 3', body: 'Body 3' });
    
    const result = await notesService.getAllNotes({ limit: 2 });
    
    t.equal(result.length, 2, 'Should return only 2 notes');
  });

  t.test('should respect skip option', async (t) => {
    // Create test notes with small delays to ensure proper ordering
    await notesService.createNote({ title: 'Note 1', body: 'Body 1' });
    await new Promise(resolve => setTimeout(resolve, 10));
    await notesService.createNote({ title: 'Note 2', body: 'Body 2' });
    await new Promise(resolve => setTimeout(resolve, 10));
    await notesService.createNote({ title: 'Note 3', body: 'Body 3' });
    
    const result = await notesService.getAllNotes({ skip: 1, limit: 2 });
    
    t.equal(result.length, 2, 'Should return 2 notes');
    // Since notes are sorted by createdAt desc, the order is: Note 3, Note 2, Note 1
    // So skipping 1 means we skip Note 3 and get Note 2 and Note 1
    t.equal(result[0].title, 'Note 2', 'Should skip the first note (most recent)');
  });
});

test('NotesService - updateNote', async (t) => {
  t.test('should update note with valid data', async (t) => {
    const created = await notesService.createNote({
      title: 'Original Title',
      body: 'Original Body'
    });
    
    const updateData = {
      title: 'Updated Title',
      body: 'Updated Body'
    };
    
    const result = await notesService.updateNote(created._id, updateData);
    
    t.ok(result, 'Should return updated note');
    t.equal(result.title, updateData.title, 'Title should be updated');
    t.equal(result.body, updateData.body, 'Body should be updated');
    t.not(result.updatedAt, created.updatedAt, 'updatedAt should be changed');
  });

  t.test('should return null for non-existent ID', async (t) => {
    const fakeId = new mongoose.Types.ObjectId();
    const result = await notesService.updateNote(fakeId.toString(), { title: 'Test' });
    
    t.equal(result, null, 'Should return null for non-existent ID');
  });

  t.test('should return null for invalid ID format', async (t) => {
    const result = await notesService.updateNote('invalid-id', { title: 'Test' });
    
    t.equal(result, null, 'Should return null for invalid ID');
  });
});

test('NotesService - deleteNote', async (t) => {
  t.test('should delete note with valid ID', async (t) => {
    const created = await notesService.createNote({
      title: 'To Delete',
      body: 'Will be deleted'
    });
    
    const result = await notesService.deleteNote(created._id);
    
    t.equal(result, true, 'Should return true for successful deletion');
    
    // Verify note is actually deleted
    const deletedNote = await notesService.getNoteById(created._id);
    t.equal(deletedNote, null, 'Note should be deleted from database');
  });

  t.test('should return false for non-existent ID', async (t) => {
    const fakeId = new mongoose.Types.ObjectId();
    const result = await notesService.deleteNote(fakeId.toString());
    
    t.equal(result, false, 'Should return false for non-existent ID');
  });

  t.test('should return false for invalid ID format', async (t) => {
    const result = await notesService.deleteNote('invalid-id');
    
    t.equal(result, false, 'Should return false for invalid ID');
  });
});

test('NotesService - vectorSearch', async (t) => {
  t.test('should return empty array when no notes with embeddings exist', async (t) => {
    const result = await notesService.vectorSearch('test query');
    
    t.equal(result.length, 0, 'Should return empty array');
  });

  t.test('should calculate similarity scores correctly', async (t) => {
    // Create a note with mock embedding
    const note = new Note({
      title: 'Test Note',
      body: 'Test content',
      embedding: notesService.generateMockEmbedding('test content')
    });
    await note.save();
    
    const result = await notesService.vectorSearch('test', { limit: 5, threshold: 0.1 });
    
    t.ok(result.length > 0, 'Should find similar notes');
    t.ok(result[0].similarity >= 0.1, 'Should respect threshold');
    t.ok(result[0].similarity <= 1, 'Similarity should be between 0 and 1');
  });

  t.test('should respect limit and threshold options', async (t) => {
    // Create multiple notes with embeddings
    const embeddings = [
      notesService.generateMockEmbedding('machine learning'),
      notesService.generateMockEmbedding('deep learning'),
      notesService.generateMockEmbedding('artificial intelligence')
    ];
    
    await Note.create([
      { title: 'ML Note', body: 'Machine learning content', embedding: embeddings[0] },
      { title: 'DL Note', body: 'Deep learning content', embedding: embeddings[1] },
      { title: 'AI Note', body: 'AI content', embedding: embeddings[2] }
    ]);
    
    const result = await notesService.vectorSearch('learning', { limit: 2, threshold: 0.5 });
    
    t.ok(result.length <= 2, 'Should respect limit');
    t.ok(result.every(note => note.similarity >= 0.5), 'Should respect threshold');
  });
});

test('NotesService - utility methods', async (t) => {
  t.test('generateMockEmbedding should return normalized vector', async (t) => {
    const embedding = notesService.generateMockEmbedding('test text');
    
    t.type(embedding, 'object', 'Should return array');
    t.equal(embedding.length, 384, 'Should return 384-dimensional vector');
    
    // Check if vector is normalized (magnitude close to 1)
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    t.ok(Math.abs(magnitude - 1) < 0.01, 'Vector should be normalized');
  });

  t.test('calculateCosineSimilarity should work correctly', async (t) => {
    const vec1 = [1, 0, 0];
    const vec2 = [1, 0, 0];
    const vec3 = [0, 1, 0];
    
    const similarity1 = notesService.calculateCosineSimilarity(vec1, vec2);
    const similarity2 = notesService.calculateCosineSimilarity(vec1, vec3);
    
    t.equal(similarity1, 1, 'Identical vectors should have similarity 1');
    t.equal(similarity2, 0, 'Orthogonal vectors should have similarity 0');
  });
});

test('NotesService - getNoteById', async (t) => {
  t.test('should return note when found', async (t) => {
    const created = await notesService.createNote({
      title: 'Test Note',
      body: 'Test Body'
    });
    
    const result = await notesService.getNoteById(created._id);
    
    t.ok(result, 'Should return a note');
    t.equal(result._id.toString(), created._id.toString(), 'Should return the correct note');
    t.equal(result.title, 'Test Note', 'Title should match');
  });

  t.test('should return null for non-existent ID', async (t) => {
    const fakeId = new mongoose.Types.ObjectId();
    const result = await notesService.getNoteById(fakeId.toString());
    
    t.equal(result, null, 'Should return null for non-existent ID');
  });

  t.test('should return null for invalid ID format', async (t) => {
    const result = await notesService.getNoteById('invalid-id');
    
    t.equal(result, null, 'Should return null for invalid ID');
  });
});

test('NotesService - searchNotes', async (t) => {
  // Setup test data
  t.beforeEach(async () => {
    await notesService.createNote({ title: 'JavaScript Basics', body: 'Learn about variables and functions' });
    await notesService.createNote({ title: 'React Tutorial', body: 'Building components with JavaScript' });
    await notesService.createNote({ title: 'Node.js Guide', body: 'Server-side development with Node' });
    await notesService.createNote({ title: 'Database Design', body: 'MongoDB and SQL fundamentals' });
  });

  t.test('should return empty array for empty query', async (t) => {
    const result = await notesService.searchNotes('');
    
    t.equal(result.length, 0, 'Should return empty array for empty query');
  });

  t.test('should search by title', async (t) => {
    const result = await notesService.searchNotes('JavaScript');
    
    t.ok(result.length > 0, 'Should find notes');
    t.ok(result.some(note => note.title.includes('JavaScript')), 'Should find JavaScript note');
  });

  t.test('should search by body content', async (t) => {
    const result = await notesService.searchNotes('components');
    
    t.ok(result.length > 0, 'Should find notes');
    t.ok(result.some(note => note.body.includes('components')), 'Should find note with components in body');
  });

  t.test('should be case insensitive', async (t) => {
    const result = await notesService.searchNotes('javascript');
    
    t.ok(result.length > 0, 'Should find notes with case insensitive search');
  });

  t.test('should respect limit option', async (t) => {
    const result = await notesService.searchNotes('Node', { limit: 1 });
    
    t.equal(result.length, 1, 'Should respect limit option');
  });
});

test('NotesService - updateNote', async (t) => {
  t.test('should update note successfully', async (t) => {
    const created = await notesService.createNote({
      title: 'Original Title',
      body: 'Original Body'
    });
    
    const updated = await notesService.updateNote(created._id, {
      title: 'Updated Title',
      body: 'Updated Body'
    });
    
    t.ok(updated, 'Should return updated note');
    t.equal(updated.title, 'Updated Title', 'Title should be updated');
    t.equal(updated.body, 'Updated Body', 'Body should be updated');
    t.not(updated.updatedAt, created.updatedAt, 'UpdatedAt should be different');
  });

  t.test('should return null for non-existent note', async (t) => {
    const fakeId = new mongoose.Types.ObjectId();
    const result = await notesService.updateNote(fakeId.toString(), {
      title: 'New Title'
    });
    
    t.equal(result, null, 'Should return null for non-existent note');
  });

  t.test('should return null for invalid ID', async (t) => {
    const result = await notesService.updateNote('invalid-id', {
      title: 'New Title'
    });
    
    t.equal(result, null, 'Should return null for invalid ID');
  });
});

test('NotesService - deleteNote', async (t) => {
  t.test('should delete note successfully', async (t) => {
    const created = await notesService.createNote({
      title: 'To Delete',
      body: 'Delete me'
    });
    
    const deleted = await notesService.deleteNote(created._id);
    
    t.equal(deleted, true, 'Should return true for successful deletion');
    
    // Verify note is actually deleted
    const found = await notesService.getNoteById(created._id);
    t.equal(found, null, 'Note should be deleted from database');
  });

  t.test('should return false for non-existent note', async (t) => {
    const fakeId = new mongoose.Types.ObjectId();
    const result = await notesService.deleteNote(fakeId.toString());
    
    t.equal(result, false, 'Should return false for non-existent note');
  });

  t.test('should return false for invalid ID', async (t) => {
    const result = await notesService.deleteNote('invalid-id');
    
    t.equal(result, false, 'Should return false for invalid ID');
  });
});

test('NotesService - vectorSearch (bonus)', async (t) => {
  t.test('should generate mock embeddings', async (t) => {
    const embedding = notesService.generateMockEmbedding('test query');
    
    t.type(embedding, 'object', 'Should return an array');
    t.equal(embedding.length, 384, 'Should have 384 dimensions');
    t.ok(embedding.every(val => typeof val === 'number'), 'All values should be numbers');
  });

  t.test('should calculate cosine similarity', async (t) => {
    const vec1 = [1, 0, 0];
    const vec2 = [1, 0, 0];
    const vec3 = [0, 1, 0];
    
    const similarity1 = notesService.calculateCosineSimilarity(vec1, vec2);
    const similarity2 = notesService.calculateCosineSimilarity(vec1, vec3);
    
    t.equal(similarity1, 1, 'Identical vectors should have similarity 1');
    t.equal(similarity2, 0, 'Orthogonal vectors should have similarity 0');
  });

  t.test('should return empty array when no notes have embeddings', async (t) => {
    await notesService.createNote({ title: 'Test', body: 'Test' });
    
    const result = await notesService.vectorSearch('test query');
    
    t.equal(result.length, 0, 'Should return empty array when no embeddings exist');
  });
});

// Cleanup after all tests
teardown(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
}); 