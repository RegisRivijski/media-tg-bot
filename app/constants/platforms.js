module.exports = [
  {
    id: 'youtube',
    label: 'YouTube',
    test: /(?:^|\.)(?:youtube\.com|youtu\.be)$/i,
    pathTest: /\/(?:watch|shorts|live|embed)|youtu\.be\//i,
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    test: /(?:^|\.)tiktok\.com$/i,
    pathTest: /\/video\/|\/t\/|^(?:https?:\/\/)?(?:vm|vt)\.tiktok\.com\//i,
  },
  {
    id: 'instagram',
    label: 'Instagram',
    test: /(?:^|\.)(?:instagram\.com|instagr\.am)$/i,
    pathTest: /\/(?:p|reel|reels|tv)\//i,
  },
];
