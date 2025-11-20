const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    participantsKey: {
      type: String,
      required: true,
      unique: true,
    },
    lastMessage: {
      text: { type: String, default: null },
      sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      createdAt: { type: Date, default: null },
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    versionKey: false,
  }
);

chatSchema.index({ participantsKey: 1 }, { unique: true });

module.exports = mongoose.model('Chat', chatSchema);
