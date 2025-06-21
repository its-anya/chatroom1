const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const socketIO = require('socket.io');
const path = require('path');
// Routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const Message = require('./models/messages');

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors({
  origin: '*', // Use "*" or replace with frontend domain if needed
  credentials: true,
}));
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

// Serve frontend from React build folder
app.use(express.static(path.join(__dirname, '../client/build')));

// Catch-all for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build/index.html'));
});

// Socket.IO setup
const io = socketIO(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  console.log('🔌 New user connected');

  // Send previous messages
  Message.find().sort({ timestamp: 1 }).then((messages) => {
    socket.emit('loadMessages', messages);
  });

  // Handle chat messages
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

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
