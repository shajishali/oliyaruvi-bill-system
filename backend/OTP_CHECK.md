# OTP Setup Checklist

## 1. Create `.env` in backend folder

Create `backend/.env` with:

```
RESEND_API_KEY=re_your_actual_key_here
RESET_EMAIL=oliyaruviprinters@gmail.com
```

## 2. Restart the backend

After adding the API key, **restart** the backend:

```powershell
cd backend
npm start
```

## 3. Ensure both servers are running

- **Backend**: `http://localhost:5000` (run `npm start` in backend folder)
- **Frontend**: `http://localhost:3000` (run `npm run dev` in frontend folder)

## 4. Test the OTP flow

1. Go to Settings → Forgot password?
2. Enter: oliyaruviprinters@gmail.com
3. Click **Send OTP**
4. Check your email inbox (and spam folder)

## If you see "Not found"

- Restart the backend server
- Ensure the backend is running on port 5000
- Check the backend terminal for any errors
