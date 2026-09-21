// Build a cache-busted avatar URL
export function avatarUrl(user) {
  if (!user || !user.avatar) return null;
  return `/api/users/${user.username}/avatar?v=${encodeURIComponent(user.avatar)}`;
}

// Fallback initial + color
export function avatarColor(name) {
  const colors = ["#0969da","#1a7f37","#bf3989","#8250df","#cf222e","#bc4c00","#0d9488","#6e40c9"];
  let h = 0;
  for (let i = 0; i < (name || "").length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return colors[Math.abs(h) % colors.length];
}
