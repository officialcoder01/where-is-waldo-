# Deployment Notes

## Recommended setup

Use two Vercel projects:

1. Frontend project
   - Root directory: `frontend`
   - Serves the static HTML, CSS, JS, and image assets
2. Backend project
   - Root directory: `backend`
   - Runs the Express API with Prisma

This repo now expects production API calls to go through `/api` on the frontend origin.

## Frontend Vercel rewrite

In the frontend Vercel project, add a rewrite so `/api/:path*` proxies to the backend deployment:

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://YOUR-BACKEND-PROJECT.vercel.app/:path*"
    }
  ]
}
```

You can add this in the Vercel dashboard or in `frontend/vercel.json` after you know the backend URL.

## Backend environment variables

Set these in the backend Vercel project:

```env
DATABASE_URL=your_postgres_connection_string
SECRET=your_session_secret
NODE_ENV=production
FRONTEND_ORIGIN=https://YOUR-FRONTEND-PROJECT.vercel.app
```

## Prisma

Make sure the backend deployment runs Prisma against production:

1. Generate the client during build
2. Run `prisma migrate deploy` against the production database

If you use a hosted Postgres provider such as Neon, Supabase, or Vercel Postgres, point `DATABASE_URL` there.

## Why this setup

- Vercel serves the frontend well as a static site
- The backend can run on Vercel without Render free-tier sleep
- The frontend rewrite keeps browser requests same-origin, which avoids cookie and CORS headaches
