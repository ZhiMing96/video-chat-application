const app = require('express')();
const cors = require('cors');
const server = require('http').createServer(app);

app.use(cors());
const io = require('socket.io')(server, {
  cors: {
    origin: ['http://localhost:3000', 'https://videoapp.kohzhiming.com/'],
    methods: ['GET', 'POST'],
  },
});

const rooms = {};

io.on('connection', (socket) => {
  const socketId = socket.id;
  let roomIndex;
  console.log('Socket Connection Established', socketId);

  socket.on('joined-room', (roomId) => {
    socket.join(roomId);
    roomIndex = roomId;
    console.log(`User ${socketId} is trying to join room ${roomId}`);

    if (rooms[roomId] && rooms[roomId].length > 0) {
      socket.emit('users-in-room', {
        usersInRoom: rooms[roomId],
        socketId,
      });
      const usersInRoom = rooms[roomId];
      if (!usersInRoom.includes(socketId)) {
        usersInRoom.push(socketId);
        rooms[roomId] = usersInRoom;
      }
    } else {
      rooms[roomId] = [socketId];
    }
  });

  socket.on(
    'requesting-to-connect-stream',
    ({ newPeerSignal, userToConnectTo, newPeerSocketId }) => {
      io.to(userToConnectTo).emit('new-stream-incoming', {
        newPeerSignal,
        newPeerSocketId,
      });
    }
  );

  socket.on('added-new-stream', ({ otherUserSignal, newPeerSocketId }) => {
    io.to(newPeerSocketId).emit('new-peer-stream-added', {
      otherUserSignal,
      otherUserSocketId: socketId,
    });
  });

  socket.on('disconnect', () => {
    const usersInRoom = rooms[roomIndex];
    const updatedUsers = usersInRoom
      ? usersInRoom.filter((userId) => userId !== socketId)
      : usersInRoom;
    rooms[roomIndex] = updatedUsers;
    console.log(`User ${socketId} disconnected`);
    socket.broadcast.emit('user-disconnected', socketId);
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`server listening on port ${PORT}`);
});
