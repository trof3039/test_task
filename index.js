const fastifyPlugin = require('fastify-plugin');
const mongoose = require('mongoose');
const path = require('path');

const notesRoutes = require('./src/routes/notes');

async function modNotesPlugin(fastify, options) {
  const defaultOptions = {
    mongoUrl: process.env.MONGODB_URL || 'mongodb://localhost:27017/mod-notes',
    prefix: '/api/v1',
    swagger: {
      routePrefix: '/documentation',
      exposeRoute: true,
      swagger: {
        info: {
          title: 'mod-notes API',
          description: 'A modular Fastify plugin for notes management with MongoDB and vector search',
          version: '1.0.0',
          contact: {
            name: 'API Support',
            email: 'support@example.com'
          }
        },
        externalDocs: {
          url: 'https://swagger.io',
          description: 'Find more info here'
        },
        host: 'localhost',
        schemes: ['http', 'https'],
        consumes: ['application/json'],
        produces: ['application/json'],
        tags: [
          { 
            name: 'Notes', 
            description: 'Notes management endpoints' 
          },
          { 
            name: 'AI', 
            description: 'AI-powered features like vector search' 
          }
        ]
      },
      uiConfig: {
        docExpansion: 'full',
        deepLinking: false
      }
    }
  };

  const config = { ...defaultOptions, ...options };

  try {
    await fastify.register(require('@fastify/rate-limit'), {
      max: 100,
      timeWindow: '1 minute',
      allowList: ['127.0.0.1'],
      errorResponseBuilder: function (request, context) {
        return {
          code: 429,
          error: 'Too Many Requests',
          message: `Rate limit exceeded, retry in ${context.after}`,
          statusCode: 429
        }
      }
    });
  } catch (error) {
    fastify.log.warn('Rate limiting not available:', error.message);
  }

  try {
    await fastify.register(require('@fastify/cors'), {
      origin: true,
      credentials: true
    });
  } catch (error) {
    fastify.log.warn('CORS not available:', error.message);
  }

  await fastify.register(require('@fastify/swagger'), config.swagger);
  await fastify.register(require('@fastify/swagger-ui'), {
    routePrefix: config.swagger.routePrefix,
    uiConfig: config.swagger.uiConfig
  });

  let isConnected = false;
  
  const connectToMongoDB = async () => {
    try {
      if (!isConnected) {
        await mongoose.connect(config.mongoUrl, {
          useNewUrlParser: true,
          useUnifiedTopology: true,
        });
        isConnected = true;
        fastify.log.info(`Connected to MongoDB: ${config.mongoUrl}`);
      }
    } catch (error) {
      fastify.log.error('MongoDB connection error:', error);
      throw error;
    }
  };

  await connectToMongoDB();

  fastify.addHook('onClose', async (instance, done) => {
    try {
      if (isConnected) {
        await mongoose.connection.close();
        isConnected = false;
        fastify.log.info('MongoDB connection closed');
      }
      done();
    } catch (error) {
      fastify.log.error('Error closing MongoDB connection:', error);
      done(error);
    }
  });

  fastify.get('/health', async (request, reply) => {
    try {
      const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
      
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: {
          status: dbStatus,
          name: mongoose.connection.name
        },
        version: require('./package.json').version
      };
    } catch (error) {
      reply.code(500).send({
        status: 'error',
        message: error.message
      });
    }
  });

  await fastify.register(notesRoutes, { prefix: config.prefix });

  fastify.setErrorHandler(async (error, request, reply) => {
    fastify.log.error(error);
    
    if (error.validation) {
      return reply.code(400).send({
        error: 'Validation Error',
        details: error.message,
        statusCode: 400
      });
    }
    
    if (error.name === 'ValidationError') {
      return reply.code(400).send({
        error: 'Validation Error',
        details: error.message,
        statusCode: 400
      });
    }
    
    if (error.code === 11000) {
      return reply.code(409).send({
        error: 'Duplicate Key Error',
        details: 'Resource already exists',
        statusCode: 409
      });
    }
    
    reply.code(error.statusCode || 500).send({
      error: error.message || 'Internal Server Error',
      statusCode: error.statusCode || 500
    });
  });

  fastify.addHook('preHandler', async (request, reply) => {
    fastify.log.info({
      method: request.method,
      url: request.url,
      ip: request.ip,
      userAgent: request.headers['user-agent']
    }, 'Incoming request');
  });

  fastify.log.info('mod-notes plugin registered successfully');
}

module.exports = fastifyPlugin(modNotesPlugin, {
  fastify: '>=4.0.0',
  name: 'mod-notes'
}); 