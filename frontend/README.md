# Frontend

The frontend for the AI Lead Generation MVP is a React application built with Vite. It provides the web interface for managing leads, campaigns, emails, opportunities, calls, and related lead-generation workflows.

## Tech Stack

- **React 19** - UI library
- **Vite 8** - Development server and build tool
- **React Router** - Client-side routing
- **Tailwind CSS** - Styling
- **Axios** - API requests
- **Framer Motion** - Animations
- **Recharts** - Charts and data visualization
- **ESLint** - Code linting
- **Vercel** - Deployment

## Getting Started

### Prerequisites

Make sure you have:

- Node.js installed
- npm installed
- The backend API running locally

### Installation

From the `frontend/` directory:

```bash
npm install
```

### Environment Variables

Create a .env file from .env.example.

On Windows PowerShell:

    Copy-Item .env.example .env

Configure:

    VITE_API_BASE_URL=http://localhost:8000/api
    VITE_FRONTEND_PORT=5173

VITE_API_BASE_URL must include /api.

## Run the Development Server

    npm run dev

The frontend will start using the configured development port.

## Available Scripts

| Command | Description |
| --- | --- |
| npm run dev | Start the Vite development server |
| npm run build | Create a production build |
| npm run lint | Run ESLint |
| npm run preview | Preview the production build |
| npm test | Run the frontend tests |

## Project Structure

    src/
    ├── api/          API integrations
    ├── assets/       Images and other static assets
    ├── components/   Reusable React components
    │   └── ui/       Shared UI components
    ├── motion/       Animation utilities
    ├── pages/        Application pages
    ├── services/     Shared services
    ├── theme/        Theme utilities
    ├── utils/        Utility functions and tests
    ├── App.jsx       Main application component
    ├── App.css       Application styles
    ├── index.css     Global styles
    └── main.jsx      Application entry point

## Development Conventions

- Keep reusable components in src/components/.
- Keep page-level components in src/pages/.
- Keep API integrations in src/api/.
- Keep shared services in src/services/.
- Put utility functions in src/utils/.
- Keep theme logic in src/theme/.
- Follow the existing project structure when adding functionality.
- Run `npm run lint` before submitting changes.
- Run `npm test` when changing tested functionality.

## Production Build

Run `npm run build` to create the production build in the `dist/` directory.

Run `npm run preview` to preview the production build locally.

## Vercel Deployment

The frontend is configured for Vercel deployment. The vercel.json file rewrites routes to index.html so React Router routes work correctly.

When deploying, use frontend/ as the application root and configure VITE_API_BASE_URL with the deployed backend URL including /api.

## API Configuration

The frontend uses VITE_API_BASE_URL to communicate with the backend API. Make sure the backend is running and accessible at the configured URL.
