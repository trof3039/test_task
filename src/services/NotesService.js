const Note = require('../models/Note');
const mongoose = require('mongoose');

class NotesService {
  async createNote(noteData) {
    try {
      const { title, body } = noteData;
      
      if (!title || !body) {
        throw new Error('Title and body are required');
      }
      
      const note = new Note({
        title: title.trim(),
        body: body.trim()
      });
      
      const savedNote = await note.save();
      return savedNote.toJSON();
    } catch (error) {
      throw new Error(`Failed to create note: ${error.message}`);
    }
  }

  async getAllNotes(options = {}) {
    try {
      const { limit = 50, skip = 0, sort = { createdAt: -1 } } = options;
      
      const notes = await Note.find({})
        .sort(sort)
        .limit(limit)
        .skip(skip)
        .lean();
      
      return notes;
    } catch (error) {
      throw new Error(`Failed to retrieve notes: ${error.message}`);
    }
  }

  async getNoteById(id) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return null;
      }
      
      const note = await Note.findById(id).lean();
      return note;
    } catch (error) {
      throw new Error(`Failed to retrieve note: ${error.message}`);
    }
  }

  async searchNotes(query, options = {}) {
    try {
      if (!query || query.trim().length === 0) {
        return [];
      }
      
      const { limit = 50, skip = 0 } = options;
      const searchQuery = query.trim();
      
      const sanitizedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      let searchFilter;
      
      try {
        searchFilter = { $text: { $search: searchQuery } };
        const textSearchResults = await Note.find(searchFilter)
          .sort({ score: { $meta: 'textScore' } })
          .limit(limit)
          .skip(skip)
          .lean();
        
        if (textSearchResults.length > 0) {
          return textSearchResults;
        }
      } catch (textSearchError) {
        console.warn('Text search failed, using regex fallback:', textSearchError.message);
      }
      
      searchFilter = {
        $or: [
          { title: { $regex: sanitizedQuery, $options: 'i' } },
          { body: { $regex: sanitizedQuery, $options: 'i' } }
        ]
      };
      
      const notes = await Note.find(searchFilter)
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .lean();
      
      return notes;
    } catch (error) {
      throw new Error(`Failed to search notes: ${error.message}`);
    }
  }

  async updateNote(id, updateData) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return null;
      }
      
      const { title, body } = updateData;
      const updateFields = {};
      
      if (title !== undefined) updateFields.title = title.trim();
      if (body !== undefined) updateFields.body = body.trim();
      
      const note = await Note.findByIdAndUpdate(
        id,
        updateFields,
        { new: true, runValidators: true }
      ).lean();
      
      return note;
    } catch (error) {
      throw new Error(`Failed to update note: ${error.message}`);
    }
  }

  async deleteNote(id) {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return false;
      }
      
      const result = await Note.findByIdAndDelete(id);
      return !!result;
    } catch (error) {
      throw new Error(`Failed to delete note: ${error.message}`);
    }
  }

  async vectorSearch(query, options = {}) {
    try {
      const { limit = 10, threshold = 0.7 } = options;
      
      const queryEmbedding = this.generateMockEmbedding(query);
      
      const notesWithEmbeddings = await Note.find({ 
        embedding: { $exists: true, $ne: null } 
      }).lean();
      
      const similarities = notesWithEmbeddings.map(note => ({
        ...note,
        similarity: this.calculateCosineSimilarity(queryEmbedding, note.embedding)
      }));
      
      const results = similarities
        .filter(note => note.similarity >= threshold)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
      
      return results;
    } catch (error) {
      throw new Error(`Failed to perform vector search: ${error.message}`);
    }
  }

  generateMockEmbedding(text) {
    const words = text.toLowerCase().split(/\s+/);
    const embedding = new Array(384).fill(0);
    
    words.forEach((word, index) => {
      const hash = this.simpleHash(word);
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] += Math.sin(hash + i + index) * 0.1;
      }
    });
    
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / magnitude);
  }

  calculateCosineSimilarity(vecA, vecB) {
    if (vecA.length !== vecB.length) return 0;
    
    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      magnitudeA += vecA[i] * vecA[i];
      magnitudeB += vecB[i] * vecB[i];
    }
    
    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);
    
    if (magnitudeA === 0 || magnitudeB === 0) return 0;
    
    return dotProduct / (magnitudeA * magnitudeB);
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}

module.exports = NotesService; 