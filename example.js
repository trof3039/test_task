const fastify = require('fastify')({ 
  logger: true 
});

// Load environment variables
require('dotenv').config();

async function start() {
  try {
    // Register the mod-notes plugin
    await fastify.register(require('./index.js'), {
      // Optional configuration
      mongoUrl: process.env.MONGODB_URL || 'mongodb://localhost:27017/mod-notes-example',
      prefix: '/api/v1'
    });

    // Start the server
    const PORT = process.env.PORT || 3000;
    const HOST = process.env.HOST || '0.0.0.0';
    
    await fastify.listen({ port: PORT, host: HOST });
    
    console.log(`
🚀 Server is running!
📝 API: http://localhost:${PORT}/api/v1/notes
📚 Swagger docs: http://localhost:${PORT}/documentation
💚 Health check: http://localhost:${PORT}/health

Available endpoints:
- POST   /api/v1/notes              Create a note
- GET    /api/v1/notes              Get all notes
- GET    /api/v1/notes/:id          Get note by ID
- GET    /api/v1/notes/search?q=    Search notes
- GET    /api/v1/notes/vector-search?q=  Vector search (bonus)
- PUT    /api/v1/notes/:id          Update note
- DELETE /api/v1/notes/:id          Delete note
    `);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

// Handle graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`\nReceived ${signal}, shutting down gracefully...`);
  try {
    await fastify.close();
    console.log('Server closed successfully');
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

start(); 