const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const socketIO = require('socket.io');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const Message = require('./models/messages');

const app = express();
const server = http.createServer(app);

// ✅ ALLOW frontend to access backend APIs and socket
const allowedOrigins = [
  'http://localhost:3000',
  'https://chatroom1-6.onrender.com'
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json());

// ✅ MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

// ✅ API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

// ✅ Socket.IO Setup
const io = socketIO(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

io.on('connection', (socket) => {
  console.log('🔌 User connected');

  // Send all existing messages on connection
  Message.find().sort({ timestamp: 1 }).then(messages => {
    socket.emit('loadMessages', messages);
  });

  // Handle new text message
  socket.on('chatMessage', async (msg) => {
    const message = new Message({
      sender: msg.sender,
      content: msg.content,
      type: 'text'
    });
    await message.save();
    io.emit('chatMessage', message);
  });

  // Handle file upload message
  socket.on('chatFile', async (msg) => {
    const message = new Message({
      sender: msg.sender,
      content: msg.content,
      type: 'file'
    });
    await message.save();
    io.emit('chatFile', message);
  });

  // ✅ Handle message deletion
  socket.on('deleteMessage', async (messageId) => {
    try {
      await Message.findByIdAndDelete(messageId);
      io.emit('deleteMessage', messageId); // Notify all clients
    } catch (error) {
      console.error('❌ Error deleting message:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('❌ User disconnected');
  });
});

// ✅ Serve React frontend
const clientBuildPath = path.join(__dirname, '..', 'client', 'build');
app.use(express.static(clientBuildPath));

// ✅ React Router catch-all route
app.get('*', (req, res) => {
  res.sendFile(path.join(clientBuildPath, 'index.html'));
});

// ✅ Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
