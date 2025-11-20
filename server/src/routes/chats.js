const express = require('express');
const authMiddleware = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const chatService = require('../services/chatService');

const router = express.Router();

router.use(authMiddleware);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const chats = await chatService.getUserChats({ userId: req.user.id });
    res.json({ chats });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { otherUserId } = req.body || {};
    const chat = await chatService.getOrCreateDirectChat({
      userId: req.user.id,
      otherUserId,
    });
    res.status(201).json({ chat });
  })
);

module.exports = router;
