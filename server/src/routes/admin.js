const express = require('express');
const authMiddleware = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const chatService = require('../services/chatService');

const router = express.Router();

router.use(authMiddleware);

router.use((req, res, next) => {
  if (req.user.role !== 'admin') {
    const err = new Error('Требуются права администратора');
    err.status = 403;
    return next(err);
  }
  return next();
});

router.get(
  '/chats/direct',
  asyncHandler(async (req, res) => {
    const chats = await chatService.listDirectChatsForAdmin();
    res.json({ chats });
  })
);

router.delete(
  '/chats/:id/blocks',
  asyncHandler(async (req, res) => {
    const chat = await chatService.clearBlocksForChat({ chatId: req.params.id });
    res.json({ chat });
  })
);

module.exports = router;
