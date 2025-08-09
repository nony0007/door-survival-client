
# Door Survival — Client

Static site for GitHub Pages that connects to the server.

## Configure server URL
Edit `client/config.js` and set:
```js
const SERVER_URL = "https://your-render-app.onrender.com";
```

## Deploy to GitHub Pages
1) Create a repo and upload the **contents of `client/`** (files directly in root).
2) In **Settings → Pages**:
   - Source: **Deploy from a branch**
   - Branch: **main**, Folder: **/(root)**
3) Open the Pages URL. Share it with your family.
