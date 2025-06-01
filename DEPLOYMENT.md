# Deployment Guide for LCC360 Whiteboard on Render.com

## Prerequisites

1. **GitHub Repository**: Ensure your code is pushed to GitHub
2. **Render.com Account**: Sign up at [render.com](https://render.com)
3. **MongoDB Atlas**: Your database should be accessible from anywhere (0.0.0.0/0) or Render's IP ranges

## Deployment Steps

### Step 1: Prepare Your Repository

1. **Push all changes to GitHub**:
   ```bash
   git add .
   git commit -m "Prepare for Render.com deployment"
   git push origin main
   ```

### Step 2: Deploy Backend Service

1. **Go to Render Dashboard** and click "New +"
2. **Select "Web Service"**
3. **Connect your GitHub repository**
4. **Configure the backend service**:
   - **Name**: `lcc360-whiteboard-backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server/index.js`
   - **Plan**: `Free`

5. **Set Environment Variables**:
   ```
   NODE_ENV=production
   PORT=10000
   MONGODB_URI=mongodb+srv://khanapcalculus:Thazhath12@cluster0.ipy6r.mongodb.net/lcc360_whiteboard?retryWrites=true&w=majority&appName=Cluster0&authSource=admin
   JWT_SECRET=your_super_secret_jwt_key_here_make_it_long_and_random_at_least_32_characters
   CLIENT_URL=https://lcc360-whiteboard-frontend.onrender.com
   ```

6. **Deploy the service**

### Step 3: Deploy Frontend Service

1. **Create another service** - Select "Static Site"
2. **Connect the same GitHub repository**
3. **Configure the frontend service**:
   - **Name**: `lcc360-whiteboard-frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `build`

4. **Set Environment Variables**:
   ```
   REACT_APP_API_URL=https://lcc360-whiteboard-backend.onrender.com/api
   ```

5. **Deploy the service**

### Step 4: Update CORS Configuration

After both services are deployed, you'll have URLs like:
- Backend: `https://lcc360-whiteboard-backend.onrender.com`
- Frontend: `https://lcc360-whiteboard-frontend.onrender.com`

Update the backend's `CLIENT_URL` environment variable with the actual frontend URL.

### Step 5: Test the Deployment

1. **Visit your frontend URL**
2. **Test login with demo accounts**:
   - Admin: `admin@lcc360.com` / `admin123`
   - Teacher: `teacher@lcc360.com` / `teacher123`
   - Student: `student@lcc360.com` / `student123`

3. **Test session creation and joining**
4. **Test whiteboard functionality**

## Environment Variables Reference

### Backend Environment Variables
```
NODE_ENV=production
PORT=10000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
CLIENT_URL=https://your-frontend-url.onrender.com
```

### Frontend Environment Variables
```
REACT_APP_API_URL=https://your-backend-url.onrender.com/api
```

## Troubleshooting

### Common Issues

1. **CORS Errors**:
   - Ensure `CLIENT_URL` is set correctly in backend
   - Check that frontend URL matches exactly

2. **Database Connection Issues**:
   - Verify MongoDB Atlas allows connections from anywhere (0.0.0.0/0)
   - Check connection string format
   - Ensure user has proper permissions

3. **Build Failures**:
   - Check Node.js version compatibility
   - Ensure all dependencies are in package.json
   - Review build logs for specific errors

4. **Socket.IO Connection Issues**:
   - Verify WebSocket support is enabled
   - Check CORS configuration includes Socket.IO origins

### Health Check

Visit `https://your-backend-url.onrender.com/api/health` to check:
- Server status
- Database connection
- System information

## Performance Considerations

### Free Tier Limitations
- Services sleep after 15 minutes of inactivity
- Cold start time: 30-60 seconds
- 750 hours/month limit

### Optimization Tips
1. **Keep services active** with uptime monitoring
2. **Optimize bundle size** for faster cold starts
3. **Use efficient database queries**
4. **Implement proper error handling**

## Security Checklist

- [ ] Strong JWT secret (32+ characters)
- [ ] MongoDB connection string secured
- [ ] CORS properly configured
- [ ] Environment variables not exposed in frontend
- [ ] Database user has minimal required permissions

## Monitoring

1. **Render Dashboard**: Monitor service health and logs
2. **MongoDB Atlas**: Monitor database performance
3. **Application Logs**: Check for errors and performance issues

## Scaling

For production use, consider:
- Upgrading to paid Render plans
- Using Redis for session storage
- Implementing database connection pooling
- Adding CDN for static assets
- Setting up monitoring and alerting

## Support

If you encounter issues:
1. Check Render service logs
2. Review MongoDB Atlas logs
3. Test locally with production environment variables
4. Contact Render support for platform-specific issues 