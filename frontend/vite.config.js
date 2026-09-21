import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(() => {
  const certsDir = path.resolve(__dirname, "..", "certs");
  const hasCerts =
    fs.existsSync(path.join(certsDir, "cert.pem")) &&
    fs.existsSync(path.join(certsDir, "key.pem"));

  return {
    plugins: [react()],
    server: {
      host: "0.0.0.0",
      port: 5175,
      https: hasCerts
        ? {
            cert: fs.readFileSync(path.join(certsDir, "cert.pem")),
            key: fs.readFileSync(path.join(certsDir, "key.pem")),
          }
        : false,
      proxy: {
        "/api": {
          target: hasCerts ? "https://localhost:8080" : "http://localhost:8080",
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
