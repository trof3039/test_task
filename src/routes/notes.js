const NotesService = require('../services/NotesService');

// Swagger schemas for request/response validation and documentation
const schemas = {
  createNoteBody: {
    type: 'object',
    required: ['title', 'body'],
    properties: {
      title: { 
        type: 'string', 
        minLength: 1, 
        maxLength: 200,
        description: 'The title of the note'
      },
      body: { 
        type: 'string', 
        minLength: 1,
        description: 'The content/body of the note'
      }
    }
  },
  noteResponse: {
    type: 'object',
    properties: {
      _id: { type: 'string', description: 'Note ID' },
      title: { type: 'string', description: 'Note title' },
      body: { type: 'string', description: 'Note content' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
      embedding: { 
        type: 'array', 
        items: { type: 'number' },
        description: 'Vector embedding (optional)'
      }
    }
  },
  errorResponse: {
    type: 'object',
    properties: {
      error: { type: 'string', description: 'Error message' },
      statusCode: { type: 'integer', description: 'HTTP status code' }
    }
  }
};

async function notesRoutes(fastify, options) {
  const notesService = new NotesService();

  fastify.route({
    method: 'POST',
    url: '/notes',
    schema: {
      tags: ['Notes'],
      summary: 'Create a new note',
      description: 'Creates a new note with title and body',
      body: schemas.createNoteBody,
      response: {
        201: {
          description: 'Note created successfully',
          ...schemas.noteResponse
        },
        400: {
          description: 'Bad request - validation error',
          ...schemas.errorResponse
        },
        500: {
          description: 'Internal server error',
          ...schemas.errorResponse
        }
      }
    },
    handler: async (request, reply) => {
      try {
        const note = await notesService.createNote(request.body);
        reply.code(201).send(note);
      } catch (error) {
        fastify.log.error(error);
        reply.code(400).send({
          error: error.message,
          statusCode: 400
        });
      }
    }
  });

  fastify.route({
    method: 'GET',
    url: '/notes',
    schema: {
      tags: ['Notes'],
      summary: 'Get all notes',
      description: 'Retrieves all notes with optional pagination',
      querystring: {
        type: 'object',
        properties: {
          limit: { 
            type: 'integer', 
            minimum: 1, 
            maximum: 100, 
            default: 50,
            description: 'Maximum number of notes to return'
          },
          skip: { 
            type: 'integer', 
            minimum: 0, 
            default: 0,
            description: 'Number of notes to skip for pagination'
          }
        }
      },
      response: {
        200: {
          description: 'Notes retrieved successfully',
          type: 'array',
          items: schemas.noteResponse
        },
        500: {
          description: 'Internal server error',
          ...schemas.errorResponse
        }
      }
    },
    handler: async (request, reply) => {
      try {
        const { limit, skip } = request.query;
        const notes = await notesService.getAllNotes({ limit, skip });
        reply.send(notes);
      } catch (error) {
        fastify.log.error(error);
        reply.code(500).send({
          error: error.message,
          statusCode: 500
        });
      }
    }
  });

  fastify.route({
    method: 'GET',
    url: '/notes/:id',
    schema: {
      tags: ['Notes'],
      summary: 'Get note by ID',
      description: 'Retrieves a specific note by its ID',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { 
            type: 'string',
            pattern: '^[0-9a-fA-F]{24}$',
            description: 'MongoDB ObjectId of the note (24 character hex string)'
          }
        }
      },
      response: {
        200: {
          description: 'Note found',
          ...schemas.noteResponse
        },
        404: {
          description: 'Note not found',
          ...schemas.errorResponse
        },
        500: {
          description: 'Internal server error',
          ...schemas.errorResponse
        }
      }
    },
    handler: async (request, reply) => {
      try {
        const note = await notesService.getNoteById(request.params.id);
        
        if (!note) {
          return reply.code(404).send({
            error: 'Note not found',
            statusCode: 404
          });
        }
        
        reply.send(note);
      } catch (error) {
        fastify.log.error(error);
        reply.code(500).send({
          error: error.message,
          statusCode: 500
        });
      }
    }
  });

  fastify.route({
    method: 'GET',
    url: '/notes/search',
    schema: {
      tags: ['Notes'],
      summary: 'Search notes',
      description: 'Search notes by title and body content using text search or regex',
      querystring: {
        type: 'object',
        required: ['q'],
        properties: {
          q: { 
            type: 'string',
            minLength: 1,
            description: 'Search query'
          },
          limit: { 
            type: 'integer', 
            minimum: 1, 
            maximum: 100, 
            default: 50,
            description: 'Maximum number of results to return'
          },
          skip: { 
            type: 'integer', 
            minimum: 0, 
            default: 0,
            description: 'Number of results to skip for pagination'
          }
        }
      },
      response: {
        200: {
          description: 'Search results',
          type: 'array',
          items: schemas.noteResponse
        },
        400: {
          description: 'Bad request - missing search query',
          ...schemas.errorResponse
        },
        500: {
          description: 'Internal server error',
          ...schemas.errorResponse
        }
      }
    },
    handler: async (request, reply) => {
      try {
        const { q: query, limit, skip } = request.query;
        
        if (!query || query.trim().length === 0) {
          return reply.code(400).send({
            error: 'Search query is required',
            statusCode: 400
          });
        }
        
        const notes = await notesService.searchNotes(query, { limit, skip });
        reply.send(notes);
      } catch (error) {
        fastify.log.error(error);
        reply.code(500).send({
          error: error.message,
          statusCode: 500
        });
      }
    }
  });

  fastify.route({
    method: 'GET',
    url: '/notes/vector-search',
    schema: {
      tags: ['Notes', 'AI'],
      summary: 'Vector search notes (BONUS)',
      description: 'Search notes using semantic similarity with vector embeddings',
      querystring: {
        type: 'object',
        required: ['q'],
        properties: {
          q: { 
            type: 'string',
            minLength: 1,
            description: 'Search query for semantic similarity'
          },
          limit: { 
            type: 'integer', 
            minimum: 1, 
            maximum: 50, 
            default: 10,
            description: 'Maximum number of results to return'
          },
          threshold: { 
            type: 'number', 
            minimum: 0, 
            maximum: 1, 
            default: 0.7,
            description: 'Minimum similarity threshold (0-1)'
          }
        }
      },
      response: {
        200: {
          description: 'Vector search results',
          type: 'array',
          items: {
            allOf: [
              schemas.noteResponse,
              {
                type: 'object',
                properties: {
                  similarity: {
                    type: 'number',
                    description: 'Cosine similarity score (0-1)'
                  }
                }
              }
            ]
          }
        },
        400: {
          description: 'Bad request - missing search query',
          ...schemas.errorResponse
        },
        500: {
          description: 'Internal server error',
          ...schemas.errorResponse
        }
      }
    },
    handler: async (request, reply) => {
      try {
        const { q: query, limit, threshold } = request.query;
        
        if (!query || query.trim().length === 0) {
          return reply.code(400).send({
            error: 'Search query is required',
            statusCode: 400
          });
        }
        
        const notes = await notesService.vectorSearch(query, { limit, threshold });
        reply.send(notes);
      } catch (error) {
        fastify.log.error(error);
        reply.code(500).send({
          error: error.message,
          statusCode: 500
        });
      }
    }
  });

  fastify.route({
    method: 'PUT',
    url: '/notes/:id',
    schema: {
      tags: ['Notes'],
      summary: 'Update note',
      description: 'Updates an existing note',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { 
            type: 'string',
            pattern: '^[0-9a-fA-F]{24}$',
            description: 'MongoDB ObjectId of the note (24 character hex string)'
          }
        }
      },
      body: {
        type: 'object',
        properties: {
          title: { 
            type: 'string', 
            minLength: 1, 
            maxLength: 200,
            description: 'Updated title'
          },
          body: { 
            type: 'string', 
            minLength: 1,
            description: 'Updated content'
          }
        }
      },
      response: {
        200: {
          description: 'Note updated successfully',
          ...schemas.noteResponse
        },
        404: {
          description: 'Note not found',
          ...schemas.errorResponse
        },
        500: {
          description: 'Internal server error',
          ...schemas.errorResponse
        }
      }
    },
    handler: async (request, reply) => {
      try {
        const note = await notesService.updateNote(request.params.id, request.body);
        
        if (!note) {
          return reply.code(404).send({
            error: 'Note not found',
            statusCode: 404
          });
        }
        
        reply.send(note);
      } catch (error) {
        fastify.log.error(error);
        reply.code(500).send({
          error: error.message,
          statusCode: 500
        });
      }
    }
  });

  fastify.route({
    method: 'DELETE',
    url: '/notes/:id',
    schema: {
      tags: ['Notes'],
      summary: 'Delete note',
      description: 'Deletes an existing note',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { 
            type: 'string',
            pattern: '^[0-9a-fA-F]{24}$',
            description: 'MongoDB ObjectId of the note (24 character hex string)'
          }
        }
      },
      response: {
        200: {
          description: 'Note deleted successfully',
          type: 'object',
          properties: {
            message: { type: 'string' },
            deleted: { type: 'boolean' }
          }
        },
        404: {
          description: 'Note not found',
          ...schemas.errorResponse
        },
        500: {
          description: 'Internal server error',
          ...schemas.errorResponse
        }
      }
    },
    handler: async (request, reply) => {
      try {
        const deleted = await notesService.deleteNote(request.params.id);
        
        if (!deleted) {
          return reply.code(404).send({
            error: 'Note not found',
            statusCode: 404
          });
        }
        
        reply.send({
          message: 'Note deleted successfully',
          deleted: true
        });
      } catch (error) {
        fastify.log.error(error);
        reply.code(500).send({
          error: error.message,
          statusCode: 500
        });
      }
    }
  });
}

module.exports = notesRoutes; 