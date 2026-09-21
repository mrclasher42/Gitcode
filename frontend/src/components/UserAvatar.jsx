import { avatarUrl, avatarColor } from "../lib/avatar";

export function UserAvatar({ user, size = 32, name }) {
  const url = avatarUrl(user);
  const displayName = name || (user && user.username) || "?";

  if (url) {
    return (
      <img
        src={url}
        alt={displayName}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
        onError={(e) => {
          // fallback to initial if image fails
          e.target.style.display = "none";
        }}
      />
    );
  }

  const initial = displayName[0]?.toUpperCase() || "?";
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{
        width: size,
        height: size,
        background: avatarColor(displayName),
        fontSize: size * 0.4,
      }}
    >
      {initial}
    </div>
  );
}
