const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const socketIO = require('socket.io');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const Message = require('./models/messages'); // ⬅️ New model import
const path = require('path');

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ MongoDB error:', err));

// Socket.IO setup
const io = socketIO(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  console.log('🔌 New user connected');

  // Send previous messages on connect
  Message.find().sort({ timestamp: 1 }).then((messages) => {
    socket.emit('loadMessages', messages);
  });

  // Handle text message
  socket.on('chatMessage', async (msg) => {
    const message = new Message({
      sender: msg.sender,
      content: msg.content,
      type: 'text'
    });

    await message.save();
    io.emit('chatMessage', message);
  });

  // Handle file message
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

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
