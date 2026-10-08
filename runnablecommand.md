# Running the Billing System

From the project root (`D:\projects\Oliyaruvi_billing_system`), install dependencies once:

```powershell
npm install
cd frontend
npm install
cd ..\backend
npm install
cd ..
```

Start the backend, frontend, and Electron app together:

```powershell
npm run dev
```

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:5000`

Start only the backend:

```powershell
cd backend
npm start
```

Start only the frontend:

```powershell
cd frontend
npm run dev
```

Reset the local database, then start the backend again:

```powershell
cd backend
npm run reset-db
npm start
```

Build the Windows installer from the project root:

```powershell
npm.cmd run dist
```

The installer is written to `release\`.

Run tests:

```powershell
npm test
```