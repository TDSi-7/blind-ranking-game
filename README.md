# Game Hub

This is a game hub that hosts multiple games for children aged 8-12.

## Deployment on Vercel

This project is configured to deploy on Vercel. Follow these steps:

### 1. Push to GitHub

First, make sure your code is in a GitHub repository:

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-github-repo-url>
git push -u origin main
```

### 2. Connect to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "Add New Project"
3. Import your GitHub repository
4. Vercel will auto-detect the project settings:
   - **Framework Preset**: Other
   - **Build Command**: (leave empty - no build needed)
   - **Output Directory**: (leave empty - root directory)
5. Click "Deploy"

### 3. Automatic Deployments

- Every push to your main branch will trigger a new deployment
- Vercel will provide you with a URL like: `https://your-project.vercel.app`
- You can add a custom domain in the Vercel dashboard

### 4. Project Configuration

The project includes:
- `vercel.json` - Vercel configuration with proper routing and headers
- `package.json` - Project metadata
- `.vercelignore` - Files to exclude from deployment

## Local Development

### Option 1: Using the Python Server (Recommended)

1. Open Terminal
2. Navigate to this folder:
   ```bash
   cd /path/to/blind-ranking-game
   ```
3. Run the server:
   ```bash
   python3 server.py
   ```
   Or simply:
   ```bash
   ./start-server.sh
   ```
4. Open your browser and go to: **http://localhost:8000**

The server will automatically try to open the page in your default browser.

### Option 2: Using Python's Built-in Server

If the script doesn't work, you can use Python's built-in server directly:

```bash
python3 -m http.server 8000
```

Then open **http://localhost:8000** in your browser.

### Option 3: Using Node.js (if installed)

If you have Node.js installed:

```bash
npx http-server -p 8000
```

Then open **http://localhost:8000** in your browser.

## Stopping the Server

Press `Ctrl+C` in the terminal where the server is running.

## Adding New Games

1. Create a new folder for your game (e.g., `/word-puzzle/`)
2. Add your game files (index.html, script.js, style.css)
3. Add a "Back to Home" button in your game that links to `../index.html`
4. Add an entry to `games.json`:

```json
{
  "id": "word-puzzle",
  "name": "Word Puzzle",
  "folder": "word-puzzle",
  "description": "Solve word puzzles!",
  "icon": "🧩",
  "difficultyLevels": ["Easy", "Medium"],
  "ageRange": "8-12",
  "color": "#9C27B0",
  "featured": false
}
```

The home page will automatically display your new game!

## File Structure

```
/blind-ranking-game/
├── index.html          # Home page
├── style.css           # Home page styles
├── home.js             # Home page logic
├── games.json          # Game registry
├── vercel.json         # Vercel deployment configuration
├── package.json        # Project metadata
├── .vercelignore       # Files excluded from Vercel deployment
├── server.py           # Local development server (not deployed)
├── start-server.sh     # Local development script (not deployed)
└── /blind-ranking/     # Example game
    ├── index.html
    ├── script.js
    └── style.css
```

## Requirements

### For Local Development
- Python 3 (usually pre-installed on macOS)
- A modern web browser

### For Vercel Deployment
- GitHub account
- Vercel account (free tier available)
- No build tools needed - pure static site
