/// <reference types="vite/client" />

declare const __BUILD_INFO__: {
  buildTime: string;
  commitSha: string | null;
  commitShortSha: string | null;
  branch: string | null;
  vercel: {
    env: string | null;
    url: string | null;
    deploymentId: string | null;
  };
};
