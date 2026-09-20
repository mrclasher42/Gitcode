import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { Layout } from "./components/Layout";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";
import { NewRepo } from "./pages/NewRepo";
import { Repo } from "./pages/Repo";
import { Blob } from "./pages/Blob";
import { UserProfile } from "./pages/UserProfile";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/explore" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/new" element={<NewRepo />} />
            <Route path="/:username" element={<UserProfile />} />
            <Route path="/:owner/:name" element={<Repo />} />
            <Route path="/:owner/:name/blob/:branch/*" element={<Blob />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
