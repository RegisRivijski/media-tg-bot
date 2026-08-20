const crypto = require('crypto');

const config = require('../../config/default');

const sessions = new Map();
const inflightChats = new Set();

function createSession(data) {
  const id = crypto.randomBytes(4).toString('hex');
  sessions.set(id, {
    ...data,
    createdAt: Date.now(),
  });
  return id;
}

function getSession(id) {
  const session = sessions.get(id);
  if (!session) {
    return null;
  }
  if (Date.now() - session.createdAt > config.download.sessionTtlMs) {
    sessions.delete(id);
    return null;
  }
  return session;
}

function updateSession(id, patch) {
  const session = getSession(id);
  if (!session) {
    return null;
  }
  const next = { ...session, ...patch };
  sessions.set(id, next);
  return next;
}

function removeSession(id) {
  sessions.delete(id);
}

function isChatBusy(chatId) {
  return inflightChats.has(String(chatId));
}

function markChatBusy(chatId) {
  inflightChats.add(String(chatId));
}

function markChatFree(chatId) {
  inflightChats.delete(String(chatId));
}

module.exports = {
  createSession,
  getSession,
  updateSession,
  removeSession,
  isChatBusy,
  markChatBusy,
  markChatFree,
};
