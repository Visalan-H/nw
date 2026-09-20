/** Baseline .gitignore. Deliberately short — it only has to stop the usual junk. */
export const GITIGNORE = `node_modules/
.env
.env.*
dist/
build/
*.log
.DS_Store

# big binaries — these are what bloat a repo
*.exe
*.dll
*.zip
*.iso
`;
