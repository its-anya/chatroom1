const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const socketIO = require('socket.io');
const path = require('path');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const Message = require('./models/messages');

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors({
  origin: 'https://chatroom1-6.onrender.com',
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ MongoDB error:', err));

// Socket.IO
const io = socketIO(server, {
  cors: {
    origin: 'https://chatroom1-6.onrender.com',
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  console.log('🔌 User connected');

  // Send chat history
  Message.find().sort({ timestamp: 1 }).then((messages) => {
    socket.emit('loadMessages', messages);
  });

  // Receive and broadcast messages
  socket.on('chatMessage', async (msg) => {
    const message = new Message({
      sender: msg.sender,
      content: msg.content,
      type: 'text'
    });
    await message.save();
    io.emit('chatMessage', message);
  });

  socket.on('chatFile', async (msg) => {
    const message = new Message({
      sender: msg.sender,
      content: msg.content,
      type: 'file'
    });
    await message.save();
    io.emit('chatFile', message);
  });

  socket.on('disconnect', () => {
    console.log('❌ User disconnected');
  });
});

// Server start
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
