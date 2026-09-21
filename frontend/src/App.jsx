import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ToastProvider } from "./components/Toast";
import { SettingsProvider } from "./contexts/SettingsContext";
import { ConfirmProvider } from "./hooks/useConfirm";
import { Layout } from "./components/Layout";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";
import { NewRepo } from "./pages/NewRepo";
import { Repo } from "./pages/Repo";
import { Contents } from "./pages/Contents";
import { UserProfile } from "./pages/UserProfile";
import { Notifications } from "./pages/Notifications";
import { Forks } from "./pages/Forks";
import { Contributors } from "./pages/Contributors";
import { Branches } from "./pages/Branches";
import { RepoSettings } from "./pages/RepoSettings";
import { RepoSearch } from "./pages/RepoSearch";
import { EditFile } from "./pages/EditFile";
import { NewFile } from "./pages/NewFile";
import { CommitView } from "./pages/CommitView";
import { Commits } from "./pages/Commits";
import { Issues } from "./pages/Issues";
import { IssueView } from "./pages/IssueView";
import { NewIssue } from "./pages/NewIssue";
import { ApiTokens } from "./pages/ApiTokens";
import { Search } from "./pages/Search";
import { Posts } from "./pages/Posts";
import { PostView } from "./pages/PostView";
import { NewPost } from "./pages/NewPost";
import { Releases } from "./pages/Releases";
import { NewRelease } from "./pages/NewRelease";
import { ReleaseView } from "./pages/ReleaseView";

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
          <SettingsProvider>
          <ConfirmProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/new" element={<NewRepo />} />
            <Route path="/notifications" element={<Notifications />} />
              <Route path="/search" element={<Search />} />
              <Route path="/posts" element={<Posts />} />
              <Route path="/posts/new" element={<NewPost />} />
              <Route path="/posts/:slug" element={<PostView />} />
            <Route path="/settings/tokens" element={<ApiTokens />} />
            <Route path="/settings" element={<Navigate to="/settings/tokens" replace />} />
            <Route path="/:username" element={<UserProfile />} />
            <Route path="/:owner/:name" element={<Repo />} />
            <Route path="/:owner/:name/settings" element={<RepoSettings />} />
            <Route path="/:owner/:name/search" element={<RepoSearch />} />
            <Route path="/:owner/:name/forks" element={<Forks />} />
            <Route path="/:owner/:name/contributors" element={<Contributors />} />
            <Route path="/:owner/:name/branches" element={<Branches />} />
              <Route path="/:owner/:name/releases" element={<Releases />} />
              <Route path="/:owner/:name/releases/new" element={<NewRelease />} />
              <Route path="/:owner/:name/releases/:releaseId" element={<ReleaseView />} />
            <Route path="/:owner/:name/new-file" element={<NewFile />} />
            <Route path="/:owner/:name/edit/:branch/*" element={<EditFile />} />
            <Route path="/:owner/:name/commits" element={<Commits />} />
            <Route path="/:owner/:name/issues" element={<Issues />} />
            <Route path="/:owner/:name/issues/new" element={<NewIssue />} />
            <Route path="/:owner/:name/issues/:number" element={<IssueView />} />
            <Route path="/:owner/:name/commit/:sha" element={<CommitView />} />
            <Route path="/:owner/:name/blob/:branch/*" element={<Contents />} />
            <Route path="/:owner/:name/tree/:branch/*" element={<Contents />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfirmProvider>
        </SettingsProvider>
        </AuthProvider>
    </ToastProvider>
  );
}
