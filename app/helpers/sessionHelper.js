const crypto = require('crypto');

const { MAX_CONCURRENT_DOWNLOADS, SESSION_TTL_MS } = require('../constants/download');

const sessions = new Map();
const inflightChats = new Set();
let activeDownloads = 0;

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
  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
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

function tryAcquireDownloadSlot() {
  if (activeDownloads >= MAX_CONCURRENT_DOWNLOADS) {
    return false;
  }
  activeDownloads += 1;
  return true;
}

function releaseDownloadSlot() {
  activeDownloads = Math.max(0, activeDownloads - 1);
}

module.exports = {
  createSession,
  getSession,
  updateSession,
  removeSession,
  isChatBusy,
  markChatBusy,
  markChatFree,
  tryAcquireDownloadSlot,
  releaseDownloadSlot,
};
