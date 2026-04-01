<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# DevNotes - Local and Cloud Notes

This project is a developer notes app with:
- Local autosave (offline-first)
- Manual cloud sync to MongoDB Atlas

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
2. Create `.env.local` and set:
   - `MONGODB_URI` (MongoDB Atlas connection string)
   - `MONGODB_DB` (example: `devnotes`)
3. Run API + web app:
   `npm run dev`

## Environment Example

```env
MONGODB_URI="mongodb+srv://<USER>:<PASSWORD>@<CLUSTER>.mongodb.net/?retryWrites=true&w=majority"
MONGODB_DB="devnotes"
```

If your password has special characters (`@`, `#`, `:`...), URL-encode it first.


