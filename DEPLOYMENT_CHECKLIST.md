# Deployment Checklist for Render.com

## ✅ Pre-Deployment Checklist

- [ ] Code is committed and pushed to GitHub
- [ ] MongoDB Atlas is configured and accessible
- [ ] All environment variables are identified
- [ ] Demo accounts are working locally
- [ ] Application builds successfully (`npm run build`)

## 🚀 Deployment Steps

### Backend Service
- [ ] Create new Web Service on Render
- [ ] Connect GitHub repository
- [ ] Set service name: `lcc360-whiteboard-backend`
- [ ] Set build command: `npm install`
- [ ] Set start command: `node server/index.js`
- [ ] Configure environment variables:
  - [ ] `NODE_ENV=production`
  - [ ] `PORT=10000`
  - [ ] `MONGODB_URI=mongodb+srv://...`
  - [ ] `JWT_SECRET=your_secret_key`
  - [ ] `CLIENT_URL=https://frontend-url.onrender.com`
- [ ] Deploy and verify health check: `/api/health`

### Frontend Service
- [ ] Create new Static Site on Render
- [ ] Connect same GitHub repository
- [ ] Set service name: `lcc360-whiteboard-frontend`
- [ ] Set build command: `npm install && npm run build`
- [ ] Set publish directory: `build`
- [ ] Configure environment variables:
  - [ ] `REACT_APP_API_URL=https://backend-url.onrender.com/api`
- [ ] Deploy and verify frontend loads

## 🧪 Post-Deployment Testing

- [ ] Frontend loads without errors
- [ ] Backend health check responds
- [ ] Demo login works (admin@lcc360.com/admin123)
- [ ] Dashboard loads for each role
- [ ] Session creation works
- [ ] Session joining via share link works
- [ ] Whiteboard collaboration functions
- [ ] Socket.IO connection established
- [ ] Database operations work (if connected)

## 🔧 Troubleshooting

### Common Issues
- [ ] CORS errors → Check CLIENT_URL matches frontend URL exactly
- [ ] Build failures → Check Node.js version and dependencies
- [ ] Database connection → Verify MongoDB Atlas network access
- [ ] Socket.IO issues → Check WebSocket support and CORS
- [ ] Authentication errors → Verify JWT_SECRET is set

### Verification URLs
- Backend Health: `https://your-backend.onrender.com/api/health`
- Frontend: `https://your-frontend.onrender.com`
- Login Test: Use demo accounts to verify functionality

## 📝 Notes

- Free tier services sleep after 15 minutes of inactivity
- Cold start time can be 30-60 seconds
- Monitor logs in Render dashboard for issues
- Update environment variables if URLs change 