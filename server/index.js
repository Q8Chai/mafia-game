const { Server } = require("socket.io");
const PORT = process.env.PORT || 3001;
const io = new Server(PORT, {

  cors: {
    origin: "*",
  },
});

const rooms = {};
const roomSettings = {};

io.on("connection", (socket) => {
  socket.on("join-room", ({ roomId, name }) => {
    if (!rooms[roomId]) {
      rooms[roomId] = [];
    }

    if (!rooms[roomId].some((p) => p.name === name)) {
      rooms[roomId].push({ name });
    }

    socket.join(roomId);
    io.to(roomId).emit("room-players", rooms[roomId]);
  });

  socket.on("check-room", (roomId, callback) => {
    const exists = !!rooms[roomId];
    callback(exists);
  });

  socket.on("start-game", (roomId, settings) => {
    const players = rooms[roomId] || [];
    const playerNames = players.map((p) => p.name);

    const roles = assignRoles(playerNames, settings);

    const playerData = players.map((player) => {
      const found = roles.find((r) => r.name === player.name);
      return { name: player.name, role: found?.role || "citizen" };
    });

    rooms[roomId] = playerData;
    roomSettings[roomId] = settings;

    io.to(roomId).emit("room-players", playerData);

    playerData.forEach(({ name, role }) => {
      io.to(roomId).emit("assign-role", { name, role });
    });
  });
});

console.log(`🚀 Socket.IO server running at http://localhost:${PORT}`);


// توزيع الأدوار حسب الإعدادات المرسلة
function assignRoles(players, settings) {
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  const roles = [];

  const mafiaCount = settings.mafiaCount;

  // أدوار المافيا
  if (mafiaCount >= 1 && shuffled.length >= 1)
    roles.push({ name: shuffled[0], role: 'mafia-leader' });
  if (mafiaCount >= 2 && shuffled.length >= 2)
    roles.push({ name: shuffled[1], role: 'mafia-police' });
  for (let i = 2; i < mafiaCount && i < shuffled.length; i++) {
    roles.push({ name: shuffled[i], role: 'mafia' });
  }

  // أدوار خاصة: شرطي، قناص، طبيب (كل واحد فقط 1)
  const specialRoles = ['police', 'sniper', 'doctor'];
  let assigned = mafiaCount;

  for (let role of specialRoles) {
    if (assigned < shuffled.length) {
      roles.push({ name: shuffled[assigned], role });
      assigned++;
    }
  }

  // الباقي شعب
  for (let i = assigned; i < shuffled.length; i++) {
    roles.push({ name: shuffled[i], role: 'citizen' });
  }

  return roles;
}
