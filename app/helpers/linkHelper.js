const { URL } = require('url');

const platforms = require('../constants/platforms');

const URL_IN_TEXT = /https?:\/\/[^\s<>[\]()]+/gi;

function stripTrailingPunctuation(value) {
  return String(value || '').replace(/[),.;!?…]+$/g, '');
}

function hostnameOf(rawUrl) {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./i, '');
  } catch {
    return '';
  }
}

function detectPlatform(rawUrl) {
  const hostname = hostnameOf(rawUrl);
  if (!hostname) {
    return null;
  }
  return platforms.find((platform) => (
    platform.test.test(hostname) && platform.pathTest.test(rawUrl)
  )) || null;
}

function urlsFromEntities(message) {
  const text = message.text || message.caption || '';
  const entities = message.entities || message.caption_entities || [];
  const urls = [];

  entities.forEach((entity) => {
    if (entity.type === 'url') {
      urls.push(text.slice(entity.offset, entity.offset + entity.length));
    } else if (entity.type === 'text_link' && entity.url) {
      urls.push(entity.url);
    }
  });

  return urls;
}

function urlsFromText(text) {
  return String(text || '').match(URL_IN_TEXT) || [];
}

function findMediaLinks(message, limit = 3) {
  const text = message.text || message.caption || '';
  const rawUrls = [...urlsFromEntities(message), ...urlsFromText(text)];
  const results = [];
  const seen = new Set();

  rawUrls.forEach((rawUrl) => {
    if (results.length >= limit) {
      return;
    }
    const url = stripTrailingPunctuation(rawUrl);
    const platform = detectPlatform(url);
    if (!platform || seen.has(url)) {
      return;
    }
    seen.add(url);
    results.push({
      url,
      platform: platform.id,
      platformLabel: platform.label,
    });
  });

  return results;
}

function isCommandMessage(message) {
  const text = message?.text || '';
  return text.startsWith('/');
}

module.exports = {
  detectPlatform,
  findMediaLinks,
  isCommandMessage,
};
