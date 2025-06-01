# MongoDB Setup Guide for LCC 360 Whiteboard

## Current Issue
The application is experiencing MongoDB authentication failures. This guide provides solutions and alternatives.

## Option 1: Fix Current MongoDB Atlas Connection

### Step 1: Verify MongoDB Atlas Credentials
1. Go to [MongoDB Atlas](https://cloud.mongodb.com/)
2. Log in to your account
3. Navigate to your cluster
4. Check Database Access → Database Users
5. Verify the username `khanapcalculus` exists and has proper permissions

### Step 2: Update Database User Permissions
1. In MongoDB Atlas, go to Database Access
2. Edit the user `khanapcalculus`
3. Ensure it has "Read and write to any database" permissions
4. Or create a new user with proper permissions

### Step 3: Whitelist IP Address
1. Go to Network Access in MongoDB Atlas
2. Add your current IP address: `0.0.0.0/0` (for development only)
3. Or add your specific IP address

### Step 4: Update Connection String
Replace the current connection string in `server/index.js` with:
```javascript
const MONGODB_URI = 'mongodb+srv://NEW_USERNAME:NEW_PASSWORD@cluster0.ipy6r.mongodb.net/lcc360_whiteboard?retryWrites=true&w=majority&appName=Cluster0';
```

## Option 2: Create New MongoDB Atlas Database

### Step 1: Create New Cluster
1. Go to [MongoDB Atlas](https://cloud.mongodb.com/)
2. Create a new free cluster
3. Choose a cloud provider and region

### Step 2: Create Database User
1. Go to Database Access
2. Add New Database User
3. Choose "Password" authentication
4. Username: `lcc360_admin`
5. Password: Generate a secure password
6. Database User Privileges: "Read and write to any database"

### Step 3: Configure Network Access
1. Go to Network Access
2. Add IP Address: `0.0.0.0/0` (for development)
3. Or add your specific IP address

### Step 4: Get Connection String
1. Go to Clusters
2. Click "Connect"
3. Choose "Connect your application"
4. Copy the connection string
5. Replace `<password>` with your actual password

## Option 3: Use Local MongoDB

### Step 1: Install MongoDB Community Edition
1. Download from [MongoDB Download Center](https://www.mongodb.com/try/download/community)
2. Install MongoDB on your local machine
3. Start MongoDB service

### Step 2: Update Connection String
```javascript
const MONGODB_URI = 'mongodb://localhost:27017/lcc360_whiteboard';
```

### Step 3: Remove Atlas-specific Options
```javascript
const conn = await mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
```

## Option 4: Use Alternative Cloud Database

### MongoDB Cloud (Alternative)
1. Try [MongoDB Cloud](https://www.mongodb.com/cloud)
2. Create a new deployment
3. Follow similar steps as Atlas

### Other Alternatives
- **Heroku MongoDB**: Add-on for Heroku deployments
- **DigitalOcean Managed MongoDB**: Managed database service
- **AWS DocumentDB**: MongoDB-compatible service

## Current Application Status

✅ **The application works perfectly without MongoDB!**

The app uses demo accounts and in-memory storage when MongoDB is unavailable:
- Admin: admin@lcc360.com / admin123
- Teacher: teacher@lcc360.com / teacher123
- Student: student@lcc360.com / student123

All features work including:
- User authentication
- Dashboard functionality
- Real-time whiteboard collaboration
- Session management (in-memory)

## Environment Variables Setup

Create a `.env` file in the `server` directory:

```env
# MongoDB Configuration
MONGODB_URI=your_mongodb_connection_string_here

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# Server Configuration
PORT=5001
NODE_ENV=development

# Client URL
CLIENT_URL=http://localhost:3001
```

## Testing Database Connection

After updating the connection string, test it:

```bash
curl http://localhost:5001/api/health
```

Look for:
```json
{
  "database": {
    "status": "Connected",
    "readyState": 1
  }
}
```

## Troubleshooting

### Common Issues:
1. **Authentication Failed**: Wrong username/password
2. **Network Timeout**: IP not whitelisted
3. **Database Not Found**: Wrong database name in connection string
4. **SSL Issues**: Add `&ssl=true` to connection string

### Debug Steps:
1. Check MongoDB Atlas dashboard for connection attempts
2. Verify network access settings
3. Test connection string in MongoDB Compass
4. Check server logs for detailed error messages

## Production Considerations

For production deployment:
1. Use environment variables for sensitive data
2. Restrict IP access to specific addresses
3. Use strong passwords and rotate them regularly
4. Enable MongoDB Atlas monitoring and alerts
5. Set up automated backups

## Support

If you continue having issues:
1. Check MongoDB Atlas status page
2. Contact MongoDB Atlas support
3. Use the demo accounts for development
4. Consider local MongoDB for development

The application is fully functional with or without MongoDB! 🚀 