# Deployment Requirements

## User Request
Deploy to Vercel and use Docker for portable development across machines.

## TODO After Figma Importer Complete:

### 1. Vercel Deployment
- [ ] Add `vercel.json` configuration
- [ ] Set up environment variables in Vercel dashboard
- [ ] Configure build settings for Next.js
- [ ] Add deployment scripts to package.json
- [ ] Set up preview deployments for branches

### 2. Docker Setup
- [ ] Create `Dockerfile` for development environment
- [ ] Create `docker-compose.yml` for full stack
- [ ] Add `.dockerignore` file
- [ ] Document Docker commands in README
- [ ] Set up volume mounts for hot reloading
- [ ] Add Docker scripts to package.json

### 3. Environment Configuration
- [ ] Create `.env.example` with required variables
- [ ] Document environment setup for both local and Docker
- [ ] Add Figma token to environment variables
- [ ] Set up different configs for dev/staging/prod

### 4. CI/CD (Optional)
- [ ] GitHub Actions for automated testing
- [ ] Automated deployment to Vercel on push to main
- [ ] Docker image builds and registry pushes

## Notes
- Next.js is already Vercel-optimized
- Docker will containerize Node.js, npm, and all dependencies
- Figma token should be stored as environment variable, not in code
