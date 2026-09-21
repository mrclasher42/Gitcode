const BASE = "/api";

async function req(method, path, body) {
  const opts = {
    method,
    credentials: "include",
    headers: {},
  };
  if (body !== undefined) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(BASE + path, opts);
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* ignore */ }
  if (!res.ok) {
    const err = new Error((data && data.error) || ("HTTP " + res.status));
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  // auth
  me:          () => req("GET",    "/auth/me"),
  login:       (u, p) => req("POST", "/auth/login", { username: u, password: p }),
  signup:      (u, e, p) => req("POST", "/auth/signup", { username: u, email: e, password: p }),
  logout:      () => req("POST",   "/auth/logout"),

  // users
  user:        (u) => req("GET",   "/users/" + encodeURIComponent(u)),

  // repos
  listRepos:   () => req("GET",    "/repos"),
  listMyRepos: () => req("GET",    "/repos/mine"),
  getRepo:     (u, r) => req("GET", "/repos/" + u + "/" + r),
  createRepo:  (name, description, priv) =>
                 req("POST", "/repos", { name, description, private: priv }),
  deleteRepo:  (u, r) => req("DELETE", "/repos/" + u + "/" + r),
  updateRepo:  (u, r, data) => req("PATCH", "/repos/" + u + "/" + r, data),

  // repo content
  getTree:     (u, r, branch, path) =>
                 req("GET", `/repos/${u}/${r}/tree?branch=${encodeURIComponent(branch)}&path=${encodeURIComponent(path || "")}`),
  getBlob:     (u, r, branch, path) =>
                 req("GET", `/repos/${u}/${r}/blob?branch=${encodeURIComponent(branch)}&path=${encodeURIComponent(path)}`),
  getCommits:  (u, r, branch) =>
                 req("GET", `/repos/${u}/${r}/commits?branch=${encodeURIComponent(branch)}`),
  forkRepo:    (u, r) => req("POST", `/repos/${u}/${r}/fork`),
  getSocial:   (u, r) => req("GET",  `/repos/${u}/${r}/social`),
  toggleStar:  (u, r) => req("POST", `/repos/${u}/${r}/star`),
  toggleWatch: (u, r) => req("POST", `/repos/${u}/${r}/watch`),
  followUser:   (u) => req("POST", `/users/${u}/follow`),
  unfollowUser: (u) => req("DELETE", `/users/${u}/follow`),
  updateProfile: (data) => req("POST", "/users/me/profile", data),
  listNotifications: () => req("GET", "/notifications"),
  markRead: () => req("POST", "/notifications/read"),
  getBranches: (u, r) =>
                 req("GET", `/repos/${u}/${r}/branches`),
};
