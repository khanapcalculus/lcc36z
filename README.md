# LCC360 Collaborative Whiteboard

A comprehensive real-time collaborative whiteboard application with user management, session scheduling, and multi-role dashboard system built with React, Node.js, MongoDB, and Socket.IO.

## 🚀 Features

### Core Whiteboard Features
- ✨ **Real-time collaboration** with Socket.IO
- 🎨 **Multiple drawing tools** (pen, eraser, shapes, text)
- 📱 **Mobile and tablet friendly** interface
- 🔄 **Multi-page support** with navigation
- ↩️ **Undo/Redo functionality**
- 🖼️ **Image upload and manipulation**
- 🔧 **Transform tools** for resizing and rotating
- 🎯 **Session-specific whiteboards**

### User Management System
- 👥 **Multi-role authentication** (Admin, Teacher, Student)
- 🔐 **Secure JWT-based authentication**
- 📊 **Role-based dashboards** with specific features
- 👤 **User profile management**
- 🎓 **Grade and subject assignment**

### Session Management
- 📅 **Advanced session scheduling** with timezone support
- 🔗 **Share links** for easy session access
- 👨‍🏫 **Teacher-led sessions** with student assignments
- 📧 **Email invitations** with pre-filled templates
- 📊 **Session analytics** and participation tracking
- 🔒 **Public/private sessions** with password protection

### Dashboard Features
- **Admin Dashboard**: User management, system overview, session oversight
- **Teacher Dashboard**: Session creation, student management, teaching analytics
- **Student Dashboard**: Assigned sessions, join functionality, progress tracking

## 🛠️ Technology Stack

- **Frontend**: React 18, React Router, Konva, Socket.IO Client
- **Backend**: Node.js, Express, Socket.IO, JWT
- **Database**: MongoDB Atlas with Mongoose
- **Authentication**: JWT with bcrypt password hashing
- **Real-time**: WebSocket communication
- **Deployment**: Render.com (Frontend + Backend)

## 🏃‍♂️ Quick Start

### Prerequisites
- Node.js 18+ and npm 8+
- MongoDB Atlas account (or local MongoDB)
- Git

### Local Development

1. **Clone the repository**:
```bash
git clone https://github.com/khanapcalculus/lccpi.git
cd lccpi
```

2. **Install dependencies**:
```bash
npm install
```

3. **Set up environment variables** (optional for demo):
```bash
# Copy env.example and configure if needed
cp env.example .env
```

4. **Run in development mode**:
```bash
npm run dev
```

This starts both the React dev server (port 3000) and Node.js server (port 5001).

### Demo Accounts

The application includes built-in demo accounts:
- **Admin**: `admin@lcc360.com` / `admin123`
- **Teacher**: `teacher@lcc360.com` / `teacher123`
- **Student**: `student@lcc360.com` / `student123`

## 🚀 Deployment on Render.com

### Quick Deployment

1. **Fork this repository** to your GitHub account
2. **Sign up** at [render.com](https://render.com)
3. **Follow the detailed guide** in [DEPLOYMENT.md](./DEPLOYMENT.md)

### Deployment Overview

The application deploys as two services:
- **Backend Service**: Node.js API and Socket.IO server
- **Frontend Service**: React static site

### Required Environment Variables

**Backend**:
```
NODE_ENV=production
PORT=10000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_secure_jwt_secret
CLIENT_URL=https://your-frontend-url.onrender.com
```

**Frontend**:
```
REACT_APP_API_URL=https://your-backend-url.onrender.com/api
```

## 📖 Usage Guide

### For Teachers
1. **Login** with teacher account
2. **Create sessions** with student assignments
3. **Share session links** via email or copy
4. **Start sessions** and collaborate in real-time
5. **Monitor student participation** and engagement

### For Students
1. **Login** with student account
2. **View assigned sessions** in dashboard
3. **Join sessions** via shared links
4. **Collaborate** on the whiteboard
5. **Track session history** and participation

### For Administrators
1. **Manage users** (create, edit, delete)
2. **Oversee all sessions** across the platform
3. **View system analytics** and usage statistics
4. **Configure user roles** and permissions

## 🔧 Development

### Project Structure
```
lccpi/
├── src/                    # React frontend
│   ├── components/         # React components
│   ├── contexts/          # React contexts
│   └── utils/             # Utility functions
├── server/                # Node.js backend
│   ├── routes/            # API routes
│   ├── models/            # MongoDB models
│   ├── middleware/        # Express middleware
│   └── index.js           # Server entry point
├── public/                # Static assets
└── package.json           # Dependencies and scripts
```

### Available Scripts
- `npm run dev` - Start development servers
- `npm run build` - Build for production
- `npm run server` - Start backend only
- `npm test` - Run tests

## 🔒 Security Features

- JWT-based authentication with secure tokens
- Password hashing with bcrypt
- CORS protection for API endpoints
- Input validation and sanitization
- Role-based access control
- Session-based authorization

## 📊 Database Schema

### User Model
- Authentication fields (email, password)
- Role-specific data (grade, subjects)
- Profile information
- Activity tracking

### Session Model
- Scheduling and timezone support
- Participant management
- Whiteboard data storage
- Analytics and engagement tracking

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment help
- **Issues**: Report bugs via GitHub Issues
- **Demo**: Try the live demo with provided demo accounts

## 🎯 Roadmap

- [ ] Video/audio integration
- [ ] Advanced whiteboard tools
- [ ] Mobile app development
- [ ] Integration with LMS platforms
- [ ] Advanced analytics dashboard
- [ ] Multi-language support
