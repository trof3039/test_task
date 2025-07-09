const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  body: {
    type: String,
    required: true,
    trim: true
  },
  embedding: {
    type: [Number],
    default: undefined
  }
}, {
  timestamps: true
});

noteSchema.index({ title: 'text', body: 'text' });
noteSchema.index({ createdAt: -1 });
noteSchema.index({ title: 1, createdAt: -1 });
noteSchema.index({ body: 1, createdAt: -1 });
noteSchema.index({ embedding: 1 });

noteSchema.virtual('fullText').get(function() {
  return `${this.title} ${this.body}`;
});

noteSchema.set('toJSON', { virtuals: true });

const Note = mongoose.model('Note', noteSchema);

module.exports = Note; 